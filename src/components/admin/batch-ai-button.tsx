"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerAIBatch } from "@/app/admin/photos/actions";
import { Button } from "@/components/ui/button";

interface Props {
  pendingPhotoIds: string[];
}

export function BatchAIButton({ pendingPhotoIds }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (pendingPhotoIds.length === 0) return null;

  async function handleBatch() {
    setLoading(true);
    await triggerAIBatch(pendingPhotoIds);
    setLoading(false);
    setDone(true);
    setTimeout(() => router.refresh(), 1000);
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleBatch}
      disabled={loading || done}
      className="text-xs"
    >
      {done
        ? `Queued ${pendingPhotoIds.length} photos`
        : loading
        ? "Queuing..."
        : `Run AI on ${pendingPhotoIds.length} pending`}
    </Button>
  );
}
