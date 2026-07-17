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
  celeb_id: string;
  title: string;
  retailer?: string;
  price?: number;
  product_url: string;
  image_url?: string;
}) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("merch_products").insert({
    celeb_id: data.celeb_id,
    title: data.title,
    retailer: data.retailer || null,
    price: data.price ?? null,
    currency: "GBP",
    product_url: data.product_url,
    buy_url: data.product_url,
    image_url: data.image_url || null,
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
