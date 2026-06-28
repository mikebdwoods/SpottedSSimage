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

export async function addMerch(data: {
  celebrity_id: string;
  name: string;
  description?: string;
  price_gbp?: number;
  product_url: string;
  image_url?: string;
}) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("merch_products").insert({
    ...data,
    description: data.description || null,
    image_url: data.image_url || null,
    price_gbp: data.price_gbp ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/merch");
  revalidatePath("/");
}

export async function deleteMerch(id: string) {
  const supabase = await requireAdmin();
  await supabase.from("merch_products").delete().eq("id", id);
  revalidatePath("/admin/merch");
  revalidatePath("/");
}
