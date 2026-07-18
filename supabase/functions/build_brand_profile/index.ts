import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Seeds celebrity_brand_affinity with general-knowledge brand associations
// for a celebrity (source='ai_seed') — an educated-guess fallback for when
// a clothing item has no visible brand markings. Complements the
// 'observed' rows built from that celeb's own AI-tagged photos
// (refresh_observed_brand_affinity, run separately) - ai_seed exists so a
// brand-new celebrity with zero photos still has something to fall back on.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_CATEGORIES = new Set([
  "dress","top","jacket","coat","jeans","trousers","skirt",
  "shoes","trainers","boots","bag","sunglasses","jewellery",
  "suit","bodysuit","shorts","jumpsuit","hat","belt","scarf","other",
]);

function buildPrompt(name: string): string {
  return `You are a fashion researcher for a UK celebrity style website called Spotted.

For the celebrity "${name}", list clothing/accessory brands they are genuinely, specifically known to wear or be associated with — from public red carpet appearances, paparazzi photos, brand ambassadorships, or well-documented personal style, based on your training knowledge.

Be conservative and specific:
- Only include a brand if there is a real, fairly well-known association for that category (e.g. a repeated red carpet designer, a signature everyday brand, a known ambassador deal).
- Do NOT guess generically or invent associations you are not reasonably confident about.
- If you don't have any solid brand knowledge for this person, return an empty array [].
- Confidence should be realistic: 0.3-0.5 for "sometimes associated", 0.5-0.7 for "frequently seen in", 0.7-0.9 only for a well-documented signature/ambassador relationship. Never use 1.0.
- category must be exactly one of: dress, top, jacket, coat, jeans, trousers, skirt, shoes, trainers, boots, bag, sunglasses, jewellery, suit, bodysuit, shorts, jumpsuit, hat, belt, scarf
- Return at most 10 entries, most confident first.

Return ONLY a valid JSON array, no markdown, no explanation. Example:
[{"category":"bag","brand":"Chanel","confidence":0.6,"notes":"Frequently photographed with Chanel flap bags at events"},{"category":"trainers","brand":"New Balance","confidence":0.5,"notes":"Often seen off-duty in New Balance 990 series"}]`;
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody.slice(0, 800)}`);
  }
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini returned no content");
  return text;
}

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errBody.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  if (!text) throw new Error("Claude returned no content");
  return text;
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

  try {
    const { celeb_id } = await req.json();
    if (!celeb_id) return json({ error: "celeb_id is required" }, 400);

    const { data: celeb, error: celebError } = await supabase
      .from("celebrities")
      .select("id, name")
      .eq("id", celeb_id)
      .single();
    if (celebError || !celeb) return json({ error: "Celebrity not found" }, 404);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!geminiKey && !claudeKey) {
      return json({ skipped: true, reason: "No GEMINI_API_KEY or ANTHROPIC_API_KEY secret configured" });
    }

    const prompt = buildPrompt(celeb.name);
    let rawText: string;
    let provider: string;
    try {
      if (geminiKey) {
        rawText = await callGemini(geminiKey, prompt);
        provider = "gemini";
      } else {
        rawText = await callClaude(claudeKey!, prompt);
        provider = "claude";
      }
    } catch (primaryErr) {
      const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (geminiKey && claudeKey) {
        try {
          rawText = await callClaude(claudeKey, prompt);
          provider = "claude-fallback";
        } catch (fallbackErr) {
          const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          throw new Error(`Gemini failed (${primaryMsg}); Claude fallback also failed (${fallbackMsg})`);
        }
      } else {
        throw primaryErr;
      }
    }

    const parsed: unknown[] = JSON.parse(stripJsonFences(rawText));
    const rows = parsed
      .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
      .map((it) => ({
        category: String(it.category ?? "").toLowerCase(),
        brand: typeof it.brand === "string" ? it.brand.trim() : "",
        confidence: typeof it.confidence === "number" ? Math.min(Math.max(it.confidence, 0), 0.9) : 0.4,
        notes: typeof it.notes === "string" ? it.notes.slice(0, 300) : null,
      }))
      .filter((r) => VALID_CATEGORIES.has(r.category) && r.brand.length > 0)
      .slice(0, 10);

    // Replace this celeb's ai_seed rows so re-runs give a clean, current result.
    await supabase
      .from("celebrity_brand_affinity")
      .delete()
      .eq("celeb_id", celeb_id)
      .eq("source", "ai_seed");

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("celebrity_brand_affinity").insert(
        rows.map((r) => ({
          celeb_id,
          category: r.category,
          brand: r.brand,
          confidence: r.confidence,
          source: "ai_seed",
          evidence_count: 1,
          notes: r.notes,
        }))
      );
      if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
    }

    return json({ success: true, celeb_id, provider, brands_seeded: rows.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[build_brand_profile] Error:", msg);
    return json({ error: msg }, 500);
  }
});
