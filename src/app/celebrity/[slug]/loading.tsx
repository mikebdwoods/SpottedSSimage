export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="bg-gray-50 py-12 px-4">
        <div className="mx-auto max-w-4xl flex gap-8 items-start">
          <div className="w-40 h-40 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 pt-4">
            <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
            <div className="h-4 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
      <div className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="h-6 w-16 bg-gray-200 rounded mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-lg bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
