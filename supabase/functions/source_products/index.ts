import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Automated product sourcing: for each clothing item, asks Gemini (grounded
// with Google Search) for TWO things at once - the EXACT product the
// celebrity is wearing (when identifiable) and 2-3 CHEAPER high-street
// alternatives - then VERIFIES every candidate URL is a live product page
// before anything is inserted: first by direct fetch, then via the Jina
// Reader rendering proxy (r.jina.ai) for retailers that block datacenter
// traffic. Nothing unverified ever enters the catalog.
//
// Verified products get item_matches written directly (exact -> 'exact',
// alternatives -> 'dupe'), so the item page can show "the exact one" plus
// "get the look for less" without relying on the generic matcher.
//
// Runs on a cron; each item is attempted exactly once (sourcing_attempted_at
// is claimed up front), so the backlog drains and the function goes quiet -
// no repeat Gemini spend on items already tried. Items on LIVE photos of
// PUBLISHED celebrities are sourced first - they're the ones people can
// actually see.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Same generic/placeholder image guard as resolve_articles
const GENERIC_IMAGE_PATTERNS = [
  /og-image/i,
  /default[-_]?image/i,
  /social[-_]?(share|card|default)/i,
  /placeholder/i,
  /fallback/i,
  /\/logo[.\-_]/i,
];

interface Candidate {
  retailer: string;
  brand: string | null;
  title: string;
  price_gbp: number | null;
  url: string;
}

interface SourcingResult {
  exact: Candidate | null;
  alternatives: Candidate[];
}

interface Verified {
  title: string;
  price: number | null;
  image: string;
  finalUrl: string;
}

function looksGeneric(url: string): boolean {
  return GENERIC_IMAGE_PATTERNS.some((p) => p.test(url));
}

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

function parseHtmlProduct(text: string): { title?: string; image?: string; price?: number } {
  const image = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title =
    text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const priceStr =
    text.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i)?.[1] ??
    text.match(/itemprop=["']price["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i)?.[1] ??
    text.match(/"priceCurrency"\s*:\s*"GBP"\s*,\s*"price"\s*:\s*"?([0-9]+(?:\.[0-9]{2})?)/i)?.[1] ??
    text.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]{2})?)"?\s*,\s*"priceCurrency"\s*:\s*"GBP"/i)?.[1];
  return {
    title: title ? decodeHtmlEntities(title.trim()) : undefined,
    image,
    price: priceStr ? parseFloat(priceStr) : undefined,
  };
}

/** Verify a candidate URL points at a real, live product page. */
async function verifyCandidate(url: string): Promise<Verified | null> {
  // 1) Direct fetch
  try {
    const res = await fetchWithTimeout(url, 12000, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (res.ok) {
      const text = (await res.text()).slice(0, 500_000);
      const p = parseHtmlProduct(text);
      // A 200 that is really a "not found"/error page slips through titles
      const badTitle = p.title && /(?:not|n't)(?:\s+be)?\s+found|went\s+wrong|access\s+denied|unavailable|error|\b404\b/i.test(p.title);
      if (p.title && !badTitle && p.image && p.image.startsWith("http") && !looksGeneric(p.image)) {
        return { title: p.title, price: p.price ?? null, image: p.image, finalUrl: url };
      }
    }
  } catch {
    // fall through to proxy
  }

  // 2) Jina Reader proxy - renders the page from Jina's infra, which most
  // retailer bot-walls allow. Returns markdown.
  try {
    const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, 30000, {
      headers: { Accept: "text/plain" },
    });
    if (!res.ok) return null;
    const text = (await res.text()).slice(0, 300_000);
    const title = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
    const badTitle = title && /(?:not|n't)(?:\s+be)?\s+found|went\s+wrong|access\s+denied|unavailable|error|\b404\b|just a moment/i.test(title);
    const image = pickJinaImage(text, url);
    // Markdown £-regex price is unreliable (cookie banners, unrelated
    // promos) - leave null here; the caller falls back to the
    // search-grounded candidate price.
    if (title && !badTitle && image) {
      return { title, price: null, image, finalUrl: url };
    }
  } catch {
    // verification failed on both paths
  }
  return null;
}

// Hosts that serve consent/analytics imagery, never product photos
const JUNK_IMAGE_HOSTS = ["cookielaw.org", "onetrust.com", "trustpilot.com", "googletagmanager.com"];

/** Pick the most plausible product image from Jina markdown output. */
function pickJinaImage(text: string, productUrl: string): string | undefined {
  let hostToken = "";
  try {
    hostToken = new URL(productUrl).hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    // keep empty - falls back to first clean image
  }
  const imgs = Array.from(text.matchAll(/!\[[^\]]*\]\((https?:[^)\s]+)\)/g)).map((m) => m[1]);
  const clean = imgs.filter(
    (u) => !JUNK_IMAGE_HOSTS.some((j) => u.includes(j)) && !looksGeneric(u) && !/logo/i.test(u)
  );
  // Prefer an image hosted on/for the same retailer (asos ->
  // images.asos-media.com etc.), else the first clean one.
  return (hostToken && clean.find((u) => u.includes(hostToken))) || clean[0];
}

