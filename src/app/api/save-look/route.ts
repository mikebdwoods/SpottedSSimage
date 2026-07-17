import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { photo_id } = await req.json();
  if (!photo_id) return NextResponse.json({ error: "photo_id required" }, { status: 400 });

  const { error } = await supabase
    .from("saved_looks")
    .insert({ user_id: user.id, photo_id });

  if (error && error.code === "23505") {
    // Already saved — idempotent
    return NextResponse.json({ saved: true });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { photo_id } = await req.json();
  if (!photo_id) return NextResponse.json({ error: "photo_id required" }, { status: 400 });

  await supabase
    .from("saved_looks")
    .delete()
    .eq("user_id", user.id)
    .eq("photo_id", photo_id);

  return NextResponse.json({ saved: false });
}
