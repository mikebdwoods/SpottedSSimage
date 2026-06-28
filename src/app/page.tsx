import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewsletterForm } from "@/components/newsletter-form";
import { CelebritySearch } from "@/components/celebrity-search";
import { formatPrice } from "@/lib/utils";

export const revalidate = 60;

type Row = Record<string, string | number | boolean | null | undefined>;

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: featuredCelebs }, { data: latestLooks }, { data: merch }] =
    await Promise.all([
      supabase.from("v_home_featured_celebs").select("*"),
      supabase.from("v_home_latest_looks").select("*"),
      supabase.from("v_home_merch_products").select("*"),
    ]);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-black text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black opacity-90" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:py-36 flex flex-col items-center text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-gray-400 uppercase mb-4">
            UK Celebrity Fashion
          </p>
          <h1 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter mb-6 leading-none">
            Spotted
          </h1>
          <p className="text-base sm:text-lg text-gray-300 max-w-md leading-relaxed">
            Discover what your favourite celebrities are wearing&nbsp;—
            and shop the look for less
          </p>
          <div className="mt-10 w-full max-w-sm mx-auto">
            <CelebritySearch
              celebrities={
                (featuredCelebs ?? []).map((c) => ({
                  id: String(c.id ?? ""),
                  name: String(c.name ?? ""),
                  slug: String(c.slug ?? ""),
                  image_url: c.image_url ? String(c.image_url) : null,
                }))
              }
            />
          </div>
          {featuredCelebs && featuredCelebs.length > 0 && (
            <div className="flex items-center gap-3 mt-6">
              <div className="flex -space-x-3">
                {(featuredCelebs as Row[]).slice(0, 5).map((celeb) => (
                  <div
                    key={celeb.id as string}
                    className="relative w-9 h-9 rounded-full border-2 border-black overflow-hidden bg-gray-700"
                  >
                    {celeb.image_url && (
                      <Image
                        src={celeb.image_url as string}
                        alt={celeb.name as string}
                        fill
                        className="object-cover"
                        sizes="36px"
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400">
                {featuredCelebs.length} celebrities
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Looks — full-bleed masonry-style grid */}
      {latestLooks && latestLooks.length > 0 && (
        <section className="py-16 px-4">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tight">Latest Looks</h2>
              <span className="text-sm text-muted-foreground">
                {latestLooks.length} looks
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(latestLooks as Row[]).map((photo, i) => (
                <Link
                  key={photo.id as string}
                  href={`/celebrity/${photo.celebrity_slug ?? photo.slug}/photo/${photo.id}`}
                  className={`group relative overflow-hidden rounded-xl bg-gray-100 ${
                    i === 0 ? "col-span-2 row-span-2" : ""
                  }`}
                >
                  <div className={`aspect-[3/4] ${i === 0 ? "sm:aspect-auto sm:h-full min-h-[400px]" : ""} relative`}>
                    {photo.fallback_image_url ? (
                      <Image
                        src={photo.fallback_image_url as string}
                        alt={String(photo.celebrity_name ?? photo.name ?? "Look")}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
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
                    {/* Gradient overlay with celeb name */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <p className="text-white text-sm font-medium">
                        {String(photo.celebrity_name ?? photo.name ?? "")}
                      </p>
                      <p className="text-white/70 text-xs">Shop the look →</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Celebrity Grid */}
      {featuredCelebs && featuredCelebs.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-2xl font-bold tracking-tight mb-8">
              Browse by Celebrity
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6">
              {(featuredCelebs as Row[]).map((celeb) => (
                <Link
                  key={celeb.id as string}
                  href={`/celebrity/${celeb.slug}`}
                  className="group flex flex-col items-center text-center"
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-200 mb-2 ring-2 ring-transparent group-hover:ring-black transition-all duration-200">
                    {celeb.image_url ? (
                      <Image
                        src={celeb.image_url as string}
                        alt={celeb.name as string}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                        {(celeb.name as string).charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-medium leading-tight">
                    {celeb.name as string}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Merch */}
      {merch && merch.length > 0 && (
        <section className="py-16 px-4">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-2xl font-bold tracking-tight mb-8">
              Official Merch
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {(merch as Row[]).map((item) => (
                <a
                  key={item.id as string}
                  href={item.product_url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <div className="aspect-square relative overflow-hidden rounded-xl bg-gray-100 mb-3">
                    {item.image_url ? (
                      <Image
                        src={item.image_url as string}
                        alt={item.name as string}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold">{item.name as string}</p>
                  {item.price_gbp && (
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.price_gbp as number)}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="py-20 px-4 bg-black text-white">
        <div className="mx-auto max-w-md text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-gray-500 uppercase mb-3">
            Stay ahead
          </p>
          <h2 className="text-3xl font-black tracking-tight mb-2">
            Be the first to know
          </h2>
          <p className="text-gray-400 mb-8 text-sm">
            New looks, shopping finds, and celebrity fashion — direct to your inbox.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </div>
  );
}
