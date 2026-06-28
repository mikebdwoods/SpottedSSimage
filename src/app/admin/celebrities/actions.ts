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
  const gender = formData.get("gender") as string;
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
    gender: gender || null,
    image_url: imageUrl,
  });

  revalidatePath("/admin/celebrities");
  revalidatePath("/");
}
