import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewsletterForm } from "@/components/newsletter-form";
import { CelebritySearch } from "@/components/celebrity-search";
import { formatPrice } from "@/lib/utils";
import { PUBLIC_PHOTO_STATUSES } from "@/lib/schema";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: celebs }, { data: looks }, { data: merch }] =
    await Promise.all([
      supabase
        .from("celebrities")
        .select("id, name, slug, photo_url, is_featured")
        .eq("status", "published")
        .order("is_featured", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("photos")
        .select("id, image_url, headline, created_at, celebrities(name, slug)")
        .in("status", PUBLIC_PHOTO_STATUSES)
        .order("created_at", { ascending: false })
        .limit(11),
      supabase
        .from("merch_products")
        .select("id, title, price, image_url, buy_url, product_url, celebrities(name)")
        .order("is_featured", { ascending: false })
        .order("sort_index", { ascending: true })
        .limit(8),
    ]);

  const topCelebs = celebs ?? [];
  const latestLooks = (looks ?? []).map((p) => ({
    ...p,
    celeb: p.celebrities as unknown as { name: string; slug: string } | null,
  }));

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
                id: c.id,
                name: c.name,
                slug: c.slug,
                image_url: c.photo_url,
              }))}
            />
          </div>
          {topCelebs.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {topCelebs.slice(0, 6).map((celeb) => (
                  <div
                    key={celeb.id}
                    className="relative w-9 h-9 rounded-full border-2 border-black overflow-hidden bg-gray-700"
                  >
                    {celeb.photo_url && (
                      <Image
                        src={celeb.photo_url}
                        alt={celeb.name}
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
                {celeb.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Category Shortcuts ───────────────────────────────── */}
      <section className="py-6 px-4 border-b bg-white">
        <div className="mx-auto max-w-7xl">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { slug: "dress", label: "Dresses" },
              { slug: "bag", label: "Bags" },
              { slug: "shoes", label: "Shoes" },
              { slug: "jacket", label: "Jackets" },
              { slug: "jeans", label: "Jeans" },
              { slug: "top", label: "Tops" },
              { slug: "skirt", label: "Skirts" },
              { slug: "trainers", label: "Trainers" },
              { slug: "sunglasses", label: "Sunglasses" },
              { slug: "jewellery", label: "Jewellery" },
            ].map(({ slug, label }) => (
              <Link
                key={slug}
                href={`/category/${slug}`}
                className="shrink-0 text-xs font-semibold border rounded-full px-3.5 py-1.5 hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Latest Looks ─────────────────────────────────────── */}
      {latestLooks.length > 0 && (
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
                href="/looks"
                className="text-sm font-medium hover:underline hidden sm:block"
              >
                View all looks →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {latestLooks.map((photo, i) => {
                if (!photo.celeb) return null;
                return (
                  <Link
                    key={photo.id}
                    href={`/celebrity/${photo.celeb.slug}/photo/${photo.id}`}
                    className={`group relative overflow-hidden rounded-2xl bg-gray-100 ${
                      i === 0 ? "col-span-2 row-span-2" : ""
                    }`}
                  >
                    <div
                      className={`aspect-[3/4] ${
                        i === 0 ? "sm:aspect-auto sm:h-full min-h-[360px]" : ""
                      } relative`}
                    >
                      {photo.image_url ? (
                        <Image
                          src={photo.image_url}
                          alt={photo.headline ?? `${photo.celeb.name} look`}
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
                          {photo.celeb.name}
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
                );
              })}
            </div>
          </div>
          <div className="flex justify-center mt-8 sm:hidden">
            <Link
              href="/looks"
              className="text-sm font-medium border rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              View all looks →
            </Link>
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
                  key={celeb.id}
                  href={`/celebrity/${celeb.slug}`}
                  className="group flex flex-col items-center text-center"
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-200 mb-2 ring-2 ring-transparent group-hover:ring-black transition-all duration-200">
                    {celeb.photo_url ? (
                      <Image
                        src={celeb.photo_url}
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
                  <p className="text-xs sm:text-sm font-medium leading-tight line-clamp-2">
                    {celeb.name}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Trending banner ──────────────────────────────────── */}
      <section className="py-8 px-4 bg-black text-white">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <div>
              <p className="font-bold text-sm sm:text-base">
                See what&apos;s trending right now
              </p>
              <p className="text-xs text-gray-400">
                The hottest celebrity looks this week
              </p>
            </div>
          </div>
          <Link
            href="/trending"
            className="shrink-0 bg-white text-black text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            View trending →
          </Link>
        </div>
      </section>

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
              {merch.map((item) => {
                const celeb = item.celebrities as unknown as { name: string } | null;
                return (
                  <a
                    key={item.id}
                    href={item.buy_url || item.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    <div className="aspect-square relative overflow-hidden rounded-2xl bg-gray-100 mb-3">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.title}
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
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {celeb?.name ? `${celeb.name}` : ""}
                      {item.price ? `${celeb?.name ? " · " : ""}${formatPrice(Number(item.price))}` : ""}
                    </p>
                  </a>
                );
              })}
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
