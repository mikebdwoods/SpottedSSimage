import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditCelebrityForm } from "@/components/admin/edit-celebrity-form";
import { DeleteCelebrityButton } from "@/components/admin/delete-celebrity-button";

export default async function AdminCelebrityEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: celeb }, { data: photos }] = await Promise.all([
    supabase.from("celebrities").select("*").eq("id", id).single(),
    supabase
      .from("photos")
      .select("id, fallback_image_url, ai_status, published, created_at")
      .eq("celebrity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!celeb) notFound();

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/celebrities"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Celebrities
        </Link>
        <h1 className="text-2xl font-bold">{celeb.name}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Edit form */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            {celeb.image_url && (
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 shrink-0">
                <Image
                  src={celeb.image_url}
                  alt={celeb.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">Edit Details</h2>
              <p className="text-xs text-muted-foreground">
                Slug: <code>{celeb.slug}</code>
              </p>
            </div>
          </div>

          <EditCelebrityForm celebrity={celeb} />

          <div className="mt-8 pt-6 border-t">
            <p className="text-sm font-medium text-destructive mb-2">Danger zone</p>
            <DeleteCelebrityButton id={celeb.id} name={celeb.name} />
          </div>
        </div>

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Photos ({photos?.length ?? 0})
            </h2>
            <Link
              href={`/admin/upload`}
              className="text-xs text-blue-600 hover:underline"
            >
              Upload new →
            </Link>
          </div>

          {!photos || photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <Link
                  key={photo.id}
                  href={`/admin/photos/${photo.id}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100"
                >
                  {photo.fallback_image_url ? (
                    <Image
                      src={photo.fallback_image_url}
                      alt="Photo"
                      fill
                      className="object-cover group-hover:opacity-75 transition-opacity"
                      sizes="33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      No image
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1.5 py-1 flex justify-between">
                    <span className={photo.published ? "text-green-400" : "text-gray-400"}>
                      {photo.published ? "Live" : "Draft"}
                    </span>
                    <span className="capitalize">{photo.ai_status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
