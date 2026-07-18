import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Automated product sourcing: for clothing items with no shoppable products,
// asks Gemini (grounded with Google Search) for real UK product listings
// matching the item's AI description, then VERIFIES each candidate URL is a
// live product page before anything is inserted - first by direct fetch,
// then via the Jina Reader rendering proxy (r.jina.ai) for retailers that
// block datacenter traffic. Nothing unverified ever enters the catalog.
//
// Runs on a cron; each item is attempted exactly once (sourcing_attempted_at
// is claimed up front), so the backlog drains and the function goes quiet -
// no repeat Gemini spend on items already tried.

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
  title: string;
  price_gbp: number | null;
  url: string;
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

/** Ask Gemini (grounded) for candidate product listings for an item. */
async function findCandidates(
  geminiKey: string,
  item: { category: string; color: string | null; description: string | null; brand_guess: string | null }
): Promise<Candidate[]> {
  const desc = [
    item.brand_guess ? `Brand: ${item.brand_guess}.` : "",
    item.color ? `Colour: ${item.color}.` : "",
    `Category: ${item.category}.`,
    item.description ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const prompt = `You are sourcing shoppable products for a UK celebrity-fashion site.

Find up to 3 real, currently-purchasable UK product listings closely matching this item:
${desc}

Rules:
- Direct product pages only (a single product with a price), never category/search/marketplace pages.
- Each candidate from a DIFFERENT retailer.
- Strongly prefer these retailers when they stock a plausible match: endclothing.com, missoma.com, uniqlo.com, cpcompany.com, drmartens.com, brandymelville.co.uk. Other UK retailers are allowed.
- If the brand is known, one candidate should be the same brand if possible; others can be affordable alternatives.
- If you cannot find anything genuinely close, return fewer candidates or an empty array. Never invent URLs.

Return ONLY a JSON array, no markdown, no commentary:
[{"retailer":"END.","title":"...","price_gbp":129.00,"url":"https://..."}]`;

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

  // Grounded responses wrap the JSON in prose/fences sometimes - extract the array
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      retailer: typeof c.retailer === "string" ? c.retailer.slice(0, 80) : "Unknown",
      title: typeof c.title === "string" ? c.title.slice(0, 200) : "",
      price_gbp: typeof c.price_gbp === "number" && c.price_gbp > 0 && c.price_gbp < 100000 ? c.price_gbp : null,
      url: typeof c.url === "string" ? c.url : "",
    }))
    .filter((c) => c.url.startsWith("http") && c.title.length > 0)
    .slice(0, 3);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  let batchSize = 4;
  try {
    const body = await req.json();
    if (typeof body?.batch_size === "number") batchSize = Math.min(Math.max(body.batch_size, 1), 6);
  } catch {
    // defaults are fine
  }

  // Unattempted, shoppable items, newest first. 'other' is mostly
  // non-fashion (tambourines, phone cases) - not worth Gemini spend.
  const { data: items, error } = await supabase
    .from("clothing_items")
    .select("id, category, color, brand_guess, description")
    .is("sourcing_attempted_at", null)
    .neq("category", "other")
    .not("description", "is", null)
    .order("created_at", { ascending: false })
    .limit(batchSize);

  if (error) return json({ error: error.message }, 500);
  if (!items || items.length === 0) return json({ processed: 0, message: "Nothing to source" });

  // Claim the batch up front so overlapping cron runs never double-spend
  const ids = items.map((i) => i.id);
  await supabase.from("clothing_items").update({ sourcing_attempted_at: new Date().toISOString() }).in("id", ids);

  let sourced = 0;
  let noSource = 0;
  let errored = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const item of items) {
    try {
      const candidates = await findCandidates(geminiKey, item);

      let inserted: { title: string; url: string } | null = null;
      for (const cand of candidates) {
        // Never re-insert a product we already have
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("product_url", cand.url)
          .limit(1)
          .maybeSingle();
        if (existing) {
          // Product already in catalog - the matcher can use it; count as sourced
          inserted = { title: cand.title, url: cand.url };
          break;
        }

        const verified = await verifyCandidate(cand.url);
        if (!verified) continue;

        // Page-extracted price wins; Gemini's claimed price is used only
        // when the page confirms nothing (kept nullable - never guessed).
        const { error: insertError } = await supabase.from("products").insert({
          title: verified.title.slice(0, 200),
          brand: null,
          retailer: cand.retailer,
          price: verified.price ?? cand.price_gbp,
          currency: "GBP",
          image_url: verified.image,
          product_url: verified.finalUrl,
          source_affiliate_network: null,
        });
        if (!insertError) {
          inserted = { title: verified.title, url: verified.finalUrl };
          break;
        }
      }

      if (inserted) {
        sourced++;
        await supabase.from("clothing_items").update({ sourcing_status: "sourced" }).eq("id", item.id);
        // Re-run matching for this item now that a product exists for it.
        // Clear stale empty state first is unnecessary: matcher skips items
        // that already have matches, and these have none.
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/match_products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: item.id }),
        }).catch(() => {});
        results.push({ item_id: item.id, category: item.category, sourced: inserted });
      } else {
        noSource++;
        await supabase.from("clothing_items").update({ sourcing_status: "no_source" }).eq("id", item.id);
        results.push({ item_id: item.id, category: item.category, sourced: null, candidates_tried: candidates.length });
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
