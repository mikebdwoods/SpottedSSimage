import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FeedPostList, type FeedPost } from "@/components/admin/feed-post-list";

export const metadata = { title: "Feed Inbox | Admin" };

const PAGE_SIZE = 30;

export default async function AdminFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ celeb?: string; page?: string; imported?: string }>;
}) {
  const { celeb: celebFilter, page, imported } = await searchParams;
  const supabase = await createClient();

  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: celebrities } = await supabase
    .from("celebrities")
    .select("id, name, slug")
    .order("name", { ascending: true });

  // Only resolved posts have a real article photo (Google News RSS supplies
  // its own logo until resolve_articles decodes the publisher link).
  let query = supabase
    .from("external_posts")
    .select(
      "id, title, image_url, link, publisher_url, source_name, published_at, photo_id, celebrities(name, slug)",
      { count: "exact" }
    )
    .eq("resolve_status", "resolved")
    .not("image_url", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (celebFilter) {
    const celeb = celebrities?.find((c) => c.slug === celebFilter);
    if (celeb) query = query.eq("celeb_id", celeb.id);
  }

  if (imported === "no") query = query.filter("photo_id", "is", null);
  if (imported === "yes") query = query.filter("photo_id", "not.is", null);

  const { data: posts, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const { count: unresolvedCount } = await supabase
    .from("external_posts")
    .select("id", { count: "exact", head: true })
    .is("resolve_status", null)
    .is("photo_id", null);

  const buildHref = (p: { celeb?: string; page?: number; imported?: string }) => {
    const q = new URLSearchParams();
    if (p.celeb) q.set("celeb", p.celeb);
    if (p.imported) q.set("imported", p.imported);
    if (p.page && p.page > 1) q.set("page", String(p.page));
    const str = q.toString();
    return `/admin/feed${str ? `?${str}` : ""}`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Feed Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {count?.toLocaleString() ?? 0} posts with real photos, ready to import as looks.
          {(unresolvedCount ?? 0) > 0 && (
            <> {unresolvedCount!.toLocaleString()} more are still being resolved to their source articles and will appear here automatically.</>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-6">
        <div className="flex gap-2 flex-wrap">
          <Link
            href={buildHref({ imported })}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !celebFilter ? "bg-black text-white border-black" : "hover:bg-gray-100"
            }`}
          >
            All celebrities
          </Link>
          {(celebrities ?? []).map((c) => (
            <Link
              key={c.id}
              href={buildHref({ celeb: c.slug, imported })}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                celebFilter === c.slug
                  ? "bg-black text-white border-black"
                  : "hover:bg-gray-100"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          {[
            { key: undefined, label: "All" },
            { key: "no", label: "Not imported" },
            { key: "yes", label: "Imported" },
          ].map(({ key, label }) => (
            <Link
              key={label}
              href={buildHref({ celeb: celebFilter, imported: key })}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                imported === key || (!imported && !key)
                  ? "bg-gray-800 text-white border-gray-800"
                  : "hover:bg-gray-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Posts */}
      {!posts || posts.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <p>No feed posts found for this filter.</p>
        </div>
      ) : (
        <FeedPostList
          posts={posts.map((post): FeedPost => {
            const celeb = post.celebrities as unknown as { name: string; slug: string } | null;
            return {
              id: post.id,
              title: post.title,
              image_url: post.image_url,
              link: post.link,
              publisher_url: post.publisher_url,
              source_name: post.source_name,
              published_at: post.published_at,
              photo_id: post.photo_id,
              celeb_name: celeb?.name ?? null,
            };
          })}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {currentPage > 1 && (
            <Link
              href={buildHref({ celeb: celebFilter, imported, page: currentPage - 1 })}
              className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ← Prev
            </Link>
          )}
          <span className="text-sm text-muted-foreground px-2">
            Page {currentPage} of {totalPages.toLocaleString()}
          </span>
          {currentPage < totalPages && (
            <Link
              href={buildHref({ celeb: celebFilter, imported, page: currentPage + 1 })}
              className="border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
