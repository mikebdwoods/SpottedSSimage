import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.3.6";

// Top-of-funnel content collection: reads each celebrity's enabled RSS/Atom
// sources and inserts genuinely new, relevant articles into external_posts
// (status: 'queued'), where resolve_articles later decodes the real photo
// and analyze_photo tags it.
//
// Rebuilt 2026-07-19 from two half-working predecessors found live but
// broken: the old `rss_ingest` called a `/enqueue` sub-route on the `ingest`
// function that doesn't exist in its code (guaranteed 400 on every item),
// and `ingest` itself used `.upsert(..., {onConflict: 'celeb_id,link'})`
// against a table with no matching unique constraint (guaranteed Postgres
// 42P10 on first write). Neither had ever successfully written a row - the
// cron had been failing on an unrelated auth bug for even longer, so this
// had gone unnoticed. This version is self-contained: no sub-call, no
// upsert-onConflict - a plain existence check before insert, same pattern
// already proven in resolve_articles.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

interface FeedEntry {
  title: string;
  link: string;
  publishedAt: string | null;
  imageUrl: string | null;
}

/** Parse RSS 2.0 or Atom XML into a flat list of entries. */
function parseFeed(xmlText: string): FeedEntry[] {
  // deno-lint-ignore no-explicit-any
  let data: any;
  try {
    data = xmlParser.parse(xmlText || "");
  } catch {
    return [];
  }

  // deno-lint-ignore no-explicit-any
  let nodes: any[] = [];
  if (data?.rss?.channel?.item) {
    nodes = Array.isArray(data.rss.channel.item) ? data.rss.channel.item : [data.rss.channel.item];
  } else if (data?.feed?.entry) {
    nodes = Array.isArray(data.feed.entry) ? data.feed.entry : [data.feed.entry];
  }

  // deno-lint-ignore no-explicit-any
  const pickLink = (i: any): string => {
    if (!i?.link) return (i?.guid?.["#text"] || i?.guid || "") as string;
    if (typeof i.link === "string") return i.link;
    const arr = Array.isArray(i.link) ? i.link : [i.link];
    const alt = arr.find((l: { rel?: string; href?: string }) => (l?.rel || "alternate") === "alternate" && l?.href);
    return (alt?.href || arr[0]?.href || i?.guid?.["#text"] || i?.guid || "") as string;
  };

  // deno-lint-ignore no-explicit-any
  const pickImage = (i: any): string | null => {
    if (i?.["media:content"]?.url) return i["media:content"].url;
    if (i?.["media:thumbnail"]?.url) return i["media:thumbnail"].url;
    if (i?.enclosure?.url) return i.enclosure.url;
    if (i?.["itunes:image"]?.href) return i["itunes:image"].href;
    return null;
  };

  return nodes.map((i) => ({
    title: (i?.title?.["#text"] ?? i?.title ?? "").toString().trim(),
    link: pickLink(i),
    publishedAt: (i?.pubDate ?? i?.published ?? i?.updated ?? null) as string | null,
    imageUrl: pickImage(i),
  }));
}

function toIsoDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Within the last N hours - or undated, which we give the benefit of the doubt. */
function isRecent(dateStr: string | null, hours: number): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  return (Date.now() - d.getTime()) / 3_600_000 <= hours;
}

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Best-effort og:image fallback when the feed entry itself has no image. */
async function extractOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, 8000, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) return null;
    const html = await res.text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let sourceLimit = 20;
  try {
    const body = await req.json();
    if (typeof body?.source_limit === "number") sourceLimit = Math.min(Math.max(body.source_limit, 1), 60);
  } catch {
    // defaults are fine
  }

  const { data: sources, error: sourcesError } = await supabase
    .from("celeb_sources")
    .select("id, celeb_id, endpoint_url, source_name, celebrities(slug, name)")
    .eq("endpoint_type", "rss")
    .eq("enabled", true)
    .limit(sourceLimit);

  if (sourcesError) return json({ error: sourcesError.message }, 500);
  if (!sources || sources.length === 0) return json({ sources_checked: 0, inserted: 0, message: "No RSS sources found" });

  let sourcesChecked = 0;
  let itemsParsed = 0;
  let inserted = 0;
  let skipped = 0;
  const errors: Array<{ source: string; error: string }> = [];

  for (const source of sources) {
    sourcesChecked++;
    // deno-lint-ignore no-explicit-any
    const celebData = source.celebrities as any;
    const celebSlug: string | undefined = celebData?.slug;
    const celebName: string | undefined = celebData?.name;
    if (!celebSlug || !celebName) continue;

    try {
      const res = await fetchWithTimeout(source.endpoint_url, 10000, { headers: { "User-Agent": BROWSER_UA } });
      if (!res.ok) {
        errors.push({ source: source.endpoint_url, error: `HTTP ${res.status}` });
        continue;
      }
      const xmlText = await res.text();
      const entries = parseFeed(xmlText);
      itemsParsed += entries.length;

      // Site-wide feeds (not a per-celebrity URL) need a name match so one
      // shared feed doesn't flood every celebrity's queue with irrelevant news.
      const isPerCelebFeed = source.endpoint_url.toLowerCase().includes(celebSlug.toLowerCase());

      for (const entry of entries) {
        if (!entry.link) continue;
        if (!isRecent(entry.publishedAt, 72)) {
          skipped++;
          continue;
        }
        if (!isPerCelebFeed) {
          const haystack = entry.title.toLowerCase();
          if (!haystack.includes(celebName.toLowerCase())) {
            skipped++;
            continue;
          }
        }

        const { data: existing } = await supabase
          .from("external_posts")
          .select("id")
          .eq("celeb_id", source.celeb_id)
          .eq("link", entry.link)
          .limit(1)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        let imageUrl = entry.imageUrl;
        if (!imageUrl) imageUrl = await extractOgImage(entry.link);

        const { error: insertError } = await supabase.from("external_posts").insert({
          celeb_id: source.celeb_id,
          source_name: source.source_name,
          endpoint_url: source.endpoint_url,
          link: entry.link,
          title: entry.title || null,
          published_at: toIsoDate(entry.publishedAt),
          image_url: imageUrl,
          status: "queued",
        });

        if (insertError) {
          skipped++;
        } else {
          inserted++;
        }
      }
    } catch (err) {
      errors.push({ source: source.endpoint_url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return json({ sources_checked: sourcesChecked, items_parsed: itemsParsed, inserted, skipped, errors });
});
