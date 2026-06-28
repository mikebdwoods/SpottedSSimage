export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="bg-gray-50 border-b py-10 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="h-3 w-32 bg-gray-200 rounded mb-3" />
          <div className="h-8 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="py-10 px-4">
        <div className="mx-auto max-w-7xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[3/4] rounded-xl bg-gray-200" />
              <div className="h-3 w-3/4 bg-gray-200 rounded mt-1.5" />
              <div className="h-3 w-1/2 bg-gray-200 rounded mt-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
