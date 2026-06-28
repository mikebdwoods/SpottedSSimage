import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Trending Now | Spotted",
  description:
    "The hottest celebrity looks right now — trending outfits you can shop on Spotted.",
};

export default async function TrendingPage() {
  const supabase = await createClient();

  const [{ data: topCelebs }, { data: mostShopped }, { data: latestLooks }] =
    await Promise.all([
      supabase
        .from("celebrities")
        .select("id, name, slug, image_url, photos(count)")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("photos")
        .select(
          "id, fallback_image_url, created_at, celebrities(name, slug), clothing_items(count)"
        )
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("photos")
        .select("id, fallback_image_url, created_at, celebrities(name, slug)")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  type CelebRow = {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    photo_count: number;
  };

  const celebrities: CelebRow[] = (topCelebs ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    image_url: c.image_url,
    photo_count:
      Array.isArray(c.photos) && c.photos.length > 0
        ? (c.photos[0] as { count: number }).count
        : 0,
  }));

  const trendingCelebs = [...celebrities]
    .sort((a, b) => b.photo_count - a.photo_count)
    .slice(0, 6);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-black text-white py-12 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Live
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Trending Now</h1>
          <p className="text-gray-400 text-sm">
            The most-spotted celebrity looks this week
          </p>
        </div>
      </div>

      {/* Trending celebrities */}
      {trendingCelebs.length > 0 && (
        <section className="py-10 px-4 border-b">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-lg font-bold mb-5">
              Most active celebrities
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {trendingCelebs.map((celeb, i) => (
                <Link
                  key={celeb.id}
                  href={`/celebrity/${celeb.slug}`}
                  className="group flex flex-col items-center text-center"
                >
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-200 ring-2 ring-transparent group-hover:ring-black transition-all duration-200">
                      {celeb.image_url ? (
                        <Image
                          src={celeb.image_url}
                          alt={celeb.name}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                          sizes="80px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                          {celeb.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-xs font-semibold mt-2 leading-tight line-clamp-2">
                    {celeb.name}
                  </p>
                  {celeb.photo_count > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {celeb.photo_count} look{celeb.photo_count === 1 ? "" : "s"}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Most shopped looks */}
      {mostShopped && mostShopped.length > 0 && (
        <section className="py-10 px-4 border-b">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-lg font-bold">Most shoppable looks</h2>
              <Link href="/looks" className="text-sm text-muted-foreground hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {mostShopped.map((photo) => {
                const celeb = photo.celebrities as unknown as { name: string; slug: string } | null;
                const itemCount = Array.isArray(photo.clothing_items)
                  ? (photo.clothing_items[0] as { count: number } | undefined)?.count ?? 0
                  : 0;
                if (!celeb) return null;
                return (
                  <Link
                    key={photo.id}
                    href={`/celebrity/${celeb.slug}/photo/${photo.id}`}
                    className="group"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden rounded-xl bg-gray-100">
                      {photo.fallback_image_url ? (
                        <Image
                          src={photo.fallback_image_url}
                          alt={`${celeb.name} look`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 50vw, 15vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No image
                        </div>
                      )}
                      {itemCount > 0 && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                          {itemCount} item{itemCount === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium mt-1.5 truncate">{celeb.name}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Latest looks */}
      {latestLooks && latestLooks.length > 0 && (
        <section className="py-10 px-4">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-lg font-bold">Just spotted</h2>
              <Link href="/looks" className="text-sm text-muted-foreground hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-3">
              {latestLooks.slice(0, 10).map((photo, i) => {
                const celeb = photo.celebrities as unknown as { name: string; slug: string } | null;
                if (!celeb) return null;
                return (
                  <Link
                    key={photo.id}
                    href={`/celebrity/${celeb.slug}/photo/${photo.id}`}
                    className={`group relative overflow-hidden rounded-2xl bg-gray-100 ${
                      i === 0 ? "col-span-2 row-span-2" : ""
                    }`}
                  >
                    <div
                      className={`aspect-[3/4] ${
                        i === 0 ? "sm:aspect-auto sm:h-full min-h-[280px]" : ""
                      } relative`}
                    >
                      {photo.fallback_image_url ? (
                        <Image
                          src={photo.fallback_image_url}
                          alt={`${celeb.name} look`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-700"
                          sizes={
                            i === 0
                              ? "(max-width: 640px) 100vw, 40vw"
                              : "(max-width: 640px) 50vw, 20vw"
                          }
                          priority={i === 0}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No image
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-sm font-semibold">{celeb.name}</p>
                        <p className="text-white/60 text-xs">Shop the look →</p>
                      </div>
                      {i === 0 && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                            Hot 🔥
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
