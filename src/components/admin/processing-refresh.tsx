"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  processingCount: number;
}

export function ProcessingRefresh({ processingCount }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (processingCount === 0) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [processingCount, router]);

  if (processingCount === 0) return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      {processingCount} processing — auto-refreshing
    </span>
  );
}
