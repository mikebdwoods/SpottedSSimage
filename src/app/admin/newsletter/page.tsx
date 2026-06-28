import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Newsletter | Admin" };

export default async function AdminNewsletterPage() {
  const supabase = await createClient();

  const { data: subscribers, count } = await supabase
    .from("newsletter_signups")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Newsletter</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {count ?? 0} subscriber{count !== 1 ? "s" : ""}
          </p>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,email,signed_up\n${(subscribers ?? []).map((s) => `${s.email},${s.created_at}`).join("\n")}`}
          download="spotted-newsletter.csv"
          className="text-sm bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {!subscribers || subscribers.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <p className="font-medium">No subscribers yet</p>
          <p className="text-sm mt-1">They&apos;ll appear here as people sign up.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{sub.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(sub.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
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
