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

function fireAI(photoId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return;

  fetch(`${baseUrl}/api/process-photo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ photo_id: photoId }),
  }).catch(() => {});
}

export async function importExternalPost(postId: string, runAI: boolean) {
  const supabase = await requireAdmin();

  const { data: post, error: postError } = await supabase
    .from("external_posts")
    .select("id, celeb_id, image_url, title, link, publisher_url, published_at, source_name, photo_id")
    .eq("id", postId)
    .single();

  if (postError || !post) throw new Error(postError?.message ?? "Post not found");
  if (post.photo_id) throw new Error("Already imported");
  if (!post.image_url) throw new Error("Post has no image");

  const { data: photo, error: insertError } = await supabase
    .from("photos")
    .insert({
      celeb_id: post.celeb_id,
      image_url: post.image_url,
      headline: post.title,
      source_url: post.publisher_url || post.link,
      source_post_url: post.link,
      source_type: "feed",
      ingestion_source: post.source_name,
      taken_at: post.published_at,
      status: "queued",
      ai_status: "pending",
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  await supabase
    .from("external_posts")
    .update({ photo_id: photo.id })
    .eq("id", postId);

  if (runAI) fireAI(photo.id);

  revalidatePath("/admin/feed");
  revalidatePath("/admin/photos");
  return photo.id;
}

export async function importExternalPostBatch(postIds: string[], runAI: boolean) {
  const supabase = await requireAdmin();
  let imported = 0;

  for (const postId of postIds) {
    const { data: post } = await supabase
      .from("external_posts")
      .select("id, celeb_id, image_url, title, link, publisher_url, published_at, source_name, photo_id")
      .eq("id", postId)
      .single();

    if (!post || post.photo_id || !post.image_url) continue;

    const { data: photo, error: insertError } = await supabase
      .from("photos")
      .insert({
        celeb_id: post.celeb_id,
        image_url: post.image_url,
        headline: post.title,
        source_url: post.publisher_url || post.link,
        source_post_url: post.link,
        source_type: "feed",
        ingestion_source: post.source_name,
        taken_at: post.published_at,
        status: "queued",
        ai_status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !photo) continue;

    await supabase
      .from("external_posts")
      .update({ photo_id: photo.id })
      .eq("id", postId);

    if (runAI) fireAI(photo.id);
    imported++;
  }

  revalidatePath("/admin/feed");
  revalidatePath("/admin/photos");
  return imported;
}
