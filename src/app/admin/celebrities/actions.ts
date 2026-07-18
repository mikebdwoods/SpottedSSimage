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

// Fire-and-forget: seeds celebrity_brand_affinity from general knowledge so
// even a celeb with zero photos has an educated-guess brand fallback for
// product matching. 'observed' rows build up separately as their photos
// get AI-tagged (refresh_observed_brand_affinity).
function fireBuildBrandProfile(celebId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return;

  fetch(`${baseUrl}/functions/v1/build_brand_profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ celeb_id: celebId }),
  }).catch(() => {});
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

  const { data: celeb } = await supabase
    .from("celebrities")
    .insert({
      name,
      slug,
      bio: bio || null,
      photo_url: imageUrl,
      status: "published",
    })
    .select("id")
    .single();

  if (celeb) fireBuildBrandProfile(celeb.id);

  revalidatePath("/admin/celebrities");
  revalidatePath("/");
}

export async function rebuildBrandProfile(celebId: string) {
  await requireAdmin();
  fireBuildBrandProfile(celebId);
  revalidatePath(`/admin/celebrities/${celebId}`);
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
