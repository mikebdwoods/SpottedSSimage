import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "All Celebrities | Spotted",
  description:
    "Browse all celebrities on Spotted — discover their outfits and shop the look for less.",
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default async function CelebritiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; letter?: string }>;
}) {
  const { q, letter } = await searchParams;
  const supabase = await createClient();

  type CelebRow = {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    bio: string | null;
    photo_count: number;
  };

  let dbQuery = supabase
    .from("celebrities")
    .select(
      "id, name, slug, photo_url, bio, photos(count)"
    )
    .eq("status", "published")
    .in("photos.status", ["live", "approved"])
    .order("name", { ascending: true });

  if (q) {
    dbQuery = dbQuery.ilike("name", `%${q}%`);
  } else if (letter) {
    dbQuery = dbQuery.ilike("name", `${letter}%`);
  }

  const { data: raw } = await dbQuery;

  const celebrities: CelebRow[] = (raw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    image_url: c.photo_url,
    bio: c.bio,
    photo_count:
      Array.isArray(c.photos) && c.photos.length > 0
        ? (c.photos[0] as { count: number }).count
        : 0,
  }));

  const activeLetter = letter?.toUpperCase();
  const isFiltered = !!(q || activeLetter);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gray-50 border-b py-10 px-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1">
              {activeLetter ? `Celebrities — ${activeLetter}` : "All Celebrities"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isFiltered
                ? `${celebrities.length} result${celebrities.length === 1 ? "" : "s"}`
                : `${celebrities.length} celebrities · click to browse their looks`}
            </p>
          </div>
          {/* Search */}
          <form method="get" className="flex gap-2 max-w-xs w-full sm:w-auto">
            <input
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Search celebrities..."
              className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
            />
            <button
              type="submit"
              className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shrink-0"
            >
              Go
            </button>
          </form>
        </div>
      </div>

      {/* A-Z filter */}
      {!q && (
        <div className="border-b bg-white sticky top-16 z-20">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex gap-0.5 overflow-x-auto py-2 scrollbar-hide">
              <Link
                href="/celebrities"
                className={`shrink-0 w-8 h-8 flex items-center justify-center rounded text-xs font-semibold transition-colors ${
                  !activeLetter ? "bg-black text-white" : "hover:bg-gray-100 text-muted-foreground"
                }`}
              >
                All
              </Link>
              {LETTERS.map((l) => (
                <Link
                  key={l}
                  href={`/celebrities?letter=${l}`}
                  className={`shrink-0 w-8 h-8 flex items-center justify-center rounded text-xs font-semibold transition-colors ${
                    activeLetter === l
                      ? "bg-black text-white"
                      : "hover:bg-gray-100 text-muted-foreground"
                  }`}
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Celebrities grid */}
      <section className="py-10 px-4">
        <div className="mx-auto max-w-7xl">
          {celebrities.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg font-semibold mb-2">No celebrities found</p>
              {(q || activeLetter) && (
                <Link
                  href="/celebrities"
                  className="text-sm underline font-medium"
                >
                  Clear filter
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {celebrities.map((celeb) => (
                <Link
                  key={celeb.id}
                  href={`/celebrity/${celeb.slug}`}
                  className="group flex flex-col items-center text-center"
                >
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gray-200 mb-3 ring-2 ring-transparent group-hover:ring-black transition-all duration-200">
                    {celeb.image_url ? (
                      <Image
                        src={celeb.image_url}
                        alt={celeb.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                        sizes="96px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                        {celeb.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold leading-tight">{celeb.name}</p>
                  {celeb.photo_count > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {celeb.photo_count} look{celeb.photo_count === 1 ? "" : "s"}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
