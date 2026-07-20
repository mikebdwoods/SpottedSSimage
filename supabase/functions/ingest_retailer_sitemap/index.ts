import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Bulk retailer-sitemap product ingestion - zero AI spend, zero paid APIs.
// Builds a large, real product catalog by walking the public XML sitemaps
// that retailers already publish for search-engine crawlers, verifying each
// product page (JSON-LD first, og: tags as fallback) before insertion. This
// is the "sitemap bulk-ingester" from PROJECT_STATUS.md's roadmap - the
// non-AI path to catalog scale that's been on the list since the very first
// sourcing pass found the catalog too thin to match against.
//
// Retailers: END. (endclothing.com), Missoma (missoma.com), Uniqlo
// (uniqlo.com/uk) - all three already confirmed in this project not to
// block automated fetches, and all three explicitly publish crawler-facing
// sitemaps via robots.txt (END.'s robots.txt even explicitly allows
// GPTBot/ClaudeBot/PerplexityBot etc). Only writes to `products` - never
// touches photos/clothing_items/item_matches, so it can't affect anything
// publicly visible on its own; source_products/match_products draw on this
// catalog separately.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

interface RetailerConfig {
  retailer: string;
  brand: string | null; // null = read brand from the product page itself
  sitemapIndexUrl: string;
  productUrlPattern: RegExp;
}

const RETAILERS: Record<string, RetailerConfig> = {
  "endclothing.com": {
    retailer: "endclothing.com",
    brand: null,
    sitemapIndexUrl: "https://www.endclothing.com/media/gb_sitemap.xml",
    productUrlPattern: /^https:\/\/www\.endclothing\.com\/gb\/[a-z0-9-]+\.html$/i,
  },
  "missoma.com": {
    retailer: "missoma.com",
    brand: "Missoma",
    sitemapIndexUrl: "https://www.missoma.com/sitemap.xml",
    productUrlPattern: /^https:\/\/www\.missoma\.com\/products\/[a-z0-9-]+$/i,
  },
  "uniqlo.com": {
    retailer: "uniqlo.com",
    brand: "Uniqlo",
    sitemapIndexUrl: "https://www.uniqlo.com/uk/sitemap_gb-en.xml",
    productUrlPattern: /^https:\/\/www\.uniqlo\.com\/uk\/en\/products\/[A-Za-z0-9-]+\/[0-9]+$/i,
  },
};

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function parseJsonLdProduct(html: string): { title?: string; image?: string; price?: number; brand?: string } {
  const scripts = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  ).map((m) => m[1]);

  for (const raw of scripts) {
    try {
      const parsed = JSON.parse(raw.trim());
      const nodes: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as Record<string, unknown>)?.["@graph"])
        ? ((parsed as Record<string, unknown>)["@graph"] as unknown[])
        : [parsed];

      for (const node of nodes) {
        if (typeof node !== "object" || node === null) continue;
        const n = node as Record<string, unknown>;
        const type = n["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct) continue;

        const name = typeof n.name === "string" ? n.name : undefined;
        let image: string | undefined;
        if (typeof n.image === "string") image = n.image;
        else if (Array.isArray(n.image) && typeof n.image[0] === "string") image = n.image[0];
        else if (typeof n.image === "object" && n.image !== null) {
          const imgObj = n.image as Record<string, unknown>;
          if (typeof imgObj.url === "string") image = imgObj.url;
        }

        let brand: string | undefined;
        const brandRaw = n.brand;
        if (typeof brandRaw === "string") brand = brandRaw;
        else if (typeof brandRaw === "object" && brandRaw !== null) {
          const b = brandRaw as Record<string, unknown>;
          if (typeof b.name === "string") brand = b.name;
        }

        let price: number | undefined;
        const offersRaw = n.offers;
        const offer = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
        if (typeof offer === "object" && offer !== null) {
          const priceVal = (offer as Record<string, unknown>).price;
          const parsedPrice = parseFloat(String(priceVal));
          if (Number.isFinite(parsedPrice)) price = parsedPrice;
        }

        if (name) return { title: name, image, price, brand };
      }
    } catch {
      continue;
    }
  }
  return {};
}

