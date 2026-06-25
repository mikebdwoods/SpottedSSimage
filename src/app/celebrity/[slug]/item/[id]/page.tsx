import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const revalidate = 60;

type PriceTier = "premium" | "mid" | "budget";

const TIER_LABELS: Record<PriceTier, string> = {
  premium: "Premium",
  mid: "Mid-Range",
  budget: "Budget",
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

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:underline">Home</Link>
          {" / "}
          <Link href={`/celebrity/${slug}`} className="hover:underline">
            {celeb.name}
          </Link>
          {" / "}
          <Link
            href={`/celebrity/${slug}/photo/${item.photo_id}`}
            className="hover:underline"
          >
            Look
          </Link>
          {" / "}
          <span className="capitalize">{item.category}</span>
        </nav>

        {/* Item Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold capitalize mb-2">{item.category}</h1>
          {item.style_description && (
            <p className="text-muted-foreground mb-3">{item.style_description}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {item.colour && (
              <Badge variant="outline" className="capitalize">
                {item.colour}
              </Badge>
            )}
            {item.estimated_brand && (
              <Badge variant="secondary">{item.estimated_brand}</Badge>
            )}
          </div>
          <Link
            href={`/celebrity/${slug}/photo/${item.photo_id}`}
            className="text-sm text-muted-foreground hover:underline mt-4 inline-block"
          >
            ← Back to look
          </Link>
        </div>

        {/* Product Matches */}
        {!hasMatches ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">No matches found yet</p>
            <p className="text-sm">
              We&apos;re working on finding shoppable alternatives for this item.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {TIER_ORDER.map((tier) => {
              const items = matchesByTier[tier];
              if (!items || items.length === 0) return null;

              return (
                <div key={tier}>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    {TIER_LABELS[tier]}
                    <span className="text-xs font-normal text-muted-foreground">
                      {tier === "budget" && "(under £45)"}
                      {tier === "mid" && "(£45–£70)"}
                      {tier === "premium" && "(£70+)"}
                    </span>
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {items.map((match) => (
                      <div
                        key={match.id}
                        className="border rounded-lg overflow-hidden group"
                      >
                        <div className="aspect-square relative overflow-hidden bg-gray-100">
                          {match.image_url ? (
                            <Image
                              src={match.image_url}
                              alt={match.product_name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium line-clamp-2">
                            {match.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {match.retailer_name}
                          </p>
                          {match.price_gbp && (
                            <p className="text-sm font-semibold mt-1">
                              {formatPrice(match.price_gbp)}
                            </p>
                          )}
                          <a
                            href={match.affiliate_url || match.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-3"
                          >
                            <Button size="sm" className="w-full">
                              Buy Now
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
