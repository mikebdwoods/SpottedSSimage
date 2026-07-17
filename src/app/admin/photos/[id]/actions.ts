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
    color?: string;
    description?: string;
    brand_guess?: string;
  }
) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("clothing_items").insert({
    photo_id: photoId,
    category: data.category,
    color: data.color || null,
    description: data.description || null,
    brand_guess: data.brand_guess || null,
    status: "live",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/photos/${photoId}`);
}

export async function deleteClothingItem(itemId: string, photoId: string) {
  const supabase = await requireAdmin();
  await supabase.from("item_matches").delete().eq("item_id", itemId);
  await supabase.from("clothing_items").delete().eq("id", itemId);
  revalidatePath(`/admin/photos/${photoId}`);
}
