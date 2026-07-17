"use server";

import { redirect } from "next/navigation";
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
  return { supabase, user };
}

export async function setPhotoStatus(photoId: string, status: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("photos").update({ status }).eq("id", photoId);
  revalidatePath("/admin/photos");
  revalidatePath("/");
}

export async function triggerAI(photoId: string) {
  await requireAdmin();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const secret = process.env.INTERNAL_API_SECRET!;

  // Fire-and-forget — ai_status tracks progress in DB
  fetch(`${baseUrl}/api/process-photo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ photo_id: photoId }),
  }).catch(() => {});

  revalidatePath("/admin/photos");
}

export async function deletePhoto(photoId: string) {
  const { supabase } = await requireAdmin();
  // Delete matches, then items, then the photo (explicit FK order)
  const { data: items } = await supabase
    .from("clothing_items")
    .select("id")
    .eq("photo_id", photoId);
  if (items && items.length > 0) {
    const ids = items.map((i) => i.id);
    await supabase.from("item_matches").delete().in("item_id", ids);
    await supabase.from("clothing_items").delete().in("id", ids);
  }
  await supabase.from("photos").delete().eq("id", photoId);
  revalidatePath("/admin/photos");
  revalidatePath("/");
  redirect("/admin/photos");
}

export async function batchPublish(photoIds: string[]) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("photos")
    .update({ status: "live" })
    .in("id", photoIds);
  revalidatePath("/admin/photos");
  revalidatePath("/");
}

export async function triggerAIBatch(photoIds: string[]) {
  await requireAdmin();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const secret = process.env.INTERNAL_API_SECRET!;

  for (const photoId of photoIds) {
    fetch(`${baseUrl}/api/process-photo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ photo_id: photoId }),
    }).catch(() => {});
  }

  revalidatePath("/admin/photos");
}
