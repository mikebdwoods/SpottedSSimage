import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .single();

  if (!role) redirect("/auth/login");
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkAdmin();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-gray-50 py-6 px-3 shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-4">
          Admin
        </p>
        <nav className="space-y-1">
          {[
            { href: "/admin", label: "Dashboard" },
            { href: "/admin/photos", label: "Photos" },
            { href: "/admin/upload", label: "Upload" },
            { href: "/admin/celebrities", label: "Celebrities" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 text-sm rounded-md hover:bg-gray-200 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8 overflow-auto">{children}</div>
    </div>
  );
}
