import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShoppingBag, ExternalLink, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const revalidate = 60;

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
      .select("category, colour, estimated_brand")
      .eq("id", id)
      .single(),
  ]);

  if (!celeb || !item) return { title: "Shop the Look | Spotted" };

  const parts = [item.colour, item.category, item.estimated_brand].filter(Boolean);
  const desc = parts.length
    ? `Shop ${celeb.name}'s ${parts.join(" ")} — find budget, mid-range and premium alternatives.`
    : `Shop ${celeb.name}'s look on Spotted.`;

  return {
    title: `${celeb.name}'s ${item.category ?? "Item"} | Spotted`,
    description: desc,
    openGraph: { title: `${celeb.name}'s ${item.category ?? "Item"} | Spotted` },
  };
}

type PriceTier = "premium" | "mid" | "budget";

const TIER_CONFIG: Record<
  PriceTier,
  { label: string; range: string; badgeClass: string }
> = {
  premium: {
    label: "Premium",
    range: "£70+",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  mid: {
    label: "Mid-Range",
    range: "£45–£70",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
  },
  budget: {
    label: "Budget",
    range: "under £45",
    badgeClass: "bg-green-50 text-green-800 border-green-200",
  },
};

const TIER_ORDER: PriceTier[] = ["premium", "mid", "budget"];

export default async function ClothingItemPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const [{ data: item }, { data: celeb }] = await Promise.all([
    supabase.from("v_clothing_item").select("*").eq("id", id).single(),
    supabase.from("celebrities").select("*").eq("slug", slug).single(),
  ]);

  if (!item || !celeb) notFound();

  const { data: productMatches } = await supabase
    .from("product_matches")
    .select("*")
    .eq("clothing_item_id", id)
    .order("sort_order", { ascending: true });

  const matchesByTier = TIER_ORDER.reduce<
    Record<PriceTier, typeof productMatches>
  >(
    (acc, tier) => {
      acc[tier] = productMatches?.filter((m) => m.price_tier === tier) ?? [];
      return acc;
    },
    { premium: [], mid: [], budget: [] }
  );

  const hasMatches = productMatches && productMatches.length > 0;
  const totalMatches = productMatches?.length ?? 0;

  return (
    <div className="min-h-screen">
      {/* Sticky breadcrumb header */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur border-b py-3 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <Link
            href={`/celebrity/${slug}/photo/${item.photo_id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to look
          </Link>
          <p className="text-sm font-medium text-muted-foreground hidden sm:block">
            {totalMatches} {totalMatches === 1 ? "match" : "matches"} found
          </p>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="mx-auto max-w-5xl">
          {/* Item header */}
          <div className="mb-10">
            <div className="flex items-start gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {celeb.name}
                </p>
                <h1 className="text-3xl font-black tracking-tight capitalize">
                  {item.category}
                </h1>
                {item.style_description && (
                  <p className="text-muted-foreground mt-2 max-w-xl">
                    {item.style_description}
                  </p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {item.colour && (
                <span className="inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-sm capitalize">
                  <span
                    className="w-3 h-3 rounded-full border border-gray-200"
                    style={{ background: item.colour.toLowerCase() }}
                  />
                  {item.colour}
                </span>
              )}
              {item.estimated_brand && (
                <span className="border rounded-full px-3 py-1 text-sm font-medium">
                  {item.estimated_brand}
                </span>
              )}
            </div>
          </div>

          {/* Product Matches */}
          {!hasMatches ? (
            <div className="text-center py-20 border-2 border-dashed rounded-2xl text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-semibold mb-1">No matches yet</p>
              <p className="text-sm">
                We&apos;re finding shoppable alternatives — check back soon.
              </p>
            </div>
          ) : (
            <div className="space-y-14">
              {TIER_ORDER.map((tier) => {
                const items = matchesByTier[tier];
                if (!items || items.length === 0) return null;
                const config = TIER_CONFIG[tier];

                return (
                  <div key={tier}>
                    {/* Tier header */}
                    <div className="flex items-center gap-3 mb-5">
                      <h2 className="text-xl font-bold">{config.label}</h2>
                      <span
                        className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${config.badgeClass}`}
                      >
                        {config.range}
                      </span>
                    </div>

                    {/* Product grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {items.map((match) => (
                        <a
                          key={match.id}
                          href={match.affiliate_url || match.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex flex-col border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                        >
                          {/* Product image */}
                          <div className="aspect-square relative overflow-hidden bg-gray-100">
                            {match.image_url ? (
                              <Image
                                src={match.image_url}
                                alt={match.product_name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag className="h-8 w-8 text-gray-300" />
                              </div>
                            )}
                            {match.match_type === "exact" && (
                              <div className="absolute top-2 left-2 bg-black text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                Exact match
                              </div>
                            )}
                          </div>

                          {/* Product info */}
                          <div className="p-3 flex flex-col flex-1">
                            <p className="text-sm font-semibold line-clamp-2 flex-1">
                              {match.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {match.retailer_name}
                            </p>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t">
                              <p className="text-base font-black">
                                {match.price_gbp
                                  ? formatPrice(match.price_gbp)
                                  : "See price"}
                              </p>
                              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                                Buy
                                <ExternalLink className="h-3 w-3" />
                              </span>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
