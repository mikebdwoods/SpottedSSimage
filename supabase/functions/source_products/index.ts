import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Search-first + vision-verified product sourcing (v5, 2026-07-19 quality
// rebuild — see PROJECT_STATUS.md item 0c/0i for the full rationale).
//
// The previous version asked Gemini's grounded search to both FIND and
// return product URLs in one shot — grounded search bills per-query at
// ~$35/1k (the likely cause of the Gemini spend-cap being hit in ~80
// minutes) and, worse, sometimes hallucinated a plausible-looking URL for
// the wrong item entirely (a navy "WINONA" baseball cap matched to a green
// bucket hat). This version separates concerns:
//
//   1. FIND candidates via Google Programmable Search (a real search index,
//      not an LLM guessing URLs) — cheap ($5/1k beyond 100/day free) and
//      returns only things that actually rank for the query.
//   2. VERIFY each candidate is a live, real product page — same two-stage
//      direct-fetch-then-Jina-proxy approach as before, upgraded to prefer
//      JSON-LD Product schema over og: tags, and to reject titles that are
//      obviously a site name or category page rather than a specific
//      product ("Men's Coats & Jackets", bare "ASOS", etc).
//   3. VISUALLY CONFIRM the candidate before it ever becomes a match — a
//      single cheap vision call (no search grounding) comparing the
//      celebrity photo + the item's AI description against the candidate's
//      product image, answering strictly YES/NO. This is the check that
//      was completely absent before and is the direct fix for the
//      bucket-hat failure: no visual agreement, no match, full stop.
//   4. HARD DAILY BUDGET CAPS on every paid call (Google Search queries and
//      vision calls), tracked in ai_budget_usage / try_consume_ai_budget —
//      so a stuck cron or a burst of new items can never again silently
//      burn through a spending cap unnoticed.
//
// Requires GOOGLE_CSE_KEY + GOOGLE_CSE_CX (Google Programmable Search —
// see PROJECT_STATUS.md item 0g for setup) and at least one of
// GEMINI_API_KEY / ANTHROPIC_API_KEY for the vision-confirm step. Without
// the search keys the function is a safe no-op (never falls back to the
// old grounded-guessing behaviour). Without a vision provider, candidates
// are never attached — fail-closed, matching the whole point of this
// rebuild.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const GENERIC_IMAGE_PATTERNS = [
  /og-image/i,
  /default[-_]?image/i,
  /social[-_]?(share|card|default)/i,
  /placeholder/i,
  /fallback/i,
  /\/logo[.\-_]/i,
];

// Titles that are a site name or a category/listing page, not a specific
// product — the exact class of bug that produced "Mango United Kingdom -
// 2026 Sale" and "Men's Coats & Jackets" as "products" last time.
const GENERIC_TITLE_PATTERNS = [
  /^(asos|zara|h&m|hm|mango|next|uniqlo|missoma|end\.?|new look|river island|m&s|marks\s*(and|&)\s*spencer|monki|weekday|boohoo|topshop)\s*(uk|united kingdom)?\s*[|\-–—]?\s*$/i,
  /\b(men'?s|women'?s|kids'?)\s+(coats?|jackets?|dresses?|shoes?|clothing|accessories|bags?|tops?|jeans)\b/i,
  /\b(designer clothing|luxury accessories|new in|sale|shop now|shop all)\b/i,
  /^(home\s*page|homepage)\b/i,
  /url source\s*:/i,
  /\b(page not found|access denied|just a moment|are you a robot|too many requests)\b/i,
];

const ALT_RETAILERS = [
  "asos.com",
  "marksandspencer.com",
  "newlook.com",
  "riverisland.com",
  "mango.com",
  "next.co.uk",
  "uniqlo.com",
  "hm.com",
  "missoma.com",
  "endclothing.com",
];

// Non-retail domains a general web query can surface that are never a
// purchasable product page.
const NON_RETAIL_DOMAINS = [
  "pinterest.",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "reddit.com",
  "wikipedia.org",
  "tiktok.com",
  "ebay.",
  "amazon.",
  "vinted.",
  "depop.com",
];

const GOOGLE_CSE_DAILY_CAP = parseInt(Deno.env.get("GOOGLE_CSE_DAILY_CAP") ?? "90", 10);
const VISION_DAILY_CAP = parseInt(Deno.env.get("VISION_DAILY_CAP") ?? "150", 10);

interface Candidate {
  retailer: string;
  brand: string | null;
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

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

function looksGenericImage(url: string): boolean {
  return GENERIC_IMAGE_PATTERNS.some((p) => p.test(url));
}

function looksGenericTitle(title: string): boolean {
  if (title.trim().split(/\s+/).length < 2) return true;
  return GENERIC_TITLE_PATTERNS.some((p) => p.test(title));
}

function isNonRetailDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return NON_RETAIL_DOMAINS.some((d) => host.includes(d));
  } catch {
    return true;
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
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

/** Pull a Product node out of JSON-LD structured data, if present. Far more
 * reliable than og: tags — those get filled with the retailer's generic
 * share-card text on plenty of sites, which is exactly what fed the last
 * batch of junk product titles. */
function parseJsonLdProduct(html: string): { title?: string; image?: string; price?: number } {
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

        let price: number | undefined;
        const offersRaw = n.offers;
        const offer = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
        if (typeof offer === "object" && offer !== null) {
          const priceVal = (offer as Record<string, unknown>).price;
          const parsedPrice = parseFloat(String(priceVal));
          if (Number.isFinite(parsedPrice)) price = parsedPrice;
        }

        if (name) return { title: name, image, price };
      }
    } catch {
      continue;
    }
  }
  return {};
}

