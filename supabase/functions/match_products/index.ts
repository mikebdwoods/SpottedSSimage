import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Related category terms so e.g. a "trainers" item can match a product
// titled "sneakers".
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  trainers: ["trainers", "sneakers", "sneaker", "trainer"],
  shoes: ["shoes", "shoe", "heels", "sandals", "loafers", "flats", "pumps"],
  boots: ["boots", "boot", "chelsea", "ankle boot"],
  jacket: ["jacket", "bomber", "blazer", "biker"],
  coat: ["coat", "trench", "parka", "overcoat", "puffer"],
  jeans: ["jeans", "denim"],
  trousers: ["trousers", "pants", "chinos", "slacks"],
  top: ["top", "t-shirt", "tee", "shirt", "blouse", "jumper", "sweater", "hoodie", "cardigan", "polo"],
  dress: ["dress", "gown", "midi", "maxi"],
  skirt: ["skirt"],
  bag: ["bag", "tote", "handbag", "crossbody", "clutch", "backpack", "shoulder bag"],
  sunglasses: ["sunglasses", "shades"],
  jewellery: ["jewellery", "jewelry", "necklace", "earrings", "bracelet", "ring", "chain"],
  suit: ["suit", "tuxedo"],
  bodysuit: ["bodysuit"],
  shorts: ["shorts"],
  jumpsuit: ["jumpsuit", "playsuit"],
  hat: ["hat", "cap", "beanie", "bucket"],
  belt: ["belt"],
  scarf: ["scarf"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { item_id } = await req.json();
    if (!item_id) return json({ error: "item_id is required" }, 400);

    const { data: item, error: itemError } = await supabase
      .from("clothing_items")
      .select("id, category, brand_guess, color, description, photo_id, photos(celeb_id)")
      .eq("id", item_id)
      .single();

    if (itemError || !item) return json({ error: "Item not found" }, 404);

    // No visible brand markings — fall back to an educated guess from what
    // this celebrity is known to wear, rather than leaving brand blank.
    let inferredBrand: string | null = null;
    let inferredConfidence: number | null = null;
    const celebId = (item.photos as unknown as { celeb_id: string } | null)?.celeb_id;
    if (!item.brand_guess && celebId) {
      let affinityQuery = supabase
        .from("celebrity_brand_affinity")
        .select("brand, confidence, category")
        .eq("celeb_id", celebId);
      affinityQuery = item.category
        ? affinityQuery.or(`category.eq.${item.category},category.is.null`)
        : affinityQuery.is("category", null);
      const { data: affinity } = await affinityQuery
        .order("confidence", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (affinity) {
        inferredBrand = affinity.brand;
        inferredConfidence = affinity.confidence;
        await supabase
          .from("clothing_items")
          .update({ inferred_brand: inferredBrand, inferred_brand_confidence: inferredConfidence })
          .eq("id", item_id);
      }
    }

    // Skip if the item already has matches (idempotent for cron re-runs)
    const { count: existing } = await supabase
      .from("item_matches")
      .select("id", { count: "exact", head: true })
      .eq("item_id", item_id);
    if ((existing ?? 0) > 0) {
      return json({ skipped: true, reason: "item already has matches" });
    }

    const { data: products } = await supabase
      .from("products")
      .select("id, title, brand, retailer, price")
      .limit(500);

    const categoryTerms = CATEGORY_SYNONYMS[item.category ?? ""] ?? (item.category ? [item.category] : []);
    const brand = (item.brand_guess ?? "").toLowerCase().trim();
    const guessBrand = (inferredBrand ?? "").toLowerCase().trim();
    const color = (item.color ?? "").toLowerCase().trim();

    const scored = (products ?? [])
      .map((p) => {
        const title = (p.title ?? "").toLowerCase();
        const pBrand = (p.brand ?? "").toLowerCase();
        const categoryHit = categoryTerms.some((t) => title.includes(t));
        const brandHit = !!brand && (pBrand.includes(brand) || title.includes(brand));
        // Only consider the celebrity-style guess when there's no real
        // brand_guess to begin with - it's a fallback, not a competitor.
        const guessHit = !brandHit && !!guessBrand && (pBrand.includes(guessBrand) || title.includes(guessBrand));
        const colorHit = !!color && title.includes(color);

        let score = 0;
        if (categoryHit) score += 2;
        if (brandHit) score += 3;
        if (guessHit) score += 1.5 * (inferredConfidence ?? 0.5);
        if (colorHit) score += 1;

        return { product: p, score, categoryHit, brandHit, guessHit };
      })
      // Require at least a category, brand, or celebrity-style-guess
      // connection - never match on colour alone.
      .filter((s) => s.categoryHit || s.brandHit || s.guessHit)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const createdMatches: string[] = [];
    for (let i = 0; i < scored.length; i++) {
      const { product, score, categoryHit, brandHit, guessHit } = scored[i];
      const matchType =
        brandHit && categoryHit ? "exact" : brandHit ? "same_brand" : guessHit ? "celebrity_style_guess" : "similar";
      const { data: match } = await supabase
        .from("item_matches")
        .insert({
          item_id: item.id,
          product_id: product.id,
          match_type: matchType,
          score: Math.min(score / 6, 1),
          is_primary: i === 0,
        })
        .select("id")
        .single();
      if (match) createdMatches.push(match.id);
    }

    return json({
      success: true,
      item_id,
      matches_created: createdMatches.length,
      inferred_brand: inferredBrand,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[match_products] Error:", msg);
    return json({ error: msg }, 500);
  }
});
