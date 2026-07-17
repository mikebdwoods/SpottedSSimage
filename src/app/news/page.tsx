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
      <div className="bg-black text-white py-12 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Updated daily
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            {activeCeleb ? `${activeCeleb.name} News` : "Celebrity News"}
          </h1>
          <p className="text-gray-400 text-sm">
            The latest looks and stories from around the web
          </p>
        </div>
      </div>

      {/* Celebrity filter */}
      <div className="border-b bg-white sticky top-16 z-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            <Link
              href="/news"
              className={`shrink-0 text-xs font-semibold border rounded-full px-3 py-1.5 transition-colors ${
                !celebFilter ? "bg-black text-white border-black" : "hover:bg-gray-50"
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
                    ? "bg-black text-white border-black"
                    : "hover:bg-gray-50"
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
                    <div className="aspect-[4/3] relative overflow-hidden rounded-xl bg-gray-100 mb-3">
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
                  className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
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