function parseHtmlProduct(text: string): { title?: string; image?: string; price?: number } {
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
  };
}

/** Verify a candidate URL points at a real, live, specific product page. */
async function verifyCandidate(url: string): Promise<Verified | null> {
  try {
    const res = await fetchWithTimeout(url, 12000, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (res.ok) {
      // Modern storefronts (Shopify hydration payloads especially) can
      // easily exceed 1MB of HTML before the JSON-LD/price data even
      // appears - 500KB was silently truncating price data out of pages
      // that run past it (confirmed on Missoma, ~1.2MB pages). 3MB
      // comfortably covers this without meaningful cost in the edge runtime.
      const text = (await res.text()).slice(0, 3_000_000);
      const p = parseHtmlProduct(text);
      if (p.title && !looksGenericTitle(p.title) && p.image && p.image.startsWith("http") && !looksGenericImage(p.image)) {
        return { title: p.title, price: p.price ?? null, image: p.image, finalUrl: url };
      }
    }
  } catch {
    // fall through to proxy
  }

  try {
    const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, 30000, {
      headers: { Accept: "text/plain" },
    });
    if (!res.ok) return null;
    const text = (await res.text()).slice(0, 300_000);
    const title = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
    const image = pickJinaImage(text, url);
    if (title && !looksGenericTitle(title) && image) {
      return { title, price: null, image, finalUrl: url };
    }
  } catch {
    // verification failed on both paths
  }
  return null;
}

const JUNK_IMAGE_HOSTS = ["cookielaw.org", "onetrust.com", "trustpilot.com", "googletagmanager.com"];

function pickJinaImage(text: string, productUrl: string): string | undefined {
  let hostToken = "";
  try {
    hostToken = new URL(productUrl).hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    // keep empty - falls back to first clean image
  }
  const imgs = Array.from(text.matchAll(/!\[[^\]]*\]\((https?:[^)\s]+)\)/g)).map((m) => m[1]);
  const clean = imgs.filter(
    (u) => !JUNK_IMAGE_HOSTS.some((j) => u.includes(j)) && !looksGenericImage(u) && !/logo/i.test(u)
  );
  return (hostToken && clean.find((u) => u.includes(hostToken))) || clean[0];
}

/** Atomically check-and-increment today's usage for a metered provider.
 * Fails closed: any error talking to the budget table is treated as "not
 * allowed" rather than silently spending anyway. */
async function tryConsumeBudget(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  provider: string,
  dailyCap: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("try_consume_ai_budget", {
    p_provider: provider,
    p_daily_cap: dailyCap,
  });
  if (error) {
    console.error(`[source_products] budget check failed for ${provider}:`, error.message);
    return false;
  }
  return data === true;
}

async function googleSearch(apiKey: string, cx: string, query: string): Promise<SearchResult[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&num=6&gl=uk&q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, 12000);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google CSE error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .filter((it: Record<string, unknown>) => typeof it.link === "string" && typeof it.title === "string")
    .map((it: Record<string, unknown>) => ({
      title: String(it.title),
      link: String(it.link),
      snippet: typeof it.snippet === "string" ? it.snippet : "",
    }));
}

