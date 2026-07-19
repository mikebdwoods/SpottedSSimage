export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="bg-primary py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="h-4 w-24 bg-gray-700 rounded mb-3" />
          <div className="h-10 w-56 bg-gray-700 rounded mb-2" />
          <div className="h-4 w-72 bg-gray-700 rounded" />
        </div>
      </div>
      <div className="py-10 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="h-5 w-40 bg-gray-200 rounded mb-5" />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-12">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-gray-200 mb-2" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="h-5 w-48 bg-gray-200 rounded mb-5" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[3/4] rounded-xl bg-gray-200" />
                <div className="h-3 w-3/4 bg-gray-200 rounded mt-1.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
