import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "@/components/admin/import-form";

export default async function AdminImportPage() {
  const supabase = await createClient();
  const { data: celebrities } = await supabase
    .from("celebrities")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Import Photo via URL</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Paste a direct image URL to import it without uploading a file. Useful for press shots already hosted online.
      </p>
      <div className="max-w-lg">
        <ImportForm celebrities={celebrities ?? []} />
      </div>
    </div>
  );
}
