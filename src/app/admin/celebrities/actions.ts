"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

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

export async function addCelebrity(formData: FormData) {
  const supabase = await requireAdmin();

  const name = formData.get("name") as string;
  const bio = formData.get("bio") as string;
  const imageFile = formData.get("image") as File | null;
  let imageUrl: string | null = null;

  if (imageFile && imageFile.size > 0) {
    const ext = imageFile.name.split(".").pop();
    const filename = `celebrities/${crypto.randomUUID()}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("photos")
      .upload(filename, imageFile, { contentType: imageFile.type });

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("photos").getPublicUrl(uploadData.path);
      imageUrl = publicUrl;
    }
  }

  const slug = slugify(name);

  await supabase.from("celebrities").insert({
    name,
    slug,
    bio: bio || null,
    photo_url: imageUrl,
    status: "published",
  });

  revalidatePath("/admin/celebrities");
  revalidatePath("/");
}

export async function updateCelebrity(id: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = formData.get("name") as string;
  const bio = formData.get("bio") as string;
  const imageFile = formData.get("image") as File | null;

  const { data: current } = await supabase
    .from("celebrities")
    .select("slug")
    .eq("id", id)
    .single();

  const updates: Record<string, string | null> = {
    name,
    bio: bio || null,
  };

  if (imageFile && imageFile.size > 0) {
    const ext = imageFile.name.split(".").pop();
    const filename = `celebrities/${crypto.randomUUID()}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("photos")
      .upload(filename, imageFile, { contentType: imageFile.type });

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("photos").getPublicUrl(uploadData.path);
      updates.photo_url = publicUrl;
    }
  }

  await supabase.from("celebrities").update(updates).eq("id", id);

  revalidatePath("/admin/celebrities");
  revalidatePath(`/admin/celebrities/${id}`);
  if (current?.slug) revalidatePath(`/celebrity/${current.slug}`);
  revalidatePath("/");
}

export async function deleteCelebrity(id: string) {
  const supabase = await requireAdmin();
  // admin_delete_celebrity cleans up photos, merch, and homepage rows too
  const { error } = await supabase.rpc("admin_delete_celebrity", { p_celeb: id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/celebrities");
  revalidatePath("/");
}

export async function setCelebrityStatus(id: string, publish: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc(publish ? "publish_celeb" : "unpublish_celeb", {
    _id: id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/celebrities");
  revalidatePath(`/admin/celebrities/${id}`);
  revalidatePath("/");
}
