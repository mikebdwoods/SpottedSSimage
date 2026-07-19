"use client";

import { useEffect } from "react";

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
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 bg-dot-grid">
      <p className="font-serif italic text-[70px] leading-none text-clay/25 select-none mb-2">
        Oops
      </p>
      <h1 className="text-xl font-bold mb-3 -mt-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-xs text-sm leading-relaxed">
        Don&apos;t worry — this is on us. Try again and it should sort itself out.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/88 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="border border-border px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-secondary transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
