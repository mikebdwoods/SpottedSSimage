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

export async function setUserRole(userId: string, role: "admin" | "user" | null) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_role", { p_user_id: userId, p_role: role });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function deactivateUser(userId: string, days: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("admin_deactivate_user", { p_user_id: userId, p_days: days });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function reactivateUser(userId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("admin_reactivate_user", { p_user_id: userId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function inviteAdmin(formData: FormData) {
  const supabase = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "admin");
  if (!email) throw new Error("Email required");

  const { error } = await supabase.rpc("admin_add_invite", { p_email: email, p_role: role });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function deleteInvite(email: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_invite", { p_email: email });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
