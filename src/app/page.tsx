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

  const topCelebs = (featuredCelebs ?? []) as Row[];
  const looks = (latestLooks ?? []) as Row[];

  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative bg-black text-white overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:py-36 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.3em] text-gray-400 uppercase mb-6 border border-gray-700 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            UK Celebrity Fashion
          </span>
          <h1 className="text-7xl sm:text-9xl font-black tracking-tighter mb-6 leading-none">
            Spotted
          </h1>
          <p className="text-base sm:text-lg text-gray-300 max-w-md leading-relaxed mb-10">
            Discover what your favourite celebrities are wearing&nbsp;—
            and shop the look for less.
          </p>
          <div className="w-full max-w-sm mx-auto mb-6">
            <CelebritySearch
              celebrities={topCelebs.map((c) => ({
                id: String(c.id ?? ""),
                name: String(c.name ?? ""),
                slug: String(c.slug ?? ""),
                image_url: c.image_url ? String(c.image_url) : null,
              }))}
            />
          </div>
          {topCelebs.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {topCelebs.slice(0, 6).map((celeb) => (
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
                {topCelebs.length} celebrities tracked
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Ticker strip ─────────────────────────────────────── */}
      {topCelebs.length > 0 && (
        <div className="bg-black border-t border-gray-800 py-2.5 overflow-hidden">
          <div className="flex animate-[marquee_30s_linear_infinite] whitespace-nowrap">
            {[...topCelebs, ...topCelebs].map((celeb, i) => (
              <Link
                key={i}
                href={`/celebrity/${celeb.slug}`}
                className="inline-flex items-center gap-2 mx-6 text-xs text-gray-400 hover:text-white transition-colors shrink-0"
              >
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                {celeb.name as string}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Latest Looks ─────────────────────────────────────── */}
      {looks.length > 0 && (
        <section className="py-16 px-4">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-baseline justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Latest Looks</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Just spotted — click to shop each item
                </p>
              </div>
              <Link
                href="/celebrities"
                className="text-sm font-medium hover:underline hidden sm:block"
              >
                Browse all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {looks.map((photo, i) => (
                <Link
                  key={photo.id as string}
                  href={`/celebrity/${photo.celebrity_slug ?? photo.slug}/photo/${photo.id}`}
                  className={`group relative overflow-hidden rounded-2xl bg-gray-100 ${
                    i === 0 ? "col-span-2 row-span-2" : ""
                  }`}
                >
                  <div
                    className={`aspect-[3/4] ${
                      i === 0 ? "sm:aspect-auto sm:h-full min-h-[360px]" : ""
                    } relative`}
                  >
                    {photo.fallback_image_url ? (
                      <Image
                        src={photo.fallback_image_url as string}
                        alt={String(photo.celebrity_name ?? photo.name ?? "Look")}
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
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-semibold leading-tight">
                        {String(photo.celebrity_name ?? photo.name ?? "")}
                      </p>
                      <p className="text-white/60 text-xs mt-0.5">Shop the look →</p>
                    </div>
                    {i === 0 && (
                      <div className="absolute top-3 left-3">
                        <span className="bg-white text-black text-xs font-bold px-2.5 py-1 rounded-full">
                          New
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Celebrity Grid ───────────────────────────────────── */}
      {topCelebs.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-2xl font-black tracking-tight">Browse by Celebrity</h2>
              <Link href="/celebrities" className="text-sm font-medium hover:underline">
                See all {topCelebs.length} →
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6">
              {topCelebs.map((celeb) => (
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
                  <p className="text-xs sm:text-sm font-medium leading-tight line-clamp-2">
                    {celeb.name as string}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-black tracking-tight mb-2">How Spotted works</h2>
          <p className="text-muted-foreground text-sm mb-10">
            From paparazzi pic to your basket in three steps.
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: "1", title: "We spot the look", desc: "Our team tracks celebrity outfits across the UK and beyond." },
              { step: "2", title: "AI tags each item", desc: "Every piece is categorised by type, colour, and brand." },
              { step: "3", title: "You shop for less", desc: "Choose from budget, mid-range, or premium alternatives." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-lg font-black mb-4">
                  {step}
                </div>
                <h3 className="font-bold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Merch ────────────────────────────────────────────── */}
      {merch && merch.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-2xl font-black tracking-tight mb-2">Official Merch</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Direct from your favourite celebrities.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {(merch as Row[]).map((item) => (
                <a
                  key={item.id as string}
                  href={item.product_url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <div className="aspect-square relative overflow-hidden rounded-2xl bg-gray-100 mb-3">
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

      {/* ── Newsletter ───────────────────────────────────────── */}
      <section id="newsletter" className="py-20 px-4 bg-black text-white">
        <div className="mx-auto max-w-md text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-gray-500 uppercase mb-3">
            Stay ahead
          </p>
          <h2 className="text-4xl font-black tracking-tight mb-2 leading-none">
            Be the first to know
          </h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            New looks, shopping finds, and celebrity fashion drops — direct to
            your inbox.
          </p>
          <NewsletterForm />
          <p className="text-xs text-gray-600 mt-4">
            No spam. Unsubscribe any time.
          </p>
        </div>
      </section>
    </div>
  );
}
