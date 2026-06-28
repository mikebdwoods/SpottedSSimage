export default function Loading() {
  return (
    <div className="min-h-screen py-10 px-4 animate-pulse">
      <div className="mx-auto max-w-4xl">
        <div className="flex gap-3 mb-10">
          <div className="flex-1 h-14 rounded-xl bg-gray-200" />
          <div className="w-24 h-14 rounded-xl bg-gray-200 shrink-0" />
        </div>
        <div className="h-4 w-48 bg-gray-200 rounded mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border rounded-xl overflow-hidden">
              <div className="aspect-[3/4] bg-gray-200" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-1/2 bg-gray-200 rounded" />
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="h-3 w-2/3 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
