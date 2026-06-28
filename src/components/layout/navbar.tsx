import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();
    isAdmin = !!data;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight">
            Spotted
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  Admin
                </Button>
              </Link>
            )}
            {user ? (
              <form action="/auth/signout" method="post">
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            ) : (
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
            )}
          </nav>

          {/* Mobile nav */}
          <MobileNav isAdmin={isAdmin} isSignedIn={!!user} />
        </div>
      </div>
    </header>
  );
}
