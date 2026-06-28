export default function Loading() {
  return (
    <div className="min-h-screen py-12 px-4 animate-pulse">
      <div className="mx-auto max-w-2xl">
        <div className="h-8 w-36 bg-gray-200 rounded mb-8" />
        <div className="border rounded-xl p-6 mb-8">
          <div className="h-5 w-20 bg-gray-200 rounded mb-4" />
          <div className="h-4 w-48 bg-gray-200 rounded mb-6" />
          <div className="h-10 bg-gray-200 rounded mb-3" />
          <div className="h-10 w-24 bg-gray-200 rounded" />
        </div>
        <div className="border rounded-xl p-6">
          <div className="h-5 w-32 bg-gray-200 rounded mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-10 h-14 bg-gray-200 rounded shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
