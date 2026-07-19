import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 bg-dot-grid">
      <p className="font-serif italic text-[110px] leading-none text-clay/15 select-none mb-2">
        404
      </p>
      <h1 className="text-2xl font-bold mb-3 -mt-4">Look not found</h1>
      <p className="text-muted-foreground mb-8 max-w-xs leading-relaxed text-sm">
        This page may have moved or the URL might be wrong.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/88 transition-colors"
        >
          Back to home
        </Link>
        <Link
          href="/celebrities"
          className="border border-border px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-secondary transition-colors"
        >
          Browse looks
        </Link>
      </div>
    </div>
  );
}
