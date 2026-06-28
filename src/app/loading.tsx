export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      {/* Hero skeleton */}
      <div className="bg-black py-20 px-4">
        <div className="mx-auto max-w-xs">
          <div className="h-16 bg-white/10 rounded-lg mb-4" />
          <div className="h-5 bg-white/10 rounded-lg" />
        </div>
      </div>
      {/* Grid skeleton */}
      <div className="py-16 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="h-7 w-32 bg-gray-200 rounded mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-square rounded-full bg-gray-200 mb-3" />
                <div className="h-4 bg-gray-200 rounded mx-auto w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
