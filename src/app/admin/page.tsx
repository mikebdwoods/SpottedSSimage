import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

const STATUS_COLOUR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: celebCount },
    { count: photoCount },
    { count: itemCount },
    { count: matchCount },
    { data: recentPhotos },
  ] = await Promise.all([
    supabase.from("celebrities").select("*", { count: "exact", head: true }),
    supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("published", true),
    supabase.from("clothing_items").select("*", { count: "exact", head: true }),
    supabase.from("product_matches").select("*", { count: "exact", head: true }),
    supabase
      .from("v_photo_inbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const stats = [
    { label: "Celebrities", value: celebCount ?? 0 },
    { label: "Published Photos", value: photoCount ?? 0 },
    { label: "Clothing Items", value: itemCount ?? 0 },
    { label: "Product Matches", value: matchCount ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value }) => (
          <div key={label} className="border rounded-lg p-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent Photos */}
      <h2 className="text-lg font-semibold mb-4">Recent Photos</h2>
      {!recentPhotos || recentPhotos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No photos yet.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Celebrity</th>
                <th className="text-left px-4 py-3 font-medium">AI Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentPhotos.map((photo: Record<string, unknown>) => (
                <tr key={photo.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {photo.celebrity_name as string || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLOUR[photo.ai_status as string] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {photo.ai_status as string}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(photo.created_at as string).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
