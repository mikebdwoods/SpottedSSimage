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

const CATEGORIES = [
  { slug: "dress", label: "Dresses" },
  { slug: "top", label: "Tops" },
  { slug: "jacket", label: "Jackets" },
  { slug: "coat", label: "Coats" },
  { slug: "jeans", label: "Jeans" },
  { slug: "skirt", label: "Skirts" },
  { slug: "bag", label: "Bags" },
  { slug: "shoes", label: "Shoes" },
  { slug: "trainers", label: "Trainers" },
  { slug: "boots", label: "Boots" },
  { slug: "sunglasses", label: "Sunglasses" },
  { slug: "jewellery", label: "Jewellery" },
];

export default async function LooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; celeb?: string; cat?: string }>;
}) {
  const { page, celeb: celebSlug, cat: categoryFilter } = await searchParams;
  const supabase = await createClient();

  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: celebrities }] = await Promise.all([
    supabase
      .from("celebrities")
      .select("id, name, slug")
      .eq("status", "published")
      .order("name", { ascending: true })
      .limit(40),
  ]);

  // If filtering by category, get photo_ids that have that clothing category
  let categoryPhotoIds: string[] | null = null;
  if (categoryFilter) {
    const { data: items } = await supabase
      .from("clothing_items")
      .select("photo_id")
      .eq("category", categoryFilter);
    categoryPhotoIds = [...new Set((items ?? []).map((i) => i.photo_id))];
  }

  // Build main query
  let query = supabase
    .from("photos")
    .select("id, image_url, created_at, celebrities(name, slug)", {
      count: "exact",
    })
    .in("status", ["live", "approved"])
    .order("created_at", { ascending: false })
    .range(from, to);

  if (celebSlug) {
    const celeb = celebrities?.find((c) => c.slug === celebSlug);
    if (celeb) query = query.eq("celeb_id", celeb.id);
  }

  if (categoryPhotoIds !== null) {
    if (categoryPhotoIds.length === 0) {
      // No photos have this category
      return renderPage([], 0, 0, celebrities ?? [], celebSlug, categoryFilter);
    }
    query = query.in("id", categoryPhotoIds);
  }

  const { data: photos, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return renderPage(
    photos ?? [],
    count ?? 0,
    totalPages,
    celebrities ?? [],
    celebSlug,
    categoryFilter,
    currentPage
  );
}

function buildHref(params: { celeb?: string; cat?: string; page?: number }) {
  const q = new URLSearchParams();
  if (params.celeb) q.set("celeb", params.celeb);
  if (params.cat) q.set("cat", params.cat);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  const str = q.toString();
  return `/looks${str ? `?${str}` : ""}`;
}

function renderPage(
  photos: Array<{ id: string; image_url: string | null; created_at: string; celebrities: unknown }>,
  count: number,
  totalPages: number,
  celebrities: Array<{ id: string; name: string; slug: string }>,
  celebSlug: string | undefined,
  categoryFilter: string | undefined,
  currentPage = 1
) {
  const activeCeleb = celebrities.find((c) => c.slug === celebSlug);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-secondary/40 border-b border-border py-10 px-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="font-serif italic text-3xl sm:text-4xl tracking-tight mb-1">
            {activeCeleb ? `${activeCeleb.name}'s Looks` : "Latest Looks"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {count ? `${count} look${count === 1 ? "" : "s"} — click any to shop the outfit` : "Browse all celebrity looks"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-16 z-20">
        <div className="mx-auto max-w-7xl px-4">
          {/* Celebrity filter */}
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide border-b border-border">
            <Link
              href={buildHref({ cat: categoryFilter })}
              className={`shrink-0 text-xs font-semibold border rounded-full px-3 py-1.5 transition-colors ${
                !celebSlug ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
              }`}
            >
              All
            </Link>
            {celebrities.map((celeb) => (
              <Link
                key={celeb.id}
                href={buildHref({ celeb: celeb.slug, cat: categoryFilter })}
                className={`shrink-0 text-xs font-medium border rounded-full px-3 py-1.5 transition-colors whitespace-nowrap ${
                  celebSlug === celeb.slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {celeb.name}
              </Link>
            ))}
          </div>
          {/* Category filter */}
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            <Link
              href={buildHref({ celeb: celebSlug })}
              className={`shrink-0 text-xs font-semibold border rounded-full px-3 py-1.5 transition-colors ${
                !categoryFilter ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
              }`}
            >
              All items
            </Link>
            {CATEGORIES.map(({ slug, label }) => (
              <Link
                key={slug}
                href={buildHref({ celeb: celebSlug, cat: slug })}
                className={`shrink-0 text-xs font-medium border rounded-full px-3 py-1.5 transition-colors whitespace-nowrap ${
                  categoryFilter === slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Looks grid */}
      <section className="py-10 px-4">
        <div className="mx-auto max-w-7xl">
          {photos.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <p className="text-lg font-semibold mb-2">No looks found</p>
              <p className="text-sm mb-6">Try a different filter.</p>
              <Link href="/looks" className="underline font-medium text-sm">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {photos.map((photo) => {
                const celeb = photo.celebrities as { name: string; slug: string } | null;
                if (!celeb) return null;
                return (
                  <Link
                    key={photo.id}
                    href={`/celebrity/${celeb.slug}/photo/${photo.id}`}
                    className="group"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden rounded-2xl bg-secondary shadow-warm">
                      {photo.image_url ? (
                        <Image
                          src={photo.image_url}
                          alt={`${celeb.name} look`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No image
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <p className="text-primary-foreground text-xs font-semibold leading-tight">
                          {celeb.name}
                        </p>
                        <p className="text-primary-foreground/70 text-xs">Shop the look →</p>
                      </div>
                    </div>
                    <p className="text-xs font-medium mt-1.5 truncate text-muted-foreground group-hover:text-clay transition-colors">
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
                  href={buildHref({ celeb: celebSlug, cat: categoryFilter, page: currentPage - 1 })}
                  className="border border-border rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
                >
                  ← Prev
                </Link>
              )}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (currentPage <= 4) p = i + 1;
                  else if (currentPage >= totalPages - 3) p = totalPages - 6 + i;
                  else p = currentPage - 3 + i;
                  return (
                    <Link
                      key={p}
                      href={buildHref({ celeb: celebSlug, cat: categoryFilter, page: p })}
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        p === currentPage ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
                      }`}
                    >
                      {p}
                    </Link>
                  );
                })}
              </div>
              {currentPage < totalPages && (
                <Link
                  href={buildHref({ celeb: celebSlug, cat: categoryFilter, page: currentPage + 1 })}
                  className="border border-border rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
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
