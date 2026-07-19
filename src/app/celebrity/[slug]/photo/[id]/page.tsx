import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CommentsSection } from "@/components/comments-section";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { PhotoProcessingNotice } from "@/components/photo-processing-notice";
import { SaveLookButton } from "@/components/save-look-button";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const supabase = await createClient();
  const [{ data: celeb }, { data: photo }] = await Promise.all([
    supabase.from("celebrities").select("name").eq("slug", slug).single(),
    supabase.from("photos").select("image_url").eq("id", id).single(),
  ]);

  if (!celeb) return { title: "Look | Spotted" };

  return {
    title: `${celeb.name}'s Look | Spotted`,
    description: `See what ${celeb.name} is wearing — shop every item in this look.`,
    openGraph: {
      title: `${celeb.name}'s Look | Spotted`,
      images: photo?.image_url ? [{ url: photo.image_url }] : [],
    },
  };
}

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: photo },
    { data: celeb },
    { data: clothingItems },
    { data: comments },
    { data: savedRow },
  ] = await Promise.all([
    supabase
      .from("photos")
      .select("*")
      .eq("id", id)
      .in("status", ["live", "approved"])
      .single(),
    supabase.from("celebrities").select("*").eq("slug", slug).single(),
    supabase
      .from("clothing_items")
      .select("*")
      .eq("photo_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("comments")
      .select("*, profiles(display_name, avatar_url)")
      .eq("photo_id", id)
      .order("created_at", { ascending: true }),
    user
      ? supabase
          .from("saved_looks")
          .select("id")
          .eq("user_id", user.id)
          .eq("photo_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!photo || !celeb) notFound();

  const itemCount = clothingItems?.length ?? 0;
  const isSaved = !!savedRow;

  return (
    <div className="min-h-screen py-8 px-4 pb-24 md:pb-8">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb + share */}
        <div className="flex items-center justify-between mb-6">
          <nav className="text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">Home</Link>
            {" / "}
            <Link href={`/celebrity/${slug}`} className="hover:underline">
              {celeb.name}
            </Link>
            {" / "}
            <span>Look</span>
          </nav>
          <div className="flex items-center gap-2">
            <SaveLookButton photoId={id} initialSaved={isSaved} isSignedIn={!!user} />
            <ShareButton title={`${celeb.name}'s Look on Spotted`} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Photo */}
          <div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-secondary shadow-warm-lg">
              {photo.image_url ? (
                <Image
                  src={photo.image_url}
                  alt={`${celeb.name} look`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No image available
                </div>
              )}
            </div>
          </div>

          {/* Clothing Items */}
          <div id="clothing-items">
            <p className="text-xs font-semibold tracking-[0.15em] text-clay uppercase mb-1.5">
              {celeb.name}
            </p>
            <h1 className="font-serif italic text-3xl tracking-tight mb-1">Shop this look</h1>
            <p className="text-muted-foreground text-sm mb-6">
              {new Date(photo.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            <h2 className="font-semibold mb-4">What they&apos;re wearing</h2>

            <PhotoProcessingNotice photoId={id} status={photo.ai_status} />

            {!clothingItems || clothingItems.length === 0 ? (
              photo.ai_status === "done" ? (
                <p className="text-muted-foreground text-sm">
                  No clothing items were identified for this look.
                </p>
              ) : null
            ) : (
              <div className="space-y-3">
                {clothingItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/celebrity/${slug}/item/${item.id}`}
                    className="group block border border-border bg-card rounded-2xl p-4 hover:border-clay/40 hover:shadow-warm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize">{item.category}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {item.description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {item.color && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {item.color}
                            </Badge>
                          )}
                          {item.brand_guess && (
                            <Badge variant="secondary" className="text-xs">
                              {item.brand_guess}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-clay font-semibold shrink-0 group-hover:translate-x-0.5 transition-transform">
                        Shop →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="mt-12">
          <CommentsSection
            photoId={id}
            comments={comments ?? []}
            currentUser={user}
            celebritySlug={slug}
          />
        </div>
      </div>

      {/* Mobile sticky CTA */}
      {itemCount > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 flex items-center gap-3 shadow-warm-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              {celeb.name}&apos;s look
            </p>
            <p className="text-sm font-semibold">
              {itemCount} item{itemCount === 1 ? "" : "s"} to shop
            </p>
          </div>
          <a
            href="#clothing-items"
            className="bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-primary/88 transition-colors shrink-0"
          >
            Shop the look
          </a>
        </div>
      )}
    </div>
  );
}
