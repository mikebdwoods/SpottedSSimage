import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_COLOUR: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  live: "bg-green-100 text-green-800",
  hidden: "bg-gray-200 text-gray-600",
};

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: celebCount },
    { count: photoCount },
    { count: itemCount },
    { count: matchCount },
    { count: newsletterCount },
    { count: commentCount },
    { data: recentPhotos },
  ] = await Promise.all([
    supabase.from("celebrities").select("*", { count: "exact", head: true }),
    supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .in("status", ["live", "approved"]),
    supabase.from("clothing_items").select("*", { count: "exact", head: true }),
    supabase.from("item_matches").select("*", { count: "exact", head: true }),
    supabase.from("newsletter_signups").select("*", { count: "exact", head: true }),
    supabase.from("comments").select("*", { count: "exact", head: true }),
    supabase
      .from("v_photo_inbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const stats = [
    { label: "Celebrities", value: celebCount ?? 0, href: "/admin/celebrities", colour: "border-l-4 border-l-purple-400" },
    { label: "Published Looks", value: photoCount ?? 0, href: "/admin/photos", colour: "border-l-4 border-l-blue-400" },
    { label: "Clothing Items", value: itemCount ?? 0, href: "/admin/photos", colour: "border-l-4 border-l-green-400" },
    { label: "Product Matches", value: matchCount ?? 0, href: "/admin/photos", colour: "border-l-4 border-l-amber-400" },
    { label: "Newsletter", value: newsletterCount ?? 0, href: "/admin/newsletter", colour: "border-l-4 border-l-pink-400" },
    { label: "Comments", value: commentCount ?? 0, href: "/admin/comments", colour: "border-l-4 border-l-gray-300" },
  ];

  const quickActions = [
    { href: "/admin/upload", label: "Upload a look", desc: "Add a new celebrity photo" },
    { href: "/admin/celebrities", label: "Add celebrity", desc: "Create a new celebrity profile" },
    { href: "/admin/merch", label: "Add merch", desc: "Add official merchandise" },
    { href: "/admin/newsletter", label: "View subscribers", desc: "Manage newsletter list" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/admin/upload"
          className="bg-black text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          + Upload look
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-10">
        {stats.map(({ label, value, href, colour }) => (
          <Link
            key={label}
            href={href}
            className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${colour}`}
          >
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Quick actions
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {quickActions.map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="border rounded-xl p-4 hover:bg-gray-50 transition-colors group"
          >
            <p className="text-sm font-semibold group-hover:underline">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent Photos inbox */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Photos
        </h2>
        <Link href="/admin/photos" className="text-xs text-blue-600 hover:underline">
          View all →
        </Link>
      </div>

      {!recentPhotos || recentPhotos.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No photos yet —{" "}
          <Link href="/admin/upload" className="underline">
            upload the first one
          </Link>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Celebrity</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
                <th className="text-right px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentPhotos.map((photo: Record<string, unknown>) => (
                <tr key={photo.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {(photo.celeb_slug as string) || "—"}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_COLOUR[photo.status as string] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {photo.status as string}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    {new Date(photo.created_at as string).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/photos/${photo.id as string}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View →
                    </Link>
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