function parseHtmlProduct(text: string): { title?: string; image?: string; price?: number; brand?: string } {
  const ld = parseJsonLdProduct(text);

  const ogImage = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const ogTitle =
    text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const priceStr =
    text.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i)?.[1] ??
    text.match(/itemprop=["']price["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i)?.[1] ??
    text.match(/"priceCurrency"\s*:\s*"GBP"\s*,\s*"price"\s*:\s*"?([0-9]+(?:\.[0-9]{2})?)/i)?.[1] ??
    text.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]{2})?)"?\s*,\s*"priceCurrency"\s*:\s*"GBP"/i)?.[1] ??
    // Some Shopify themes (Missoma confirmed) embed their product JSON-LD
    // as an escaped string inside an inline <script> hydration payload -
    // literal backslash-quote (\") instead of a plain ", which the plain
    // patterns above never match. Same key order as the standard case,
    // just with each quote optionally backslash-escaped.
    text.match(/\\?"price\\?"\s*:\s*\\?"([0-9]+(?:\.[0-9]{2})?)\\?"\s*,\s*\\?"priceCurrency\\?"\s*:\s*\\?"GBP\\?"/i)?.[1];

  const title = ld.title ?? (ogTitle ? decodeHtmlEntities(ogTitle.trim()) : undefined);
  return {
    title: title ? decodeHtmlEntities(title.trim()) : undefined,
    image: ld.image ?? ogImage,
    price: ld.price ?? (priceStr ? parseFloat(priceStr) : undefined),
    brand: ld.brand,
  };
}

/** Extract sub-sitemap <loc> URLs from a sitemap index, or - if the fetched
 * document is actually a flat urlset already (Uniqlo's case) - a single
 * pseudo sub-sitemap pointing at itself. */
