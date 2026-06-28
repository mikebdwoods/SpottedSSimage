export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      {/* Dark hero skeleton */}
      <div className="bg-black py-14 px-4">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row gap-8 items-center sm:items-start">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gray-700 shrink-0" />
          <div className="flex-1 text-center sm:text-left pt-2">
            <div className="h-3 w-20 bg-gray-700 rounded mb-3" />
            <div className="h-10 w-56 bg-gray-700 rounded mb-4" />
            <div className="h-4 bg-gray-700 rounded mb-2 max-w-md" />
            <div className="h-4 w-3/4 bg-gray-700 rounded max-w-sm" />
          </div>
        </div>
      </div>
      {/* Looks grid skeleton */}
      <div className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="h-6 w-16 bg-gray-200 rounded mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
