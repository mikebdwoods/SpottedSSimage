import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Resolves Google News RSS redirect links (news.google.com/rss/articles/CBMi...)
// to the real publisher article URL, then scrapes the article's og:image so
// external_posts carry a genuine photo instead of the Google News logo.
//
// Google encrypts these links (mid-2024 onwards), so the only reliable path is
// Google's own internal decode endpoint: fetch the article splash page to get
// a signature + timestamp, then POST them to /_/DotsSplashUi/data/batchexecute.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Hosts that are never a real article photo
const BLOCKED_IMAGE_HOSTS = [
  "lh3.googleusercontent.com",
  "news.google.com",
  "gstatic.com",
  "www.gstatic.com",
];

function isBlockedImageHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return BLOCKED_IMAGE_HOSTS.some((b) => host === b || host.endsWith(`.${b}`));
  } catch {
    return true;
  }
}

// Site-wide default/fallback share images (a publisher's platform-level
// og:image, not the article's actual photo) - e.g. AOL/Yahoo articles all
// resolve to the same s.yimg.com/.../og-image.png regardless of content.
// Filename patterns, not hosts, since these live on otherwise-legitimate
// publisher CDNs.
const GENERIC_IMAGE_PATTERNS = [
  /og-image/i,
  /default[-_]?image/i,
  /social[-_]?(share|card|default)/i,
  /placeholder/i,
  /fallback/i,
  /\/logo[.\-_]/i,
];

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

