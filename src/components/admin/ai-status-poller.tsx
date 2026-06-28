"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Props {
  photoId: string;
  initialStatus: string;
}

const STATUS_COLOUR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function AIStatusPoller({ photoId, initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [dotCount, setDotCount] = useState(1);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/photo-status?id=${photoId}`, { cache: "no-store" });
      if (!res.ok) return;
      const { ai_status } = await res.json();
      setStatus(ai_status);
      if (ai_status === "complete" || ai_status === "failed") {
        router.refresh();
      }
    } catch {
      // silent
    }
  }, [photoId, router]);

  useEffect(() => {
    if (status !== "processing") return;
    const pollInterval = setInterval(poll, 3000);
    const dotInterval = setInterval(() => setDotCount((d) => (d % 3) + 1), 600);
    return () => {
      clearInterval(pollInterval);
      clearInterval(dotInterval);
    };
  }, [status, poll]);

  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        Processing{".".repeat(dotCount)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_COLOUR[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}
