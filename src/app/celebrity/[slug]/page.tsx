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

  const lookCount = celebPhotos?.length ?? 0;

  return (
    <div className="min-h-screen">
      {/* Celebrity Header */}
      <div className="relative bg-black text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-14 flex flex-col sm:flex-row gap-8 items-center sm:items-start">
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0">
            {celeb.image_url ? (
              <Image
                src={celeb.image_url}
                alt={celeb.name}
                fill
                className="object-cover rounded-full ring-4 ring-white/10"
                sizes="144px"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-700 ring-4 ring-white/10 flex items-center justify-center text-4xl font-bold text-gray-400">
                {celeb.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase mb-2">
              Celebrity
            </p>
            <h1 className="text-4xl font-black tracking-tight mb-3">{celeb.name}</h1>
            {celeb.bio && (
              <p className="text-gray-300 max-w-lg text-sm leading-relaxed mb-4">
                {celeb.bio}
              </p>
            )}
            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <span className="text-sm text-gray-400">
                <span className="font-semibold text-white">{lookCount}</span>{" "}
                look{lookCount === 1 ? "" : "s"}
              </span>
              {lookCount > 0 && (
                <a
                  href="#looks"
                  className="text-xs font-semibold bg-white text-black px-4 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  Browse looks
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Photos Grid */}
      <section id="looks" className="py-12 px-4">
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
