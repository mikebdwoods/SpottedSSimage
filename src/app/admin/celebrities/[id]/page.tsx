import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditCelebrityForm } from "@/components/admin/edit-celebrity-form";
import { DeleteCelebrityButton } from "@/components/admin/delete-celebrity-button";
import { PublishCelebrityToggle } from "@/components/admin/publish-celebrity-toggle";
import { RebuildBrandProfileButton } from "@/components/admin/rebuild-brand-profile-button";

export default async function AdminCelebrityEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: celeb }, { data: photos }, { data: brandAffinity }] = await Promise.all([
    supabase.from("celebrities").select("*").eq("id", id).single(),
    supabase
      .from("photos")
      .select("id, image_url, ai_status, status, created_at")
      .eq("celeb_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("celebrity_brand_affinity")
      .select("category, brand, confidence, source, evidence_count")
      .eq("celeb_id", id)
      .order("confidence", { ascending: false }),
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
            {celeb.photo_url && (
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 shrink-0">
                <Image
                  src={celeb.photo_url}
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

          <div className="mt-6 pt-6 border-t">
            <PublishCelebrityToggle
              id={celeb.id}
              isPublished={celeb.status === "published"}
            />
          </div>

          <div className="mt-8 pt-6 border-t">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold">Brand knowledge</h2>
                <p className="text-xs text-muted-foreground">
                  Used as an educated guess for product matching when the AI can&apos;t read a brand off a garment.
                </p>
              </div>
              <RebuildBrandProfileButton celebId={celeb.id} />
            </div>
            {!brandAffinity || brandAffinity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No brand knowledge yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {brandAffinity.map((row, i) => (
                  <li key={i} className="flex items-center justify-between text-xs border rounded-lg px-3 py-1.5">
                    <span>
                      <span className="capitalize font-medium">{row.category ?? "any"}</span>
                      {" — "}
                      {row.brand}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={row.source === "observed" ? "text-green-700" : "text-blue-700"}>
                        {row.source === "observed" ? `observed ×${row.evidence_count}` : "ai guess"}
                      </span>
                      {Math.round(row.confidence * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
                  {photo.image_url ? (
                    <Image
                      src={photo.image_url}
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
                    <span className={photo.status === "live" ? "text-green-400" : "text-gray-400"}>
                      <span className="capitalize">{photo.status}</span>
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
