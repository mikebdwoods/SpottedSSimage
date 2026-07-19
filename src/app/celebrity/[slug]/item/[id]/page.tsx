import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShoppingBag, ExternalLink, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ShareButton } from "@/components/share-button";
import { formatPrice } from "@/lib/utils";

export const revalidate = 60;

interface Product {
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  product_url: string | null;
}

interface Match {
  id: string;
  match_type: string | null;
  is_primary: boolean | null;
  score: number | null;
  products: Product | null;
}

// Below this, a match is category-only (e.g. "it's a jacket") with no
// brand or colour signal — real enough to list, but not confident enough
// to badge as a recommendation.
const CONFIDENT_MATCH_SCORE = 0.5;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const supabase = await createClient();
  const [{ data: celeb }, { data: item }] = await Promise.all([
    supabase.from("celebrities").select("name").eq("slug", slug).single(),
    supabase
      .from("clothing_items")
      .select("category, color, brand_guess")
      .eq("id", id)
      .single(),
  ]);

  if (!celeb || !item) return { title: "Shop the Look | Spotted" };

  const parts = [item.color, item.category, item.brand_guess].filter(Boolean);
  const desc = parts.length
    ? `Shop ${celeb.name}'s ${parts.join(" ")} — find budget, mid-range and premium alternatives.`
    : `Shop ${celeb.name}'s look on Spotted.`;

  return {
    title: `${celeb.name}'s ${item.category ?? "Item"} | Spotted`,
    description: desc,
    openGraph: { title: `${celeb.name}'s ${item.category ?? "Item"} | Spotted` },
  };
}

// Sort helper: cheapest first, unknown prices last
function byPriceAsc(a: Match, b: Match): number {
  const pa = a.products?.price ?? null;
  const pb = b.products?.price ?? null;
  if (pa == null && pb == null) return 0;
  if (pa == null) return 1;
  if (pb == null) return -1;
  return Number(pa) - Number(pb);
}

