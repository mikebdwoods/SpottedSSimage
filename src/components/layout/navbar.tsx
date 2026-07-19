import Link from "next/link";
import { Search } from "lucide-react";
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
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="font-serif italic text-2xl tracking-tight">
            Spotted
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            <Link href="/celebrities">
              <Button variant="ghost" size="sm">Celebrities</Button>
            </Link>
            <Link href="/looks">
              <Button variant="ghost" size="sm">Looks</Button>
            </Link>
            <Link href="/trending">
              <Button variant="ghost" size="sm">Trending</Button>
            </Link>
            <Link href="/news">
              <Button variant="ghost" size="sm">News</Button>
            </Link>
            <Link href="/search" aria-label="Search">
              <Button variant="ghost" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </Link>
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  Admin
                </Button>
              </Link>
            )}
            {user ? (
              <>
                <Link href="/account">
                  <Button variant="ghost" size="sm">Account</Button>
                </Link>
                <form action="/auth/signout" method="post">
                  <Button variant="ghost" size="sm" type="submit">Sign out</Button>
                </form>
              </>
            ) : (
              <Link href="/auth/login" className="ml-1">
                <Button variant="default" size="sm">Sign in</Button>
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
