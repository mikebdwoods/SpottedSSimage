"use client";

import { useState } from "react";
import Link from "next/link";
import { togglePublish, triggerAI } from "@/app/admin/photos/actions";
import { Button } from "@/components/ui/button";

interface Props {
  photoId: string;
  aiStatus: string;
  published: boolean;
  celebSlug?: string;
}

export function PhotoActions({ photoId, aiStatus, published, celebSlug }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleTogglePublish() {
    setLoading("publish");
    await togglePublish(photoId, published);
    setLoading(null);
  }

  async function handleRunAI() {
    setLoading("ai");
    await triggerAI(photoId);
    setLoading(null);
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      <Button
        size="sm"
        variant="outline"
        onClick={handleRunAI}
        disabled={loading === "ai" || aiStatus === "processing"}
      >
        {loading === "ai" ? "Running..." : "Run AI"}
      </Button>
      <Button
        size="sm"
        variant={published ? "secondary" : "default"}
        onClick={handleTogglePublish}
        disabled={loading === "publish"}
      >
        {loading === "publish" ? "..." : published ? "Unpublish" : "Publish"}
      </Button>
      {celebSlug && (
        <Link href={`/celebrity/${celebSlug}/photo/${photoId}`} target="_blank">
          <Button size="sm" variant="ghost">
            View
          </Button>
        </Link>
      )}
    </div>
  );
}