function ProductCard({ match, celebName }: { match: Match; celebName: string }) {
  const product = match.products!;
  return (
    <a
      href={product.product_url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col border border-border bg-card rounded-2xl overflow-hidden shadow-warm hover:shadow-warm-lg hover:border-clay/30 transition-all"
    >
      {/* Product image */}
      <div className="aspect-square relative overflow-hidden bg-secondary">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        {match.match_type === "exact" && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full">
            Exact match
          </div>
        )}
        {match.match_type === "celebrity_style_guess" && (
          <div
            className="absolute top-2 left-2 bg-card/90 text-foreground text-xs font-semibold px-2 py-0.5 rounded-full border border-dashed border-border"
            title={`No visible brand markings — suggested based on ${celebName}'s known style`}
          >
            Style guess
          </div>
        )}
        {match.is_primary &&
          match.match_type !== "exact" &&
          match.match_type !== "celebrity_style_guess" &&
          (match.score ?? 0) >= CONFIDENT_MATCH_SCORE && (
            <div className="absolute top-2 left-2 bg-card/90 text-foreground text-xs font-semibold px-2 py-0.5 rounded-full border border-border">
              Top pick
            </div>
          )}
      </div>

      {/* Product info */}
      <div className="p-3.5 flex flex-col flex-1">
        <p className="text-sm font-semibold line-clamp-2 flex-1">{product.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {[product.brand, product.retailer].filter(Boolean).join(" · ")}
        </p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <p className="text-base font-bold font-serif">
            {product.price != null ? formatPrice(Number(product.price)) : "See price"}
          </p>
          <span className="flex items-center gap-1 text-xs font-semibold text-clay">
            Buy
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

export default async function ClothingItemPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const [{ data: item }, { data: celeb }] = await Promise.all([
    supabase.from("clothing_items").select("*").eq("id", id).single(),
    supabase.from("celebrities").select("*").eq("slug", slug).single(),
  ]);

  if (!item || !celeb) notFound();

  const [{ data: rawMatches }, { data: moreLooks }] = await Promise.all([
    supabase
      .from("item_matches")
      .select("id, match_type, is_primary, score, products(*)")
      .eq("item_id", id)
      .order("is_primary", { ascending: false }),
    supabase
      .from("photos")
      .select("id, image_url")
      .eq("celeb_id", celeb.id)
      .in("status", ["live", "approved"])
      .neq("id", item.photo_id)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  // Only show matches that resolve to a real product with a URL
  const matches: Match[] = ((rawMatches ?? []) as unknown as Match[]).filter(
    (m) => m.products && (m.products.product_url || m.products.image_url)
  );

  // The exact garment (best-scoring 'exact' match), then verified cheaper
  // alternatives ('dupe', sourced specifically to cost less), then anything
  // else the generic matcher found. A "dupe" whose real page price turned
  // out to be >= the exact price gets demoted to "more like this" - the
  // "for less" section never lies.
  const exactMatch =
    matches
      .filter((m) => m.match_type === "exact")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
  const exactPrice = exactMatch?.products?.price ?? null;

  const cheaperAlternatives = matches
    .filter((m) => m.match_type === "dupe" && m.id !== exactMatch?.id)
    .filter((m) => {
      const p = m.products?.price ?? null;
      return exactPrice == null || p == null || Number(p) < Number(exactPrice);
    })
    .sort(byPriceAsc);

  const shownIds = new Set(
    [exactMatch?.id, ...cheaperAlternatives.map((m) => m.id)].filter(Boolean)
  );
  const otherMatches = matches
    .filter((m) => !shownIds.has(m.id))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const hasMatches = matches.length > 0;
  const totalMatches = matches.length;

  return (
    <div className="min-h-screen">
      {/* Sticky breadcrumb header */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur border-b border-border py-3 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <Link
            href={`/celebrity/${slug}/photo/${item.photo_id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to look
          </Link>
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground hidden sm:block">
              {totalMatches} {totalMatches === 1 ? "match" : "matches"}
            </p>
            <ShareButton title={`${celeb.name}'s ${item.category ?? "look"} on Spotted`} />
          </div>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="mx-auto max-w-5xl">
          {/* Item header */}
          <div className="mb-10">
            <div className="flex items-start gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-clay uppercase tracking-[0.15em] mb-1.5">
                  {celeb.name}
                </p>
                <h1 className="font-serif italic text-4xl tracking-tight capitalize">
                  {item.category}
                </h1>
                {item.description && (
                  <p className="text-muted-foreground mt-2.5 max-w-xl">
                    {item.description}
                  </p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {item.color && (
                <span className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-1 text-sm capitalize bg-card">
                  <span
                    className="w-3 h-3 rounded-full border border-border"
                    style={{ background: item.color.toLowerCase() }}
                  />
                  {item.color}
                </span>
              )}
              {item.brand_guess && (
                <span className="border border-border rounded-full px-3 py-1 text-sm font-medium bg-card">
                  {item.brand_guess}
                </span>
              )}
              {!item.brand_guess && item.inferred_brand && (
                <span
                  className="border border-dashed border-border rounded-full px-3 py-1 text-sm font-medium text-muted-foreground"
                  title={`No visible brand markings — likely brand based on ${celeb.name}'s known style`}
                >
                  Possibly {item.inferred_brand}
                </span>
              )}
            </div>
          </div>

          {/* Product Matches */}
          {!hasMatches ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl text-muted-foreground bg-secondary/30">
              <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-semibold mb-1">No matches yet</p>
              <p className="text-sm">
                We&apos;re finding shoppable alternatives — check back soon.
              </p>
            </div>
          ) : (
            <div className="space-y-14">
              {/* The exact one */}
              {exactMatch && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-serif italic text-2xl tracking-tight">The exact one</h2>
                    <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-primary text-primary-foreground">
                      As worn by {celeb.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <ProductCard match={exactMatch} celebName={celeb.name} />
                  </div>
                </div>
              )}

              {/* Cheaper alternatives */}
              {cheaperAlternatives.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-serif italic text-2xl tracking-tight">
                      {exactMatch ? "Get the look for less" : "Get the look"}
                    </h2>
                    <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-clay-soft text-clay-soft-foreground">
                      {exactMatch ? "Cheaper alternatives" : "Verified matches"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {cheaperAlternatives.map((match) => (
                      <ProductCard key={match.id} match={match} celebName={celeb.name} />
                    ))}
                  </div>
                </div>
              )}

              {/* Everything else the matcher found */}
              {otherMatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-serif italic text-2xl tracking-tight">More like this</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {otherMatches.map((match) => (
                      <ProductCard key={match.id} match={match} celebName={celeb.name} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* More from this celebrity */}
      {moreLooks && moreLooks.length > 0 && (
        <section className="py-12 px-4 bg-secondary/40 border-t border-border">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">More from {celeb.name}</h2>
              <Link
                href={`/celebrity/${slug}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {moreLooks.map((look) => (
                <Link
                  key={look.id}
                  href={`/celebrity/${slug}/photo/${look.id}`}
                  className="group"
                >
                  <div className="aspect-[3/4] relative overflow-hidden rounded-xl bg-secondary shadow-warm">
                    {look.image_url ? (
                      <Image
                        src={look.image_url}
                        alt={`${celeb.name} look`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No image
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* JSON-LD structured data */}
      {hasMatches && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${celeb.name}'s ${item.category ?? "item"} — shop the look`,
              numberOfItems: matches.length,
              itemListElement: matches.map((match, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "Product",
                  name: match.products!.title,
                  offers: {
                    "@type": "Offer",
                    url: match.products!.product_url,
                    priceCurrency: match.products!.currency ?? "GBP",
                    ...(match.products!.price != null
                      ? { price: Number(match.products!.price).toFixed(2) }
                      : {}),
                    ...(match.products!.retailer
                      ? {
                          seller: {
                            "@type": "Organization",
                            name: match.products!.retailer,
                          },
                        }
                      : {}),
                  },
                  ...(match.products!.image_url
                    ? { image: match.products!.image_url }
                    : {}),
                },
              })),
            }),
          }}
        />
      )}
    </div>
  );
}
