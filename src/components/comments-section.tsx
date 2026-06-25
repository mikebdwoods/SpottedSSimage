"use client";

import { useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  photoId: string;
  comments: Comment[];
  currentUser: User | null;
  celebritySlug: string;
}

export function CommentsSection({
  photoId,
  comments: initial,
  currentUser,
  celebritySlug,
}: Props) {
  const [comments, setComments] = useState<Comment[]>(initial);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !currentUser) return;

    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({ photo_id: photoId, content: content.trim() })
      .select("*, profiles(display_name, avatar_url)")
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data as Comment]);
      setContent("");
    }
    setSubmitting(false);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">
        Comments ({comments.length})
      </h2>

      {comments.length === 0 && (
        <p className="text-muted-foreground text-sm mb-6">
          No comments yet. Be the first!
        </p>
      )}

      <div className="space-y-4 mb-8">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold shrink-0">
              {comment.profiles?.display_name?.charAt(0) ?? "?"}
            </div>
            <div>
              <p className="text-sm font-medium">
                {comment.profiles?.display_name ?? "Anonymous"}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(comment.created_at).toLocaleDateString("en-GB")}
              </p>
              <p className="text-sm mt-1">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>

      {currentUser ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Add a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <Button type="submit" disabled={submitting || !content.trim()}>
            {submitting ? "Posting..." : "Post comment"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/auth/login" className="underline font-medium">
            Sign in
          </Link>{" "}
          to leave a comment.
        </p>
      )}
    </div>
  );
}