function buildItemDescription(
  item: { category: string; color: string | null; description: string | null; brand_guess: string | null },
  celebName: string | null
): string {
  return [
    item.brand_guess ? `${item.brand_guess}` : "",
    item.color ? `${item.color}` : "",
    item.category,
    item.description ?? "",
    celebName ? `worn by ${celebName}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildExactQuery(
  item: { category: string; color: string | null; description: string | null; brand_guess: string | null },
  celebName: string | null
): string {
  const parts = [
    item.brand_guess,
    item.description ?? `${item.color ?? ""} ${item.category}`.trim(),
    // Press coverage often names the exact garment alongside the
    // celebrity - helps pin down the right product when the brand alone
    // is ambiguous or absent.
    celebName ?? "",
    "buy uk",
  ].filter(Boolean);
  return parts.join(" ");
}

function buildAltQuery(item: { category: string; color: string | null; description: string | null }): string {
  const retailerClause = `(${ALT_RETAILERS.map((r) => `site:${r}`).join(" OR ")})`;
  const desc = [item.color, item.category].filter(Boolean).join(" ");
  return `${desc} ${retailerClause}`;
}

async function fetchImageBase64(url: string): Promise<[string, string] | [null, null]> {
  try {
    const res = await fetchWithTimeout(url, 15000, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) return [null, null];
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    let mime = "image/jpeg";
    if (ct.includes("png")) mime = "image/png";
    else if (ct.includes("webp")) mime = "image/webp";
    else if (ct.includes("gif")) mime = "image/gif";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 15 * 1024 * 1024) return [null, null];
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return [btoa(binary), mime];
  } catch {
    return [null, null];
  }
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

async function callGeminiVision(
  apiKey: string,
  prompt: string,
  photoB64: string,
  photoMime: string,
  candB64: string,
  candMime: string
): Promise<string> {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    30000,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: photoMime, data: photoB64 } },
              { inline_data: { mime_type: candMime, data: candB64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 10 },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini returned no content");
  return stripJsonFences(text);
}

async function callClaudeVision(
  apiKey: string,
  prompt: string,
  photoB64: string,
  photoMime: string,
  candB64: string,
  candMime: string
): Promise<string> {
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", 30000, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: photoMime, data: photoB64 } },
            { type: "image", source: { type: "base64", media_type: candMime, data: candB64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  if (!text) throw new Error("Claude returned no content");
  return text.trim();
}

/** The visual check that was completely missing before: does the candidate
 * product image plausibly match the specific item, given the celebrity
 * photo it was spotted in? Fails closed on any ambiguity, missing provider,
 * exhausted budget, or fetch failure — never attaches on a "maybe". */
async function visionConfirmMatch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  photoImageUrl: string | null,
  itemDesc: string,
  candidateImageUrl: string
): Promise<{ ok: boolean; reason: string }> {
  if (!photoImageUrl) return { ok: false, reason: "no_source_photo" };

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!geminiKey && !claudeKey) return { ok: false, reason: "no_vision_provider" };

  const provider = geminiKey ? "gemini_vision" : "claude_vision";
  const allowed = await tryConsumeBudget(supabase, provider, VISION_DAILY_CAP);
  if (!allowed) return { ok: false, reason: "vision_budget_exhausted" };

  const [photoB64, photoMime] = await fetchImageBase64(photoImageUrl);
  const [candB64, candMime] = await fetchImageBase64(candidateImageUrl);
  if (!photoB64 || !candB64) return { ok: false, reason: "image_fetch_failed" };

  const prompt = `Image 1 is a photo of a celebrity's outfit. The specific item to check is: "${itemDesc}". Image 2 is a product photo from a UK shopping site. Does the product shown in Image 2 plausibly match that specific item from Image 1 - same type of garment, same or very similar colour and style? Reply with exactly one word, YES or NO. If you are not confident, reply NO.`;

  try {
    const text = geminiKey
      ? await callGeminiVision(geminiKey, prompt, photoB64, photoMime, candB64, candMime)
      : await callClaudeVision(claudeKey!, prompt, photoB64, photoMime, candB64, candMime);
    const answer = text.trim().toUpperCase();
    return { ok: answer.startsWith("YES"), reason: answer.slice(0, 30) || "empty_response" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `vision_error: ${msg.slice(0, 150)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const cseKey = Deno.env.get("GOOGLE_CSE_KEY");
  const cseCx = Deno.env.get("GOOGLE_CSE_CX");
  if (!cseKey || !cseCx) {
    // Safe no-op - never falls back to the old grounded-guessing behaviour.
    // See PROJECT_STATUS.md item 0g for the setup checklist.
    return json({
      skipped: true,
      reason: "GOOGLE_CSE_KEY / GOOGLE_CSE_CX not configured - see PROJECT_STATUS.md item 0g",
    });
  }

  let batchSize = 3;
  try {
    const body = await req.json();
    if (typeof body?.batch_size === "number") batchSize = Math.min(Math.max(body.batch_size, 1), 6);
  } catch {
    // defaults are fine
  }

  const ITEM_FIELDS =
    "id, category, color, brand_guess, description, photos!inner(image_url, status, celebrities!inner(name, status))";
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
    const seen = new Set(items.map((i: { id: string }) => i.id));
    items = items.concat((rest ?? []).filter((i: { id: string }) => !seen.has(i.id)));
  }

  if (items.length === 0) return json({ processed: 0, message: "Nothing to source" });

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
  let budgetStopped = false;
  const results: Array<Record<string, unknown>> = [];

  // deno-lint-ignore no-explicit-any
  for (const item of items as any[]) {
    try {
      const celebName = item.photos?.celebrities?.name ?? null;
      const photoImageUrl: string | null = item.photos?.image_url ?? null;
      const itemDesc = buildItemDescription(item, celebName);

      let exactAttached = false;
      let exactUrl: string | null = null;

      const exactBudgetOk = await tryConsumeBudget(supabase, "google_cse", GOOGLE_CSE_DAILY_CAP);
      if (!exactBudgetOk) {
        // Budget exhausted before this item was touched at all - leave
        // sourcing_attempted_at unset so it's picked up fresh next run
        // instead of being silently stranded.
        budgetStopped = true;
        results.push({ item_id: item.id, skipped: "google_cse_budget_exhausted" });
        break;
      }

      // Claim the item only once we're actually spending on it, so a
      // mid-batch budget cutoff never strands an untouched item in limbo
      // (claimed but never attempted, and therefore never retried).
      await supabase.from("clothing_items").update({ sourcing_attempted_at: new Date().toISOString() }).eq("id", item.id);

      const exactResults = await googleSearch(cseKey, cseCx, buildExactQuery(item, celebName));
      const exactPick = exactResults.find((r) => !isNonRetailDomain(r.link) && !looksGenericTitle(r.title));

      if (exactPick) {
        const verified = await verifyCandidate(exactPick.link);
        if (verified) {
          const vision = await visionConfirmMatch(supabase, photoImageUrl, itemDesc, verified.image);
          if (vision.ok) {
            exactAttached = await attachProduct(
              item.id,
              {
                retailer: hostnameOf(exactPick.link),
                brand: item.brand_guess,
                title: verified.title,
                price_gbp: verified.price,
                url: exactPick.link,
              },
              verified,
              "exact",
              0.9
            );
            if (exactAttached) exactUrl = verified.finalUrl;
          }
        }
      }

      let dupesAttached = 0;
      const altBudgetOk = await tryConsumeBudget(supabase, "google_cse", GOOGLE_CSE_DAILY_CAP);
      if (altBudgetOk) {
        const altResults = await googleSearch(cseKey, cseCx, buildAltQuery(item));
        const altCandidates = altResults.filter((r) => !looksGenericTitle(r.title)).slice(0, 3);

        for (const alt of altCandidates) {
          if (exactUrl && alt.link === exactUrl) continue;
          const verified = await verifyCandidate(alt.link);
          if (!verified) continue;
          if (exactUrl && verified.finalUrl === exactUrl) continue;
          const vision = await visionConfirmMatch(supabase, photoImageUrl, itemDesc, verified.image);
          if (!vision.ok) continue;
          const ok = await attachProduct(
            item.id,
            {
              retailer: hostnameOf(alt.link),
              brand: null,
              title: verified.title,
              price_gbp: null,
              url: alt.link,
            },
            verified,
            "dupe",
            0.65
          );
          if (ok) dupesAttached++;
        }
      }

      if (exactAttached || dupesAttached > 0) {
        sourced++;
        await supabase.from("clothing_items").update({ sourcing_status: "sourced" }).eq("id", item.id);
        results.push({ item_id: item.id, category: item.category, exact: exactAttached, dupes: dupesAttached });
      } else {
        noSource++;
        await supabase.from("clothing_items").update({ sourcing_status: "no_source" }).eq("id", item.id);
        results.push({ item_id: item.id, category: item.category, sourced: false });
      }
    } catch (err) {
      errored++;
      const msg = err instanceof Error ? err.message : String(err);
      await supabase.from("clothing_items").update({ sourcing_status: "error" }).eq("id", item.id);
      results.push({ item_id: item.id, error: msg.slice(0, 300) });
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota")) break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const summary = { processed: items.length, sourced, no_source: noSource, errored, budget_stopped: budgetStopped, results };
  await supabase.from("debug_log").insert({ label: "source_products", payload: summary });
  return json(summary);
});
