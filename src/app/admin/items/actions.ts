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
    colour?: string;
    style_description?: string;
    estimated_brand?: string;
  }
) {
  const supabase = await requireAdmin();
  await supabase.from("clothing_items").update(data).eq("id", id);
  revalidatePath(`/admin/items/${id}`);
}

export async function addProductMatch(
  clothingItemId: string,
  data: {
    product_name: string;
    retailer_name: string;
    product_url: string;
    affiliate_url?: string;
    image_url?: string;
    price_gbp?: number;
    price_tier: "budget" | "mid" | "premium";
    match_type: "exact" | "same_brand" | "similar";
    sort_order?: number;
  }
) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("product_matches").insert({
    clothing_item_id: clothingItemId,
    ...data,
    affiliate_url: data.affiliate_url || null,
    image_url: data.image_url || null,
    sort_order: data.sort_order ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/items/${clothingItemId}`);
}

export async function deleteProductMatch(id: string, clothingItemId: string) {
  const supabase = await requireAdmin();
  await supabase.from("product_matches").delete().eq("id", id);
  revalidatePath(`/admin/items/${clothingItemId}`);
}

export async function updateProductMatch(
  id: string,
  clothingItemId: string,
  data: {
    product_name?: string;
    retailer_name?: string;
    product_url?: string;
    affiliate_url?: string;
    image_url?: string;
    price_gbp?: number;
    price_tier?: "budget" | "mid" | "premium";
    match_type?: "exact" | "same_brand" | "similar";
  }
) {
  const supabase = await requireAdmin();
  await supabase.from("product_matches").update(data).eq("id", id);
  revalidatePath(`/admin/items/${clothingItemId}`);
}
