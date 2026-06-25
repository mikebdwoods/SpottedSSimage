"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

export async function togglePublish(photoId: string, currentPublished: boolean) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("photos")
    .update({ published: !currentPublished })
    .eq("id", photoId);
  revalidatePath("/admin/photos");
  revalidatePath("/");
}

export async function triggerAI(photoId: string) {
  await requireAdmin();

  const serviceClient = await createServiceClient();
  await serviceClient
    .from("photos")
    .update({ ai_status: "processing" })
    .eq("id", photoId);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  await fetch(`${supabaseUrl}/functions/v1/process-photo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ photo_id: photoId }),
  });

  revalidatePath("/admin/photos");
}