/** Decode a news.google.com/rss/articles/<id> link to the real publisher URL. */
async function decodeGoogleNewsUrl(gnewsLink: string): Promise<string> {
  const u = new URL(gnewsLink);
  const articleId = u.pathname.split("/").filter(Boolean).pop();
  if (!articleId) throw new Error("Could not extract article id from link");

  // Old-format links sometimes decode directly from base64
  if (articleId.startsWith("CBMi")) {
    // fall through to batchexecute — direct decode is unreliable for new links
  }

  const pageRes = await fetchWithTimeout(
    `https://news.google.com/rss/articles/${articleId}`,
    12000,
    { headers: { "User-Agent": BROWSER_UA } }
  );
  if (!pageRes.ok) {
    throw new Error(`gnews page HTTP ${pageRes.status}${pageRes.status === 429 ? " (rate limited)" : ""}`);
  }
  const html = await pageRes.text();

  // Some responses still expose the target directly
  const direct = html.match(/data-n-au="([^"]+)"/)?.[1];
  if (direct && direct.startsWith("http")) return decodeHtmlEntities(direct);

  const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) throw new Error("No decode signature found on gnews page");

  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${articleId}",${ts},"${sg}"]`;
  const body = new URLSearchParams({
    "f.req": JSON.stringify([[["Fbv4je", inner, null, "generic"]]]),
  });

  const res = await fetchWithTimeout(
    "https://news.google.com/_/DotsSplashUi/data/batchexecute",
    12000,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": BROWSER_UA,
      },
      body,
    }
  );
  if (!res.ok) {
    throw new Error(`batchexecute HTTP ${res.status}${res.status === 429 ? " (rate limited)" : ""}`);
  }
  const text = await res.text();

  // Response embeds the URL inside escaped JSON: ...\"garturlres\",\"https://...\"...
  const m =
    text.match(/garturlres\\?"\s*,\s*\\?"(https?:[^"\\]+)/) ??
    text.match(/"(https?:\/\/(?!news\.google|www\.google|consent\.google)[^"\\]+)"/);
  if (!m) throw new Error("No URL found in batchexecute response");
  return m[1];
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Scrape the main article image (og:image and friends) from a publisher page. */
async function scrapeArticleImage(articleUrl: string): Promise<string | null> {
  const res = await fetchWithTimeout(articleUrl, 12000, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
    },
  });
  if (!res.ok) return null;
  const html = (await res.text()).slice(0, 500_000);

  const patterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (!m) continue;
    let img = decodeHtmlEntities(m[1].trim());
    if (img.startsWith("//")) img = "https:" + img;
    else if (img.startsWith("/")) img = new URL(img, articleUrl).href;
    if (!img.startsWith("http")) continue;
    if (isBlockedImageHost(img)) continue;
    if (looksGeneric(img)) continue;
    return img;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let batchSize = 25;
  let postIds: string[] | null = null;
  try {
    const body = await req.json();
    if (typeof body?.batch_size === "number") batchSize = Math.min(Math.max(body.batch_size, 1), 50);
    if (Array.isArray(body?.post_ids)) postIds = body.post_ids;
  } catch {
    // no body — defaults are fine
  }

  // Unresolved = no resolve_status yet, still a Google News link, not yet imported.
  // Newest first: those are the posts most worth surfacing quickly.
  const SELECT_FIELDS = "id, link, image_url, title, celeb_id, published_at, source_name";
  let query = supabase
    .from("external_posts")
    .select(SELECT_FIELDS)
    .is("resolve_status", null)
    .like("link", "%news.google.com%")
    .is("photo_id", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(batchSize);

  if (postIds) {
    query = supabase.from("external_posts").select(SELECT_FIELDS).in("id", postIds).limit(50);
  }

  const { data: posts, error } = await query;
  if (error) return json({ error: error.message }, 500);
  if (!posts || posts.length === 0) return json({ resolved: 0, failed: 0, message: "Nothing to resolve" });

  let resolved = 0;
  let noImage = 0;
  let failed = 0;
  let rateLimited = false;
  const results: Array<Record<string, unknown>> = [];

  for (const post of posts) {
    if (rateLimited) break;
    try {
      const publisherUrl = await decodeGoogleNewsUrl(post.link);
      const image = await scrapeArticleImage(publisherUrl);

      if (image) {
        await supabase
          .from("external_posts")
          .update({
            publisher_url: publisherUrl,
            image_url: image,
            resolve_status: "resolved",
            resolve_error: null,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", post.id);
        resolved++;

        // Auto-load into the Looks pipeline: a queued photo + AI clothing
        // ID, same as a manual Feed Inbox import. Still gated behind admin
        // publish (status stays 'queued') before it ever goes public.
        let photoId: string | null = null;
        if (post.celeb_id) {
          const { data: dupe } = await supabase
            .from("photos")
            .select("id")
            .eq("source_post_url", post.link)
            .limit(1)
            .maybeSingle();

          // Different articles (different source_post_url) very often
          // syndicate the exact same wire/press photo for the same
          // celebrity - dedupe on the image itself too, or the same look
          // shows up as multiple separate "looks".
          const { data: sameImage } = dupe
            ? { data: null }
            : await supabase
                .from("photos")
                .select("id")
                .eq("celeb_id", post.celeb_id)
                .eq("image_url", image)
                .limit(1)
                .maybeSingle();

          const existing = dupe ?? sameImage;

          if (!existing) {
            const { data: photo } = await supabase
              .from("photos")
              .insert({
                celeb_id: post.celeb_id,
                image_url: image,
                headline: post.title,
                source_url: publisherUrl,
                source_post_url: post.link,
                source_type: "feed",
                ingestion_source: post.source_name,
                taken_at: post.published_at,
                status: "queued",
                ai_status: "pending",
              })
              .select("id")
              .single();
            photoId = photo?.id ?? null;
          } else {
            photoId = existing.id;
          }

          if (photoId) {
            await supabase.from("external_posts").update({ photo_id: photoId }).eq("id", post.id);
            // AI runs via the analyze-photos cron (batch, rate-limit aware)
            // rather than firing here — this function can create far more
            // photos per run than that budget.
          }
        }

        results.push({ id: post.id, publisher_url: publisherUrl, image, photo_id: photoId });
      } else {
        // Real article found but no usable image — keep publisher_url, flag it
        await supabase
          .from("external_posts")
          .update({
            publisher_url: publisherUrl,
            resolve_status: "no_image",
            resolve_error: null,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", post.id);
        noImage++;
        results.push({ id: post.id, publisher_url: publisherUrl, image: null });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("rate limited") || msg.includes("429")) {
        // Leave resolve_status NULL so the next cron run retries; stop hammering now
        rateLimited = true;
        results.push({ id: post.id, error: msg, retry: true });
      } else {
        await supabase
          .from("external_posts")
          .update({ resolve_status: "error", resolve_error: msg.slice(0, 400) })
          .eq("id", post.id);
        failed++;
        results.push({ id: post.id, error: msg });
      }
    }
    // Be polite to Google — sequential with a small gap
    await new Promise((r) => setTimeout(r, 250));
  }

  return json({ resolved, no_image: noImage, failed, rate_limited: rateLimited, results });
});
