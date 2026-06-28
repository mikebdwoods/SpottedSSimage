import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteCommentButton } from "@/components/admin/delete-comment-button";

export const metadata = { title: "Comments | Admin" };

export default async function AdminCommentsPage() {
  const supabase = await createClient();

  const { data: comments, count } = await supabase
    .from("comments")
    .select(
      "id, content, created_at, profiles(display_name), photos(id, celebrities(name, slug))",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Comments</h1>
          <p className="text-sm text-muted-foreground mt-1">{count ?? 0} total</p>
        </div>
      </div>

      {!comments || comments.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <p>No comments yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {comments.map((comment) => {
            const photo = (comment.photos as unknown) as {
              id: string;
              celebrities: { name: string; slug: string } | null;
            } | null;
            const profile = (comment.profiles as unknown) as { display_name: string | null } | null;
            const celeb = photo?.celebrities;

            return (
              <div key={comment.id} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold">
                      {profile?.display_name ?? "Anonymous"}
                    </span>
                    {celeb && photo && (
                      <Link
                        href={`/celebrity/${celeb.slug}/photo/${photo.id}`}
                        className="text-xs text-blue-600 hover:underline"
                        target="_blank"
                      >
                        on {celeb.name}&apos;s look →
                      </Link>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(comment.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{comment.content}</p>
                </div>
                <DeleteCommentButton commentId={comment.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
