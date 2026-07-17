"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .single();

  if (!role) throw new Error("Not admin");
  return supabase;
}

export async function updateClothingItem(
  id: string,
  data: {
    category?: string;
    color?: string;
    description?: string;
    brand_guess?: string;
  }
) {
  const supabase = await requireAdmin();
  await supabase.from("clothing_items").update(data).eq("id", id);
  revalidatePath(`/admin/items/${id}`);
}

export async function addProductMatch(
  clothingItemId: string,
  data: {
    title: string;
    retailer: string;
    brand?: string;
    product_url: string;
    image_url?: string;
    price?: number;
    match_type: "exact" | "same_brand" | "similar";
  }
) {
  const supabase = await requireAdmin();

  // Create the product first, then link it to the item
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      title: data.title,
      retailer: data.retailer,
      brand: data.brand || null,
      product_url: data.product_url,
      image_url: data.image_url || null,
      price: data.price ?? null,
      currency: "GBP",
    })
    .select("id")
    .single();

  if (productError) throw new Error(productError.message);

  const { error: matchError } = await supabase.from("item_matches").insert({
    item_id: clothingItemId,
    product_id: product.id,
    match_type: data.match_type,
  });
  if (matchError) throw new Error(matchError.message);

  revalidatePath(`/admin/items/${clothingItemId}`);
}

export async function deleteProductMatch(matchId: string, clothingItemId: string) {
  const supabase = await requireAdmin();
  await supabase.from("item_matches").delete().eq("id", matchId);
  revalidatePath(`/admin/items/${clothingItemId}`);
}

export async function updateMatchedProduct(
  productId: string,
  clothingItemId: string,
  data: {
    title?: string;
    retailer?: string;
    brand?: string;
    product_url?: string;
    image_url?: string;
    price?: number;
  }
) {
  const supabase = await requireAdmin();
  await supabase.from("products").update(data).eq("id", productId);
  revalidatePath(`/admin/items/${clothingItemId}`);
}

export async function setPrimaryMatch(matchId: string, clothingItemId: string) {
  const supabase = await requireAdmin();
  await supabase
    .from("item_matches")
    .update({ is_primary: false })
    .eq("item_id", clothingItemId);
  await supabase
    .from("item_matches")
    .update({ is_primary: true })
    .eq("id", matchId);
  revalidatePath(`/admin/items/${clothingItemId}`);
}
