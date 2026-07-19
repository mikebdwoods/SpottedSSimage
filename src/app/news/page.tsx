import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Celebrity News | Spotted",
  description:
    "The latest UK celebrity fashion news and photos from around the web — updated daily on Spotted.",
};

const PAGE_SIZE = 36;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ celeb?: string; page?: string }>;
}) {
  const { celeb: celebFilter, page } = await searchParams;
  const supabase = await createClient();

  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: celebrities } = await supabase
    .from("celebrities")
    .select("id, name, slug")
    .eq("status", "published")
    .order("name", { ascending: true });

  let query = supabase
    .from("external_posts")
    .select(
      "id, title, image_url, link, publisher_url, source_name, published_at, celebrities(name, slug)",
      { count: "exact" }
    )
    .not("image_url", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (celebFilter) {
    const celeb = celebrities?.find((c) => c.slug === celebFilter);
    if (celeb) query = query.eq("celeb_id", celeb.id);
  }

  const { data: posts, count } = await query;
  const totalPages = Math.min(Math.ceil((count ?? 0) / PAGE_SIZE), 50);

  const activeCeleb = celebrities?.find((c) => c.slug === celebFilter);

  const buildHref = (p: { celeb?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (p.celeb) q.set("celeb", p.celeb);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    const str = q.toString();
    return `/news${str ? `?${str}` : ""}`;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative bg-primary text-primary-foreground texture-grain py-12 px-4 overflow-hidden">
        <div className="pointer-events-none absolute -top-16 right-10 h-56 w-56 rounded-full bg-clay/15 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-foreground/50 uppercase tracking-widest mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse" />
            Updated daily
          </div>
          <h1 className="font-serif italic text-4xl sm:text-5xl tracking-tight mb-2">
            {activeCeleb ? `${activeCeleb.name} News` : "Celebrity News"}
          </h1>
          <p className="text-primary-foreground/60 text-sm">
            The latest looks and stories from around the web
          </p>
        </div>
      </div>

      {/* Celebrity filter */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-16 z-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            <Link
              href="/news"
              className={`shrink-0 text-xs font-semibold border rounded-full px-3 py-1.5 transition-colors ${
                !celebFilter ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
              }`}
            >
              All
            </Link>
            {(celebrities ?? []).map((c) => (
              <Link
                key={c.id}
                href={buildHref({ celeb: c.slug })}
                className={`shrink-0 text-xs font-medium border rounded-full px-3 py-1.5 transition-colors whitespace-nowrap ${
                  celebFilter === c.slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* News grid */}
      <section className="py-10 px-4">
        <div className="mx-auto max-w-7xl">
          {!posts || posts.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <p className="text-lg font-semibold mb-2">No news found</p>
              <Link href="/news" className="underline font-medium text-sm">
                Clear filter
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {posts.map((post) => {
                const celeb = post.celebrities as unknown as { name: string; slug: string } | null;
                return (
                  <a
                    key={post.id}
                    href={post.publisher_url || post.link || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col"
                  >
                    <div className="aspect-[4/3] relative overflow-hidden rounded-2xl bg-secondary shadow-warm mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.image_url ?? ""}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {celeb && (
                        <span className="font-semibold text-foreground">{celeb.name}</span>
                      )}
                      {post.source_name && <span>· {post.source_name}</span>}
                      {post.published_at && (
                        <span>
                          · {new Date(post.published_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:underline">
                      {post.title}
                    </p>
                  </a>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              {currentPage > 1 && (
                <Link
                  href={buildHref({ celeb: celebFilter, page: currentPage - 1 })}
                  className="border border-border rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
                >
                  ← Prev
                </Link>
              )}
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <Link
                  href={buildHref({ celeb: celebFilter, page: currentPage + 1 })}
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
