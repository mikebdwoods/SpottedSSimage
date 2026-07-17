import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ImportPostButton } from "@/components/admin/import-post-button";

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

  let query = supabase
    .from("external_posts")
    .select(
      "id, title, image_url, link, publisher_url, source_name, published_at, photo_id, celebrities(name, slug)",
      { count: "exact" }
    )
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
          {count?.toLocaleString() ?? 0} posts from celebrity news feeds — import the best ones as looks.
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
        <div className="border rounded-lg overflow-hidden divide-y">
          {posts.map((post) => {
            const celeb = post.celebrities as unknown as { name: string; slug: string } | null;
            return (
              <div key={post.id} className="flex items-start gap-4 p-4 hover:bg-gray-50">
                {post.image_url && (
                  <a
                    href={post.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-20 h-24 object-cover rounded-lg bg-gray-100"
                      loading="lazy"
                    />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-1">
                    <span className="font-semibold text-foreground">{celeb?.name ?? "—"}</span>
                    {post.source_name && <span>· {post.source_name}</span>}
                    {post.published_at && (
                      <span>
                        · {new Date(post.published_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-snug line-clamp-2">
                    {post.title ?? "Untitled post"}
                  </p>
                  <a
                    href={post.publisher_url || post.link || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    View source →
                  </a>
                </div>
                <div className="shrink-0">
                  {post.photo_id ? (
                    <Link
                      href={`/admin/photos/${post.photo_id}`}
                      className="text-xs font-semibold text-green-600 hover:underline"
                    >
                      Imported ✓
                    </Link>
                  ) : (
                    <ImportPostButton postId={post.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
