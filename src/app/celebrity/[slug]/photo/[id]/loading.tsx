export default function Loading() {
  return (
    <div className="min-h-screen py-8 px-4 animate-pulse">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2 items-center">
            <div className="h-4 w-10 bg-gray-200 rounded" />
            <div className="h-4 w-2 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
          <div className="h-8 w-20 bg-gray-200 rounded-lg" />
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Photo */}
          <div className="aspect-[3/4] rounded-xl bg-gray-200" />

          {/* Clothing items */}
          <div>
            <div className="h-6 w-32 bg-gray-200 rounded mb-1" />
            <div className="h-4 w-24 bg-gray-200 rounded mb-6" />
            <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-48 bg-gray-200 rounded mb-3" />
                  <div className="flex gap-2">
                    <div className="h-5 w-14 bg-gray-200 rounded-full" />
                    <div className="h-5 w-20 bg-gray-200 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
