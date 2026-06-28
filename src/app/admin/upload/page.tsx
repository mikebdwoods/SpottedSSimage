import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/admin/upload-form";

export default async function AdminUploadPage() {
  const supabase = await createClient();
  const { data: celebrities } = await supabase
    .from("celebrities")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Upload Photo</h1>
      <div className="max-w-lg">
        <UploadForm celebrities={celebrities ?? []} />
      </div>
    </div>
  );
}
