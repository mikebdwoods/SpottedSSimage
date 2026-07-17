import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Only callable server-side with the internal secret
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

const AI_PROMPT = `You are a fashion analyst for a UK celebrity outfit discovery website called Spotted.

Analyse this celebrity photo and identify every distinct clothing item and accessory that is clearly visible.

For each item return:
- category: exactly one of [dress, top, jacket, coat, jeans, trousers, skirt, shoes, trainers, boots, bag, sunglasses, jewellery, suit, bodysuit, shorts, jumpsuit, hat, belt, scarf, other]
- color: the primary colour in plain English, lowercase (e.g. "black", "white", "navy", "red", "beige", "camel", "emerald green")
- brand_guess: the brand name if identifiable from logos or distinctive design details, otherwise null
- description: 1–2 concise sentences describing the garment's style, cut, fabric, and any notable details that would help someone find a similar item

Guidelines:
- Identify 3–8 items typically (more for a full outfit, fewer for a close-up)
- Only include items that are clearly visible, not partially hidden
- Be specific — "fitted black ribbed polo neck top" is better than "black top"
- For jewellery, describe the type (e.g. "gold hoop earrings", "layered gold chain necklace")
- For bags, describe the silhouette and hardware (e.g. "structured black leather tote with gold chain strap")

Return ONLY a valid JSON array. No markdown, no explanation, no code blocks. Example:
[{"category":"dress","color":"black","brand_guess":"Versace","description":"Floor-length black satin slip dress with thin spaghetti straps and thigh-high side split."},{"category":"shoes","color":"silver","brand_guess":null,"description":"Strappy silver stiletto heeled sandals with wrap-around ankle ties."}]`;

interface ClothingItem {
  category: string;
  color: string | null;
  brand_guess: string | null;
  description: string | null;
}

const VALID_CATEGORIES = new Set([
  "dress","top","jacket","coat","jeans","trousers","skirt",
  "shoes","trainers","boots","bag","sunglasses","jewellery",
  "suit","bodysuit","shorts","jumpsuit","hat","belt","scarf","other",
]);

function normaliseItems(raw: unknown[]): ClothingItem[] {
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      category: VALID_CATEGORIES.has(String(item.category ?? "").toLowerCase())
        ? String(item.category).toLowerCase()
        : "other",
      color: typeof item.color === "string" ? item.color.toLowerCase() : null,
      brand_guess: typeof item.brand_guess === "string" ? item.brand_guess : null,
      description: typeof item.description === "string" ? item.description : null,
    }));
}

export async function POST(req: NextRequest) {
  // Verify internal secret
  const auth = req.headers.get("authorization");
  if (!INTERNAL_SECRET || auth !== `Bearer ${INTERNAL_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { photo_id } = await req.json();
  if (!photo_id) {
    return NextResponse.json({ error: "photo_id required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Mark as processing
  await supabase
    .from("photos")
    .update({ ai_status: "processing", ai_summary: null })
    .eq("id", photo_id);

  let imageBase64: string;
  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  try {
    // Fetch the photo record
    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .select("image_url")
      .eq("id", photo_id)
      .single();

    if (photoError || !photo) {
      throw new Error(`Photo not found: ${photoError?.message}`);
    }

    const imageUrl = photo.image_url;
    if (!imageUrl) throw new Error("Photo has no image URL");

    // Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    if (contentType.includes("png")) mediaType = "image/png";
    else if (contentType.includes("webp")) mediaType = "image/webp";
    else if (contentType.includes("gif")) mediaType = "image/gif";
    else mediaType = "image/jpeg";

    const arrayBuffer = await imgRes.arrayBuffer();
    imageBase64 = Buffer.from(arrayBuffer).toString("base64");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("photos")
      .update({ ai_status: "error", ai_summary: msg })
      .eq("id", photo_id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    // Call Claude Vision
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: AI_PROMPT,
            },
          ],
        },
      ],
    });

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Parse JSON — strip any accidental markdown fences
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed: unknown[] = JSON.parse(jsonText);
    const items = normaliseItems(parsed);

    if (items.length === 0) throw new Error("AI returned no clothing items");

    // Replace existing clothing items so re-runs give a clean result.
    // Delete their matches first to satisfy foreign keys.
    const { data: oldItems } = await supabase
      .from("clothing_items")
      .select("id")
      .eq("photo_id", photo_id);

    if (oldItems && oldItems.length > 0) {
      const oldIds = oldItems.map((i) => i.id);
      await supabase.from("item_matches").delete().in("item_id", oldIds);
      await supabase.from("clothing_items").delete().in("id", oldIds);
    }

    // Insert new items
    const { error: insertError } = await supabase.from("clothing_items").insert(
      items.map((item) => ({
        photo_id,
        category: item.category,
        color: item.color,
        brand_guess: item.brand_guess,
        description: item.description,
        confidence: 0.85,
        status: "draft",
      }))
    );

    if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

    // Mark done
    await supabase
      .from("photos")
      .update({
        ai_status: "done",
        ai_summary: `Identified ${items.length} item${items.length === 1 ? "" : "s"}`,
      })
      .eq("id", photo_id);

    return NextResponse.json({ success: true, items_found: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("photos")
      .update({ ai_status: "error", ai_summary: msg })
      .eq("id", photo_id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
