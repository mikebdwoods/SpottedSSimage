import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PhotoActions } from "@/components/admin/photo-actions";
import { BatchAIButton } from "@/components/admin/batch-ai-button";
import { ProcessingRefresh } from "@/components/admin/processing-refresh";

const STATUS_COLOUR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default async function AdminPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("photos")
    .select(
      "id, fallback_image_url, ai_status, published, created_at, celebrities(name, slug)"
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("ai_status", status);
  }

  const { data: photos } = await query;

  const pendingPhotoIds =
    photos?.filter((p) => p.ai_status === "pending").map((p) => p.id) ?? [];
  const processingCount = photos?.filter((p) => p.ai_status === "processing").length ?? 0;

  const statuses = ["pending", "processing", "complete", "failed"];

  return (
    <div>
      <ProcessingRefresh processingCount={processingCount} />

      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Photos</h1>
        <div className="flex items-center gap-2">
          <BatchAIButton pendingPhotoIds={pendingPhotoIds} />
          <Link
            href="/admin/import"
            className="text-sm border px-3 py-2 rounded-md hover:bg-gray-50 transition-colors"
          >
            Import URL
          </Link>
          <Link
            href="/admin/upload"
            className="text-sm bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
          >
            Upload new
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href="/admin/photos"
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !status ? "bg-black text-white border-black" : "hover:bg-gray-100"
          }`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/photos?status=${s}`}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
              status === s
                ? "bg-black text-white border-black"
                : "hover:bg-gray-100"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {!photos || photos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No photos found.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Photo</th>
                <th className="text-left px-4 py-3 font-medium">Celebrity</th>
                <th className="text-left px-4 py-3 font-medium">AI Status</th>
                <th className="text-left px-4 py-3 font-medium">Published</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {photos.map((photo) => {
                const celeb = (photo.celebrities as unknown) as { name: string; slug: string } | null;
                return (
                  <tr key={photo.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/photos/${photo.id}`}>
                      <div className="w-12 h-16 relative overflow-hidden rounded bg-gray-100 hover:opacity-75 transition-opacity">
                        {photo.fallback_image_url ? (
                          <Image
                            src={photo.fallback_image_url}
                            alt="Photo"
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            —
                          </div>
                        )}
                      </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">{celeb?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLOUR[photo.ai_status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {photo.ai_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          photo.published ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        {photo.published ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(photo.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      <PhotoActions
                        photoId={photo.id}
                        aiStatus={photo.ai_status}
                        published={photo.published}
                        celebSlug={celeb?.slug}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
