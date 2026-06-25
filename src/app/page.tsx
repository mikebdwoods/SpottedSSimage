import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewsletterForm } from "@/components/newsletter-form";
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
      <section className="bg-black text-white py-20 px-4 text-center">
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-4">
          Spotted
        </h1>
        <p className="text-lg sm:text-xl text-gray-300 max-w-xl mx-auto">
          Discover what your favourite celebrities are wearing — and shop the
          look
        </p>
      </section>

      {/* Celebrity Grid */}
      {featuredCelebs && featuredCelebs.length > 0 && (
        <section className="py-16 px-4">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-2xl font-bold mb-8">Celebrities</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {featuredCelebs.map((celeb: Row) => (
                <Link
                  key={celeb.id as string}
                  href={`/celebrity/${celeb.slug}`}
                  className="group"
                >
                  <div className="aspect-square relative overflow-hidden rounded-full bg-gray-100 mb-3">
                    {celeb.image_url ? (
                      <Image
                        src={celeb.image_url as string}
                        alt={celeb.name as string}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
                        {(celeb.name as string).charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-center truncate">
                    {celeb.name as string}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest Looks */}
      {latestLooks && latestLooks.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-2xl font-bold mb-8">Latest Looks</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {latestLooks.map((photo: Row) => (
                <Link
                  key={photo.id as string}
                  href={`/celebrity/${photo.celebrity_slug || photo.slug}/photo/${photo.id}`}
                  className="group"
                >
                  <div className="aspect-[3/4] relative overflow-hidden rounded-lg bg-gray-200">
                    {photo.fallback_image_url ? (
                      <Image
                        src={photo.fallback_image_url as string}
                        alt={`${photo.celebrity_name || photo.name} look`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium">
                    {String(photo.celebrity_name ?? photo.name ?? "")}
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
            <h2 className="text-2xl font-bold mb-8">Official Merch</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {merch.map((item: Row) => (
                <a
                  key={item.id as string}
                  href={item.product_url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <div className="aspect-square relative overflow-hidden rounded-lg bg-gray-100 mb-3">
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
                  <p className="text-sm font-medium">{item.name as string}</p>
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
      <section className="py-16 px-4 bg-black text-white">
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-2xl font-bold mb-2">Stay in the loop</h2>
          <p className="text-gray-400 mb-6">
            Get the latest celebrity looks delivered to your inbox.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </div>
  );
}
