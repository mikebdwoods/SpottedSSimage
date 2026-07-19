"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Menu } from "lucide-react";

interface Props {
  isAdmin: boolean;
  isSignedIn: boolean;
}

export function MobileNav({ isAdmin, isSignedIn }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="sm:hidden p-2 -mr-2 rounded-full hover:bg-secondary transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-card shadow-warm-lg transform transition-transform duration-300 ease-in-out sm:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-serif italic text-xl">Spotted</span>
          <button
            onClick={() => setOpen(false)}
            className="p-2 -mr-2 rounded-full hover:bg-secondary transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          <Link
            href="/"
            className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            Home
          </Link>
          <Link
            href="/celebrities"
            className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            Celebrities
          </Link>
          <Link
            href="/looks"
            className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            Looks
          </Link>
          <Link
            href="/trending"
            className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            Trending
          </Link>
          <Link
            href="/news"
            className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            News
          </Link>
          <Link
            href="/search"
            className="block px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
          >
            Search
          </Link>
          <Link
            href="/about"
            className="block px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
          >
            About
          </Link>
          {isSignedIn && (
            <Link
              href="/account"
              className="block px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
            >
              My Account
            </Link>
          )}

          {isAdmin && (
            <>
              <div className="px-3 pt-3 pb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {[
                { href: "/admin", label: "Dashboard" },
                { href: "/admin/photos", label: "Photos" },
                { href: "/admin/feed", label: "Feed Inbox" },
                { href: "/admin/upload", label: "Upload" },
                { href: "/admin/import", label: "Import URL" },
                { href: "/admin/celebrities", label: "Celebrities" },
                { href: "/admin/merch", label: "Merch" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors"
                >
                  {label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          {isSignedIn ? (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-sm text-center py-2.5 rounded-full border border-border hover:bg-secondary transition-colors"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/auth/login"
              className="block w-full text-sm text-center py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/88 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
