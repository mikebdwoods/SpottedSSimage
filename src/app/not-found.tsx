import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-[120px] font-black leading-none text-gray-100 select-none mb-2">
        404
      </p>
      <h1 className="text-2xl font-bold mb-3 -mt-4">Look not found</h1>
      <p className="text-muted-foreground mb-8 max-w-xs leading-relaxed text-sm">
        This page may have moved or the URL might be wrong.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          Back to home
        </Link>
        <Link
          href="/celebrities"
          className="border px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Browse looks
        </Link>
      </div>
    </div>
  );
}