async function resolveSubSitemaps(indexUrl: string): Promise<string[]> {
  const res = await fetchWithTimeout(indexUrl, 20000, {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/xml,application/xml,*/*" },
  });
  if (!res.ok) throw new Error(`Sitemap index fetch failed: HTTP ${res.status}`);
  const text = await res.text();

  if (/<sitemapindex[\s>]/i.test(text)) {
    const locs = Array.from(text.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) => decodeHtmlEntities(m[1]));
    if (locs.length > 0) {
      // Prefer sub-sitemaps whose own name flags them as products (Shopify's
      // sitemap_products_N.xml convention) so a multi-type index like
      // Missoma's (products/pages/collections/blogs/...) doesn't waste
      // fetch cycles walking non-product sitemaps first. Falls back to the
      // full list when no sub-sitemap name hints at type (END., Uniqlo).
      const productNamed = locs.filter((l) => /product/i.test(l));
      return productNamed.length > 0 ? productNamed : locs;
    }
  }
  // Not an index (or empty one) - treat the index URL itself as the one
  // and only "sub-sitemap" to page through.
  return [indexUrl];
}

async function extractProductUrls(sitemapUrl: string, pattern: RegExp): Promise<string[]> {
  const res = await fetchWithTimeout(sitemapUrl, 30000, {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/xml,application/xml,*/*" },
  });
  if (!res.ok) throw new Error(`Sub-sitemap fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const locs = Array.from(text.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) => decodeHtmlEntities(m[1]));
  return Array.from(new Set(locs.filter((u) => pattern.test(u))));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let retailerKey = "";
  let batchSize = 8;
  try {
    const body = await req.json();
    if (typeof body?.retailer === "string") retailerKey = body.retailer;
    if (typeof body?.batch_size === "number") batchSize = Math.min(Math.max(body.batch_size, 1), 20);
  } catch {
    // defaults are fine
  }

  const config = RETAILERS[retailerKey];
  if (!config) {
    return json({ error: `Unknown retailer. Use one of: ${Object.keys(RETAILERS).join(", ")}` }, 400);
  }

  const { data: existingState } = await supabase
    .from("sitemap_ingest_state")
    .select("*")
    .eq("retailer", config.retailer)
    .maybeSingle();

  let state = existingState ?? {
    retailer: config.retailer,
    sub_sitemap_urls: [] as string[],
    sub_sitemap_cursor: 0,
    product_urls: [] as string[],
    url_cursor: 0,
    total_ingested: 0,
  };

  try {
    // Refill the sub-sitemap list if we've never fetched it, or we've
    // walked through every sub-sitemap we knew about (loop back to the
    // start - the index rarely shrinks, and re-walking is harmless since
    // insertion is dedup'd on product_url; catches newly added products).
    if (state.sub_sitemap_urls.length === 0) {
      state.sub_sitemap_urls = await resolveSubSitemaps(config.sitemapIndexUrl);
      state.sub_sitemap_cursor = 0;
    }
    if (state.sub_sitemap_cursor >= state.sub_sitemap_urls.length) {
      state.sub_sitemap_cursor = 0;
    }

    // Refill the product-URL cache if empty or exhausted.
    if (state.product_urls.length === 0 || state.url_cursor >= state.product_urls.length) {
      const nextSitemap = state.sub_sitemap_urls[state.sub_sitemap_cursor];
      state.product_urls = await extractProductUrls(nextSitemap, config.productUrlPattern);
      state.url_cursor = 0;
      state.sub_sitemap_cursor += 1;
    }

    const slice = state.product_urls.slice(state.url_cursor, state.url_cursor + batchSize);
    let inserted = 0;
    let skippedExisting = 0;
    let skippedBadData = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const url of slice) {
      try {
        const { data: existingProduct } = await supabase
          .from("products")
          .select("id")
          .eq("product_url", url)
          .limit(1)
          .maybeSingle();
        if (existingProduct) {
          skippedExisting++;
          continue;
        }

        const res = await fetchWithTimeout(url, 15000, {
          headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
        });
        if (!res.ok) {
          skippedBadData++;
          continue;
        }
        // Modern storefronts (Shopify hydration payloads especially) can
        // easily exceed 1MB of HTML before the JSON-LD/price data even
        // appears - 500KB was silently truncating the price out of every
        // Missoma page (confirmed: their pages run ~1.2MB, price JSON-LD
        // sits past the old cutoff). 3MB comfortably covers this without
        // meaningful memory/CPU cost in the edge runtime.
        const html = (await res.text()).slice(0, 3_000_000);
        const p = parseHtmlProduct(html);

        if (!p.title || p.title.trim().split(/\s+/).length < 2 || !p.image || !p.image.startsWith("http")) {
          skippedBadData++;
          continue;
        }
        // Some sites (Missoma's theme, confirmed) hardcode og:image as
        // http:// even though the CDN serves https fine - upgrade rather
        // than risk mixed-content issues downstream.
        const imageUrl = p.image.startsWith("http://") ? `https://${p.image.slice(7)}` : p.image;

        const { error: insertError } = await supabase.from("products").insert({
          title: p.title.slice(0, 200),
          brand: config.brand ?? p.brand ?? null,
          retailer: config.retailer,
          price: p.price ?? null,
          currency: "GBP",
          image_url: imageUrl,
          product_url: url,
          source_affiliate_network: null,
        });
        if (insertError) {
          skippedBadData++;
          results.push({ url, error: insertError.message });
          continue;
        }
        inserted++;
        results.push({ url, title: p.title, price: p.price ?? null });
      } catch (err) {
        skippedBadData++;
        results.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    state.url_cursor += slice.length;
    state.total_ingested += inserted;

    await supabase.from("sitemap_ingest_state").upsert({
      retailer: state.retailer,
      sub_sitemap_urls: state.sub_sitemap_urls,
      sub_sitemap_cursor: state.sub_sitemap_cursor,
      product_urls: state.product_urls,
      url_cursor: state.url_cursor,
      total_ingested: state.total_ingested,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return json({
      retailer: config.retailer,
      batch_size: slice.length,
      inserted,
      skipped_existing: skippedExisting,
      skipped_bad_data: skippedBadData,
      progress: `${state.url_cursor}/${state.product_urls.length} in current sub-sitemap (${state.sub_sitemap_cursor}/${state.sub_sitemap_urls.length} sub-sitemaps seen)`,
      total_ingested_all_time: state.total_ingested,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("debug_log").insert({ label: "ingest_retailer_sitemap", payload: { retailer: config.retailer, error: msg } });
    return json({ error: msg }, 500);
  }
});
