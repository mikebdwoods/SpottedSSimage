"use client";

import { useState } from "react";
import { deleteComment } from "@/app/admin/comments/actions";
import { Button } from "@/components/ui/button";

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-1.5 items-center shrink-0">
        <Button
          size="sm"
          variant="destructive"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await deleteComment(commentId);
          }}
        >
          {loading ? "..." : "Delete"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
      onClick={() => setConfirming(true)}
    >
      Delete
    </Button>
  );
}
