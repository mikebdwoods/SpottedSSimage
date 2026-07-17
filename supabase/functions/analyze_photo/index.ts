import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_CATEGORIES = new Set([
  "dress","top","jacket","coat","jeans","trousers","skirt",
  "shoes","trainers","boots","bag","sunglasses","jewellery",
  "suit","bodysuit","shorts","jumpsuit","hat","belt","scarf","other",
]);

const AI_PROMPT = `You are a fashion analyst for a UK celebrity outfit discovery website called Spotted.

Analyse this celebrity photo and identify every distinct clothing item and accessory that is clearly visible.

For each item return:
- category: exactly one of [dress, top, jacket, coat, jeans, trousers, skirt, shoes, trainers, boots, bag, sunglasses, jewellery, suit, bodysuit, shorts, jumpsuit, hat, belt, scarf, other]
- color: the primary colour in plain English, lowercase (e.g. "black", "white", "navy", "red", "beige", "camel", "emerald green")
- brand_guess: the brand name if identifiable from logos or distinctive design details, otherwise null
- description: 1-2 concise sentences describing the garment's style, cut, fabric, and any notable details that would help someone find a similar item

Guidelines:
- Identify 3-8 items typically (more for a full outfit, fewer for a close-up)
- Only include items that are clearly visible, not partially hidden
- Be specific - "fitted black ribbed polo neck top" is better than "black top"
- If the image does not clearly show a person's outfit (e.g. a logo, a crowd shot, an album cover), return an empty array []

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks. Example:
[{"category":"dress","color":"black","brand_guess":"Versace","description":"Floor-length black satin slip dress with thin spaghetti straps and thigh-high side split."}]`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
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

  let photoId: string | null = null;

  try {
    const { photo_id } = await req.json();
    if (!photo_id) return json({ error: "photo_id is required" }, 400);
    photoId = photo_id;

    // Load photo and gate on pending so cron + manual calls never double-process
    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .select("id, image_url, ai_status")
      .eq("id", photo_id)
      .single();

    if (photoError || !photo) return json({ error: "Photo not found" }, 404);
    if (photo.ai_status !== "pending") {
      return json({ skipped: true, reason: `ai_status is ${photo.ai_status}` });
    }
    if (!photo.image_url) {
      await supabase.from("photos").update({ ai_status: "error", ai_summary: "Photo has no image URL" }).eq("id", photo_id);
      return json({ error: "Photo has no image URL" }, 422);
    }

    // Without an API key, leave the photo pending so it is retried once the
    // ANTHROPIC_API_KEY secret is configured - never invent placeholder data.
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.log("[analyze_photo] ANTHROPIC_API_KEY not set - leaving photo pending");
      return json({ skipped: true, reason: "ANTHROPIC_API_KEY secret not configured" });
    }

    await supabase.from("photos").update({ ai_status: "processing", ai_summary: null }).eq("id", photo_id);

    // Download the image
    const imgRes = await fetch(photo.image_url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SpottedBot/1.0)" },
    });
    if (!imgRes.ok) throw new Error(`Failed to fetch image: HTTP ${imgRes.status}`);

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    let mediaType = "image/jpeg";
    if (contentType.includes("png")) mediaType = "image/png";
    else if (contentType.includes("webp")) mediaType = "image/webp";
    else if (contentType.includes("gif")) mediaType = "image/gif";

    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error("Image too large");
    const imageBase64 = bytesToBase64(bytes);

    // Call Claude Vision
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: AI_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      throw new Error(`Claude API error ${aiRes.status}: ${errBody.slice(0, 300)}`);
    }

    const aiData = await aiRes.json();
    const rawText = (aiData.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");

    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed: unknown[] = JSON.parse(jsonText);

    const items = parsed
      .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
      .map((it) => ({
        category: VALID_CATEGORIES.has(String(it.category ?? "").toLowerCase())
          ? String(it.category).toLowerCase()
          : "other",
        color: typeof it.color === "string" ? it.color.toLowerCase() : null,
        brand_guess: typeof it.brand_guess === "string" ? it.brand_guess : null,
        description: typeof it.description === "string" ? it.description : null,
      }));

    // Replace any existing items for a clean result
    const { data: oldItems } = await supabase.from("clothing_items").select("id").eq("photo_id", photo_id);
    if (oldItems && oldItems.length > 0) {
      const oldIds = oldItems.map((i: { id: string }) => i.id);
      await supabase.from("item_matches").delete().in("item_id", oldIds);
      await supabase.from("clothing_items").delete().in("id", oldIds);
    }

    const createdItemIds: string[] = [];
    for (const item of items) {
      const { data: inserted } = await supabase
        .from("clothing_items")
        .insert({
          photo_id,
          category: item.category,
          color: item.color,
          brand_guess: item.brand_guess,
          description: item.description,
          confidence: 0.85,
          status: "draft",
        })
        .select("id")
        .single();
      if (inserted) createdItemIds.push(inserted.id);
    }

    const summary =
      items.length === 0
        ? "No clearly visible outfit in this image"
        : `Identified ${items.length} item${items.length === 1 ? "" : "s"}: ${items.map((i) => i.category).join(", ")}`;

    await supabase.from("photos").update({ ai_status: "done", ai_summary: summary }).eq("id", photo_id);

    return json({ success: true, photo_id, created_item_ids: createdItemIds, summary });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[analyze_photo] Error:", msg);
    if (photoId) {
      await supabase.from("photos").update({ ai_status: "error", ai_summary: msg.slice(0, 500) }).eq("id", photoId);
    }
    return json({ error: msg }, 500);
  }
});
