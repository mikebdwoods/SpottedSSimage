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

export default async function CelebritiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("celebrities")
    .select("id, name, slug, image_url, bio")
    .order("name", { ascending: true });

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data: celebrities } = await query;

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black tracking-tight mb-2">
            All Celebrities
          </h1>
          <p className="text-muted-foreground">
            {celebrities?.length ?? 0} celebrities · click to browse their looks
          </p>
        </div>

        {/* Search */}
        <form method="get" className="mb-8 max-w-sm">
          <div className="relative">
            <input
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Search celebrities..."
              className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black pr-10"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </form>

        {!celebrities || celebrities.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium mb-2">No celebrities found</p>
            {q && (
              <p className="text-sm">
                No results for &quot;{q}&quot;.{" "}
                <Link href="/celebrities" className="underline">
                  Clear search
                </Link>
              </p>
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
                {celeb.bio && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-[120px]">
                    {celeb.bio}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
