"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

export async function deleteComment(commentId: string) {
  const supabase = await requireAdmin();
  await supabase.from("comments").delete().eq("id", commentId);
  revalidatePath("/admin/comments");
}
