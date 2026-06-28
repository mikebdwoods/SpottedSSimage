import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhotoActions } from "@/components/admin/photo-actions";
import { AIStatusPoller } from "@/components/admin/ai-status-poller";
import {
  AddClothingItemForm,
  DeleteClothingItemButton,
} from "@/components/admin/add-clothing-item-form";

export default async function AdminPhotoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: photo }, { data: clothingItems }] = await Promise.all([
    supabase
      .from("photos")
      .select("*, celebrities(name, slug)")
      .eq("id", id)
      .single(),
    supabase
      .from("clothing_items")
      .select("*, product_matches(id)")
      .eq("photo_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!photo) notFound();

  const celeb = photo.celebrities as { name: string; slug: string } | null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/photos"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Photos
        </Link>
        <h1 className="text-2xl font-bold">Photo Detail</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Photo + meta */}
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100 mb-4">
            {photo.fallback_image_url ? (
              <Image
                src={photo.fallback_image_url}
                alt="Photo"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Celebrity</span>
              <span className="font-medium">{celeb?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Status</span>
              <AIStatusPoller photoId={photo.id} initialStatus={photo.ai_status} />
            </div>
            {photo.ai_error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-mono break-all">
                {photo.ai_error}
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Published</span>
              <span
                className={
                  photo.published ? "text-green-600 font-medium" : "text-gray-400"
                }
              >
                {photo.published ? "Yes" : "No"}
              </span>
            </div>
            {photo.source_url && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Source</span>
                <a
                  href={photo.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {photo.source_url}
                </a>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uploaded</span>
              <span>
                {new Date(photo.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <PhotoActions
              photoId={photo.id}
              aiStatus={photo.ai_status}
              published={photo.published}
              celebSlug={celeb?.slug}
            />
          </div>
        </div>

        {/* Clothing Items */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Clothing Items ({clothingItems?.length ?? 0})
          </h2>

          {!clothingItems || clothingItems.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground text-sm">
              {photo.ai_status === "pending" || photo.ai_status === "processing" ? (
                <p>AI processing has not completed yet.</p>
              ) : (
                <p>No clothing items found. Try running AI again.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {clothingItems.map((item) => {
                const matchCount = Array.isArray(item.product_matches)
                  ? item.product_matches.length
                  : 0;
                return (
                  <Link
                    key={item.id}
                    href={`/admin/items/${item.id}`}
                    className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium capitalize">
                          {item.category}
                        </p>
                        {item.style_description && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {item.style_description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2 text-xs">
                          {item.colour && (
                            <span className="bg-gray-100 rounded-full px-2 py-0.5 capitalize">
                              {item.colour}
                            </span>
                          )}
                          {item.estimated_brand && (
                            <span className="bg-gray-100 rounded-full px-2 py-0.5">
                              {item.estimated_brand}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            matchCount > 0
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {matchCount} match{matchCount !== 1 ? "es" : ""}
                        </span>
                        <p className="text-xs text-blue-600 mt-2">Edit →</p>
                        <DeleteClothingItemButton
                          itemId={item.id}
                          photoId={photo.id}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <AddClothingItemForm photoId={photo.id} />
        </div>
      </div>
    </div>
  );
}
