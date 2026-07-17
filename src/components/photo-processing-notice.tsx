"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  photoId: string;
  status: string;
}

export function PhotoProcessingNotice({ photoId, status }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "pending" && status !== "processing") return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/photo-status?id=${photoId}`, { cache: "no-store" });
        if (!res.ok) return;
        const { ai_status } = await res.json();
        if (ai_status === "done") {
          clearInterval(id);
          router.refresh();
        }
      } catch {
        // silent
      }
    }, 4000);

    return () => clearInterval(id);
  }, [photoId, status, router]);

  if (status !== "pending" && status !== "processing") return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
      <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
      <div>
        <p className="text-sm font-semibold text-blue-900">Identifying clothing items…</p>
        <p className="text-xs text-blue-700 mt-0.5">
          Our AI is analysing this look. The items will appear shortly — this page will update automatically.
        </p>
      </div>
    </div>
  );
}
