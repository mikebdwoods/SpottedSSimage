export default function NewsLoading() {
  return (
    <div className="min-h-screen">
      <div className="bg-primary py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="h-3 w-24 bg-gray-800 rounded mb-4 animate-pulse" />
          <div className="h-9 w-64 bg-gray-800 rounded mb-2 animate-pulse" />
          <div className="h-4 w-80 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="border-b py-2 px-4">
        <div className="mx-auto max-w-7xl flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-20 bg-gray-100 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
      <div className="py-10 px-4">
        <div className="mx-auto max-w-7xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[4/3] bg-gray-100 rounded-xl mb-3 animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded mb-2 animate-pulse" />
              <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
