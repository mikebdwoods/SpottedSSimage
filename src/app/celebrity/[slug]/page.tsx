import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: celeb } = await supabase
    .from("celebrities")
    .select("name, bio, image_url")
    .eq("slug", slug)
    .single();

  if (!celeb) return { title: "Celebrity | Spotted" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spotted.co.uk";
  const ogParams = new URLSearchParams({
    title: celeb.name,
    subtitle: "Shop the look on Spotted",
    ...(celeb.image_url ? { image: celeb.image_url } : {}),
  });

  return {
    title: `${celeb.name} | Spotted`,
    description:
      celeb.bio ??
      `Shop ${celeb.name}'s outfits — find shoppable alternatives to every look.`,
    openGraph: {
      title: `${celeb.name} | Spotted`,
      images: [{ url: `${siteUrl}/api/og?${ogParams}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [`${siteUrl}/api/og?${ogParams}`],
    },
  };
}

export async function generateStaticParams() {
  // Use a plain fetch — createClient() uses cookies() which is unavailable at build time
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/rest/v1/celebrities?select=slug`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) return [];
    const data: { slug: string }[] = await res.json();
    return data.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export default async function CelebrityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: celeb } = await supabase
    .from("celebrities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!celeb) notFound();

  const [{ data: celebPhotos }, { data: celebMerch }] = await Promise.all([
    supabase
      .from("photos")
      .select("id, fallback_image_url, created_at")
      .eq("celebrity_id", celeb.id)
      .eq("published", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("merch_products")
      .select("*")
      .eq("celebrity_id", celeb.id),
  ]);

  return (
    <div className="min-h-screen">
      {/* Celebrity Header */}
      <div className="bg-gray-50 py-12 px-4">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row gap-8 items-center sm:items-start">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 shrink-0">
            {celeb.image_url ? (
              <Image
                src={celeb.image_url}
                alt={celeb.name}
                fill
                className="object-cover rounded-full"
                sizes="160px"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-4xl font-bold text-gray-400">
                {celeb.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-3">{celeb.name}</h1>
            {celeb.bio && (
              <p className="text-muted-foreground max-w-lg">{celeb.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Photos Grid */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-xl font-semibold mb-6">Looks</h2>
          {!celebPhotos || celebPhotos.length === 0 ? (
            <p className="text-muted-foreground">No looks posted yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {celebPhotos.map((photo) => (
                <Link
                  key={photo.id}
                  href={`/celebrity/${slug}/photo/${photo.id}`}
                  className="group"
                >
                  <div className="aspect-[3/4] relative overflow-hidden rounded-lg bg-gray-200">
                    {photo.fallback_image_url ? (
                      <Image
                        src={photo.fallback_image_url}
                        alt={`${celeb.name} look`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        No image
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Merch */}
      {celebMerch && celebMerch.length > 0 && (
        <section className="py-12 px-4 bg-gray-50">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-xl font-semibold mb-6">
              {celeb.name} Merch
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {celebMerch.map((item) => (
                <a
                  key={item.id}
                  href={item.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <div className="aspect-square relative overflow-hidden rounded-lg bg-gray-100 mb-3">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
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
                  <p className="text-sm font-medium">{item.name}</p>
                  {item.price_gbp && (
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.price_gbp)}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* JSON-LD Person schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: celeb.name,
            ...(celeb.bio ? { description: celeb.bio } : {}),
            ...(celeb.image_url ? { image: celeb.image_url } : {}),
          }),
        }}
      />
    </div>
  );
}