function normaliseCandidate(c: Record<string, unknown>): Candidate | null {
  const url = typeof c.url === "string" ? c.url : "";
  const title = typeof c.title === "string" ? c.title.slice(0, 200) : "";
  if (!url.startsWith("http") || title.length === 0) return null;
  return {
    retailer: typeof c.retailer === "string" ? c.retailer.slice(0, 80) : "Unknown",
    brand: typeof c.brand === "string" && c.brand.length > 0 ? c.brand.slice(0, 80) : null,
    title,
    price_gbp: typeof c.price_gbp === "number" && c.price_gbp > 0 && c.price_gbp < 100000 ? c.price_gbp : null,
    url,
  };
}

/** Ask Gemini (grounded) for the exact product + cheaper alternatives. */
async function findCandidates(
  geminiKey: string,
  item: { category: string; color: string | null; description: string | null; brand_guess: string | null },
  celebName: string | null
): Promise<SourcingResult> {
  const desc = [
    item.brand_guess ? `Brand: ${item.brand_guess}.` : "",
    item.color ? `Colour: ${item.color}.` : "",
    `Category: ${item.category}.`,
    item.description ?? "",
    celebName ? `Worn by: ${celebName}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const prompt = `You are sourcing shoppable products for a UK celebrity-fashion site. A celebrity was photographed wearing this item:
${desc}

Do TWO things:

1. EXACT: try to identify the exact product (the actual brand + product name) and find its real, currently-purchasable UK product listing. If the brand is stated, search for that brand + the item's distinctive details. If you cannot identify the exact product with reasonable confidence, set "exact" to null - never guess.

2. CHEAPER ALTERNATIVES: find 2-3 real UK product listings that closely resemble the item but cost LESS than the exact product (or are simply affordable high-street options if the exact price is unknown). Prefer well-known affordable UK retailers: ASOS, Marks & Spencer, New Look, River Island, Mango, Next, Monki, Weekday, Uniqlo, H&M, Missoma (jewellery), endclothing.com (menswear/streetwear). Each alternative from a DIFFERENT retailer.

Rules:
- Direct product pages only (a single product with a price), never category/search/marketplace pages.
- Only URLs you found via search results - never construct or invent URLs.
- If you cannot find anything genuinely close, return fewer alternatives or none.

Return ONLY a JSON object, no markdown, no commentary:
{"exact": {"retailer": "...", "brand": "...", "title": "...", "price_gbp": 129.00, "url": "https://..."} or null,
 "alternatives": [{"retailer": "...", "brand": "...", "title": "...", "price_gbp": 24.99, "url": "https://..."}]}`;

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    45000,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");

  // Grounded responses wrap the JSON in prose/fences sometimes - extract the object
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return { exact: null, alternatives: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { exact: null, alternatives: [] };
  }
  if (typeof parsed !== "object" || parsed === null) return { exact: null, alternatives: [] };
  const obj = parsed as Record<string, unknown>;

  const exact =
    typeof obj.exact === "object" && obj.exact !== null
      ? normaliseCandidate(obj.exact as Record<string, unknown>)
      : null;
  const alternatives = (Array.isArray(obj.alternatives) ? obj.alternatives : [])
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map(normaliseCandidate)
    .filter((c): c is Candidate => c !== null)
    // An "alternative" that is the same URL as the exact is noise
    .filter((c) => !exact || c.url !== exact.url)
    .slice(0, 3);

  return { exact, alternatives };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  let batchSize = 3;
  try {
    const body = await req.json();
    if (typeof body?.batch_size === "number") batchSize = Math.min(Math.max(body.batch_size, 1), 6);
  } catch {
    // defaults are fine
  }

  // Live-first queue: items on live photos of published celebrities are the
  // ones visitors can actually see, so they get sourced before the queued
  // backlog. 'other' is mostly non-fashion (tambourines, phone cases) - not
  // worth Gemini spend.
  const ITEM_FIELDS = "id, category, color, brand_guess, description, photos!inner(status, celebrities!inner(name, status))";
  const { data: liveItems, error: liveError } = await supabase
    .from("clothing_items")
    .select(ITEM_FIELDS)
    .is("sourcing_attempted_at", null)
    .neq("category", "other")
    .not("description", "is", null)
    .eq("photos.status", "live")
    .eq("photos.celebrities.status", "published")
    .order("created_at", { ascending: false })
    .limit(batchSize);

  if (liveError) return json({ error: liveError.message }, 500);

  let items = liveItems ?? [];
  if (items.length < batchSize) {
    const { data: rest } = await supabase
      .from("clothing_items")
      .select(ITEM_FIELDS)
      .is("sourcing_attempted_at", null)
      .neq("category", "other")
      .not("description", "is", null)
      .order("created_at", { ascending: false })
      .limit(batchSize - items.length);
    const seen = new Set(items.map((i) => i.id));
    items = items.concat((rest ?? []).filter((i) => !seen.has(i.id)));
  }

  if (items.length === 0) return json({ processed: 0, message: "Nothing to source" });

  // Claim the batch up front so overlapping cron runs never double-spend
  const ids = items.map((i) => i.id);
  await supabase.from("clothing_items").update({ sourcing_attempted_at: new Date().toISOString() }).in("id", ids);

  // Insert (or reuse) a verified product and write the item_match. Returns
  // true when the item ended up with a usable match.
  async function attachProduct(
    itemId: string,
    cand: Candidate,
    verified: Verified,
    matchType: "exact" | "dupe",
    score: number
  ): Promise<boolean> {
    let productId: string | null = null;

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("product_url", verified.finalUrl)
      .limit(1)
      .maybeSingle();

    if (existing) {
      productId = existing.id;
    } else {
      // Page-extracted price wins; Gemini's claimed price is used only when
      // the page confirms nothing (kept nullable - never guessed).
      const { data: inserted, error: insertError } = await supabase
        .from("products")
        .insert({
          title: verified.title.slice(0, 200),
          brand: cand.brand,
          retailer: cand.retailer,
          price: verified.price ?? cand.price_gbp,
          currency: "GBP",
          image_url: verified.image,
          product_url: verified.finalUrl,
          source_affiliate_network: null,
        })
        .select("id")
        .single();
      if (insertError || !inserted) return false;
      productId = inserted.id;
    }

    const { data: existingMatch } = await supabase
      .from("item_matches")
      .select("id")
      .eq("item_id", itemId)
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();
    if (existingMatch) return true;

    const { error: matchError } = await supabase.from("item_matches").insert({
      item_id: itemId,
      product_id: productId,
      match_type: matchType,
      score,
      is_primary: matchType === "exact",
    });
    return !matchError;
  }

  let sourced = 0;
  let noSource = 0;
  let errored = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const item of items) {
    try {
      // deno-lint-ignore no-explicit-any
      const celebName = (item as any).photos?.celebrities?.name ?? null;
      const { exact, alternatives } = await findCandidates(geminiKey, item, celebName);

      let exactAttached = false;
      let dupesAttached = 0;

      if (exact) {
        const verified = await verifyCandidate(exact.url);
        if (verified) {
          exactAttached = await attachProduct(item.id, exact, verified, "exact", 0.95);
        }
      }

      for (const alt of alternatives) {
        const verified = await verifyCandidate(alt.url);
        if (!verified) continue;
        const ok = await attachProduct(item.id, alt, verified, "dupe", 0.7);
        if (ok) dupesAttached++;
      }

      if (exactAttached || dupesAttached > 0) {
        sourced++;
        await supabase.from("clothing_items").update({ sourcing_status: "sourced" }).eq("id", item.id);
        results.push({
          item_id: item.id,
          category: item.category,
          exact: exactAttached ? exact?.title : null,
          dupes: dupesAttached,
        });
      } else {
        noSource++;
        await supabase.from("clothing_items").update({ sourcing_status: "no_source" }).eq("id", item.id);
        results.push({
          item_id: item.id,
          category: item.category,
          sourced: null,
          candidates_tried: (exact ? 1 : 0) + alternatives.length,
        });
      }
    } catch (err) {
      errored++;
      const msg = err instanceof Error ? err.message : String(err);
      await supabase.from("clothing_items").update({ sourcing_status: "error" }).eq("id", item.id);
      results.push({ item_id: item.id, error: msg.slice(0, 300) });
      // Rate limited by Gemini - stop the batch, cron retries later items next run
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const summary = { processed: items.length, sourced, no_source: noSource, errored, results };
  await supabase.from("debug_log").insert({ label: "source_products", payload: summary });
  return json(summary);
});
