"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { batchPublish } from "@/app/admin/photos/actions";
import { Button } from "@/components/ui/button";

interface Props {
  completeUnpublishedIds: string[];
}

export function BatchPublishButton({ completeUnpublishedIds }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (completeUnpublishedIds.length === 0) return null;

  async function handleBatch() {
    setLoading(true);
    await batchPublish(completeUnpublishedIds);
    setLoading(false);
    setDone(true);
    setTimeout(() => router.refresh(), 800);
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleBatch}
      disabled={loading || done}
      className="text-xs text-green-700 border-green-300 hover:bg-green-50"
    >
      {done
        ? `Published ${completeUnpublishedIds.length}`
        : loading
        ? "Publishing..."
        : `Publish ${completeUnpublishedIds.length} ready`}
    </Button>
  );
}
