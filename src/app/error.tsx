"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-5xl font-black mb-4">Oops</p>
      <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Don&apos;t worry — try again and it should sort itself out.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
