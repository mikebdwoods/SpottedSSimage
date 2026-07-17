"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/feed", label: "Feed Inbox" },
  { href: "/admin/upload", label: "Upload" },
  { href: "/admin/import", label: "Import URL" },
  { href: "/admin/celebrities", label: "Celebrities" },
  { href: "/admin/merch", label: "Merch" },
  { href: "/admin/newsletter", label: "Newsletter" },
  { href: "/admin/comments", label: "Comments" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`block px-3 py-2 text-sm rounded-md transition-colors ${
              isActive
                ? "bg-black text-white font-medium"
                : "hover:bg-gray-200 text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
