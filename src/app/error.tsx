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
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-[80px] font-black leading-none text-gray-100 select-none mb-2">
        Oops
      </p>
      <h1 className="text-xl font-bold mb-3 -mt-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-xs text-sm leading-relaxed">
        Don&apos;t worry — this is on us. Try again and it should sort itself out.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="border px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
