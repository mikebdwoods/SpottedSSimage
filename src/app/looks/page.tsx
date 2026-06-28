import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Latest Looks | Spotted",
  description:
    "Browse all the latest celebrity looks — shop every outfit for less on Spotted.",
};

const PAGE_SIZE = 24;

export default async function LooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const supabase = await createClient();

  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: photos, count }, { data: celebrities }] = await Promise.all([
    supabase
      .from("photos")
      .select("id, fallback_image_url, created_at, celebrities(name, slug)", {
        count: "exact",
      })
      .eq("published", true)
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("celebrities")
      .select("id, name, slug")
      .order("name", { ascending: true })
      .limit(20),
  ]);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gray-50 border-b py-10 px-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-black tracking-tight mb-1">Latest Looks</h1>
          <p className="text-muted-foreground text-sm">
            {count ? `${count} looks — click any to shop the outfit` : "Browse all celebrity looks"}
          </p>
        </div>
      </div>

      {/* Celebrity quick-filter strip */}
      {celebrities && celebrities.length > 0 && (
        <div className="border-b bg-white sticky top-16 z-20">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
              <Link
                href="/looks"
                className="shrink-0 text-xs font-semibold border rounded-full px-3 py-1.5 bg-black text-white"
              >
                All
              </Link>
              {celebrities.map((celeb) => (
                <Link
                  key={celeb.id}
                  href={`/celebrity/${celeb.slug}`}
                  className="shrink-0 text-xs font-medium border rounded-full px-3 py-1.5 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  {celeb.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Looks grid */}
      <section className="py-10 px-4">
        <div className="mx-auto max-w-7xl">
          {!photos || photos.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <p className="text-lg font-semibold mb-2">No looks yet</p>
              <p className="text-sm mb-6">Check back soon — we&apos;re adding new looks daily.</p>
              <Link href="/celebrities" className="underline font-medium text-sm">
                Browse celebrities
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {photos.map((photo) => {
                const celeb = photo.celebrities as unknown as { name: string; slug: string } | null;
                if (!celeb) return null;
                return (
                  <Link
                    key={photo.id}
                    href={`/celebrity/${celeb.slug}/photo/${photo.id}`}
                    className="group"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden rounded-xl bg-gray-100">
                      {photo.fallback_image_url ? (
                        <Image
                          src={photo.fallback_image_url}
                          alt={`${celeb.name} look`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No image
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <p className="text-white text-xs font-semibold leading-tight">
                          {celeb.name}
                        </p>
                        <p className="text-white/70 text-xs">Shop the look →</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium mt-1.5 truncate text-muted-foreground group-hover:text-foreground transition-colors">
                      {celeb.name}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              {currentPage > 1 && (
                <Link
                  href={`/looks?page=${currentPage - 1}`}
                  className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  ← Prev
                </Link>
              )}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) {
                    p = i + 1;
                  } else if (currentPage <= 4) {
                    p = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    p = totalPages - 6 + i;
                  } else {
                    p = currentPage - 3 + i;
                  }
                  return (
                    <Link
                      key={p}
                      href={`/looks?page=${p}`}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        p === currentPage
                          ? "bg-black text-white"
                          : "border hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </Link>
                  );
                })}
              </div>
              {currentPage < totalPages && (
                <Link
                  href={`/looks?page=${currentPage + 1}`}
                  className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
