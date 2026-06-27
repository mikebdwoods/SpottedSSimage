export default function Loading() {
  return (
    <div className="min-h-screen py-8 px-4 animate-pulse">
      <div className="mx-auto max-w-5xl">
        <div className="h-4 w-48 bg-gray-200 rounded mb-6" />
        <div className="h-8 w-40 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-72 bg-gray-200 rounded mb-10" />
        <div className="h-6 w-24 bg-gray-200 rounded mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border rounded-lg overflow-hidden">
              <div className="aspect-square bg-gray-200" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-3 w-2/3 bg-gray-200 rounded" />
                <div className="h-4 w-1/2 bg-gray-200 rounded" />
                <div className="h-8 bg-gray-200 rounded mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
