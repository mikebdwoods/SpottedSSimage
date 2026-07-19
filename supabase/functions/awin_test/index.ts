import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Temporary diagnostic function - confirms AWIN_API_TOKEN / AWIN_PUBLISHER_ID
// are set and the token works, and lists joined programmes (merchants) so we
// know what's actually available to sync. Delete once sync_products exists.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  async function fetchOne(url: string) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      const text = await res.text();
      const ogImage = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
      const ogTitle = text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
      const title = ogTitle ?? text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
      // Prefer structured price meta (og:price:amount, itemprop=price, JSON-LD
      // "priceCurrency"-adjacent) over a bare "price" grep, which false-matches
      // on unrelated numbers like delivery cost mentions.
      const priceMatch =
        text.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i) ??
        text.match(/itemprop=["']price["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i) ??
        text.match(/"priceCurrency"\s*:\s*"GBP"\s*,\s*"price"\s*:\s*"?([0-9]+(?:\.[0-9]{2})?)/i) ??
        text.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]{2})?)"?\s*,\s*"priceCurrency"\s*:\s*"GBP"/i);
      // Jina Reader (r.jina.ai) returns markdown, not HTML - parse its shape
      if (url.includes("r.jina.ai/")) {
        const mdTitle = text.match(/^Title:\s*(.+)$/m)?.[1];
        const mdImage = text.match(/!\[[^\]]*\]\((https?:[^)\s]+)\)/)?.[1];
        const mdPrice = text.match(/£\s?([0-9]+(?:\.[0-9]{2})?)/)?.[1];
        return {
          url,
          status: res.status,
          ogImage: ogImage ?? mdImage,
          title: title ?? mdTitle,
          price: priceMatch?.[1] ?? mdPrice,
          snippet: text.slice(0, 600),
        };
      }
      return { url, status: res.status, ogImage, title, price: priceMatch?.[1] };
    } catch (err) {
      return { url, error: err instanceof Error ? err.message : String(err) };
    }
  }

  try {
    const body = await req.clone().json();
    if (typeof body?.gemini_search_test === "string") {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) return json({ error: "Missing GEMINI_API_KEY" }, 400);
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      // Grounded search calls can run past pg_net's 5s wait - write the
      // result to a table so it can be polled instead of relying on the
      // synchronous HTTP response. waitUntil keeps the isolate alive past
      // the returned response.
      const task = (async () => {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: body.gemini_search_test }] }],
                tools: [{ google_search: {} }],
              }),
            }
          );
          const data = await res.json();
          await supabase.from("debug_log").insert({ label: "gemini_search_test", payload: { status: res.status, data } });
        } catch (err) {
          await supabase.from("debug_log").insert({
            label: "gemini_search_test",
            payload: { error: err instanceof Error ? err.message : String(err) },
          });
        }
      })();
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil(task);
      return json({ started: true });
    }
    if (body?.claude_test === true) {
      const key = Deno.env.get("ANTHROPIC_API_KEY");
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      if (!key) {
        await supabase.from("debug_log").insert({ label: "claude_test", payload: { error: "no ANTHROPIC_API_KEY set" } });
        return json({ error: "no ANTHROPIC_API_KEY set" }, 400);
      }
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 10,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        const text = await res.text();
        await supabase.from("debug_log").insert({ label: "claude_test", payload: { status: res.status, body: text.slice(0, 1000) } });
        return json({ status: res.status, body: text.slice(0, 1000) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase.from("debug_log").insert({ label: "claude_test", payload: { error: msg } });
        return json({ error: msg }, 500);
      }
    }
    if (Array.isArray(body?.fetch_urls)) {
      const results = [];
      for (const url of body.fetch_urls.slice(0, 15)) {
        results.push(await fetchOne(url));
        await new Promise((r) => setTimeout(r, 150));
      }
      // Also persist to debug_log - slow fetches outlive pg_net's 5s wait,
      // so the synchronous response is often lost to the caller.
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("debug_log").insert({ label: "fetch_urls", payload: { results } });
      return json({ results });
    }
    if (typeof body?.fetch_url === "string") {
      const result = await fetchOne(body.fetch_url);
      const res = await fetch(body.fetch_url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      });
      const text = await res.text();
      const allHrefs = Array.from(new Set(Array.from(text.matchAll(/href="([^"#]+)"/gi)).map((m) => m[1])));
      const filterTerm = typeof body?.link_filter === "string" ? body.link_filter.toLowerCase() : null;
      const links = (filterTerm ? allHrefs.filter((h) => h.toLowerCase().includes(filterTerm)) : allHrefs).slice(0, 60);
      return json({ ...result, total_links: allHrefs.length, links });
    }
  } catch {
    // fall through to existing behaviour
  }

  let overridePublisherId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.publisher_id_override === "string") overridePublisherId = body.publisher_id_override;
  } catch {
    // no body
  }

  const token = Deno.env.get("AWIN_API_TOKEN");
  const publisherId = overridePublisherId ?? Deno.env.get("AWIN_PUBLISHER_ID");

  if (!token) {
    return json({ error: "Missing AWIN_API_TOKEN" }, 400);
  }

  try {
    // No publisher ID yet - discover the account(s) this token belongs to.
    const accountsRes = await fetch("https://api.awin.com/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const accountsText = await accountsRes.text();
    let accounts: unknown;
    try {
      accounts = JSON.parse(accountsText);
    } catch {
      accounts = accountsText.slice(0, 2000);
    }

    let programmes: unknown = null;
    if (publisherId) {
      const res = await fetch(`https://api.awin.com/publishers/${publisherId}/programmes?relationship=joined`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      try {
        programmes = { status: res.status, body: JSON.parse(text) };
      } catch {
        programmes = { status: res.status, body: text.slice(0, 2000) };
      }
    }

    return json({
      has_publisher_id: !!publisherId,
      accounts_status: accountsRes.status,
      accounts,
      programmes,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
