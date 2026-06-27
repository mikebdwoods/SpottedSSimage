import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CommentsSection } from "@/components/comments-section";
import { Badge } from "@/components/ui/badge";

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
    supabase.from("photos").select("fallback_image_url").eq("id", id).single(),
  ]);

  if (!celeb) return { title: "Look | Spotted" };

  return {
    title: `${celeb.name}'s Look | Spotted`,
    description: `See what ${celeb.name} is wearing — shop every item in this look.`,
    openGraph: {
      title: `${celeb.name}'s Look | Spotted`,
      images: photo?.fallback_image_url ? [{ url: photo.fallback_image_url }] : [],
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

  const [
    { data: photo },
    { data: celeb },
    { data: clothingItems },
    { data: comments },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("photos")
      .select("*")
      .eq("id", id)
      .eq("published", true)
      .single(),
    supabase.from("celebrities").select("*").eq("slug", slug).single(),
    supabase
      .from("clothing_items")
      .select("*")
      .eq("photo_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("comments")
      .select("*, profiles(display_name, avatar_url)")
      .eq("photo_id", id)
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  if (!photo || !celeb) notFound();

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:underline">Home</Link>
          {" / "}
          <Link href={`/celebrity/${slug}`} className="hover:underline">
            {celeb.name}
          </Link>
          {" / "}
          <span>Look</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Photo */}
          <div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100">
              {photo.fallback_image_url ? (
                <Image
                  src={photo.fallback_image_url}
                  alt={`${celeb.name} look`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No image available
                </div>
              )}
            </div>
          </div>

          {/* Clothing Items */}
          <div>
            <h1 className="text-xl font-bold mb-1">{celeb.name}</h1>
            <p className="text-muted-foreground text-sm mb-6">
              {new Date(photo.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            <h2 className="font-semibold mb-4">What they&apos;re wearing</h2>

            {!clothingItems || clothingItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Clothing items are being identified — check back soon.
              </p>
            ) : (
              <div className="space-y-3">
                {clothingItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/celebrity/${slug}/item/${item.id}`}
                    className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize">{item.category}</p>
                        {item.style_description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {item.style_description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {item.colour && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {item.colour}
                            </Badge>
                          )}
                          {item.estimated_brand && (
                            <Badge variant="secondary" className="text-xs">
                              {item.estimated_brand}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-primary font-medium shrink-0">
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
    </div>
  );
}
