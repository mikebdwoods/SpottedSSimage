"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setPhotoStatus, triggerAI } from "@/app/admin/photos/actions";
import { Button } from "@/components/ui/button";

interface Props {
  photoId: string;
  aiStatus: string;
  photoStatus: string;
  celebSlug?: string;
}

export function PhotoActions({ photoId, aiStatus, photoStatus, celebSlug }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const isLive = photoStatus === "live";

  async function handleTogglePublish() {
    setLoading("publish");
    await setPhotoStatus(photoId, isLive ? "hidden" : "live");
    setLoading(null);
  }

  async function handleRunAI() {
    setLoading("ai");
    await triggerAI(photoId);
    setQueued(true);
    setLoading(null);
    // Refresh after short delay to pick up ai_status = "processing"
    setTimeout(() => router.refresh(), 1500);
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      <Button
        size="sm"
        variant="outline"
        onClick={handleRunAI}
        disabled={loading === "ai" || aiStatus === "processing" || queued}
      >
        {queued ? "Queued" : loading === "ai" ? "Sending..." : "Run AI"}
      </Button>
      <Button
        size="sm"
        variant={isLive ? "secondary" : "default"}
        onClick={handleTogglePublish}
        disabled={loading === "publish"}
      >
        {loading === "publish" ? "..." : isLive ? "Hide" : "Publish"}
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
