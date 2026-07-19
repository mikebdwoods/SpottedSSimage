export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="bg-secondary/40 border-b py-10 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="py-10 px-4">
        <div className="mx-auto max-w-7xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-200 mb-3" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-3 w-14 bg-gray-200 rounded mt-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
