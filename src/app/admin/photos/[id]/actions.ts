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

export async function addClothingItem(
  photoId: string,
  data: {
    category: string;
    colour?: string;
    style_description?: string;
    estimated_brand?: string;
    sort_order?: number;
  }
) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("clothing_items").insert({
    photo_id: photoId,
    category: data.category,
    colour: data.colour || null,
    style_description: data.style_description || null,
    estimated_brand: data.estimated_brand || null,
    sort_order: data.sort_order ?? 0,
    ai_confidence: null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/photos/${photoId}`);
}

export async function deleteClothingItem(itemId: string, photoId: string) {
  const supabase = await requireAdmin();
  await supabase.from("clothing_items").delete().eq("id", itemId);
  revalidatePath(`/admin/photos/${photoId}`);
}
