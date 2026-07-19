import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  dress: { label: "Dresses", description: "Celebrity dress looks — shop the style for less." },
  top: { label: "Tops", description: "Celebrity tops and shirts — find your look for less." },
  jacket: { label: "Jackets & Coats", description: "Shop celebrity jacket and coat looks for less." },
  coat: { label: "Coats", description: "Celebrity coat looks — shop budget to premium." },
  jeans: { label: "Jeans & Denim", description: "Celebrity jeans and denim looks — shop the style." },
  trousers: { label: "Trousers", description: "Celebrity trouser looks — shop alternatives for less." },
  skirt: { label: "Skirts", description: "Celebrity skirt looks — find shoppable alternatives." },
  shoes: { label: "Shoes", description: "Shop celebrity shoes and footwear looks for less." },
  trainers: { label: "Trainers & Sneakers", description: "Celebrity trainer looks — shop alternatives for less." },
  boots: { label: "Boots", description: "Celebrity boot looks — find your style for less." },
  bag: { label: "Bags", description: "Celebrity handbag and bag looks — shop alternatives." },
  sunglasses: { label: "Sunglasses", description: "Celebrity sunglasses looks — shop alternatives for less." },
  jewellery: { label: "Jewellery", description: "Celebrity jewellery looks — shop alternatives for less." },
  suit: { label: "Suits", description: "Celebrity suit looks — shop alternatives from budget to premium." },
  bodysuit: { label: "Bodysuits", description: "Celebrity bodysuit looks — shop the style for less." },
  shorts: { label: "Shorts", description: "Celebrity shorts looks — shop alternatives for less." },
  jumpsuit: { label: "Jumpsuits", description: "Celebrity jumpsuit looks — shop alternatives for less." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = CATEGORY_META[slug];
  if (!meta) return { title: "Category | Spotted" };

  return {
    title: `${meta.label} | Spotted`,
    description: meta.description,
  };
}

export async function generateStaticParams() {
  return Object.keys(CATEGORY_META).map((slug) => ({ slug }));
}

const PAGE_SIZE = 24;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug }, { page }] = await Promise.all([params, searchParams]);

  const meta = CATEGORY_META[slug];
  if (!meta) notFound();

  const supabase = await createClient();

  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: items, count } = await supabase
    .from("clothing_items")
    .select(
      "id, category, color, brand_guess, description, photos!inner(id, image_url, status, celebrities(name, slug))",
      { count: "exact" }
    )
    .ilike("category", `%${slug}%`)
    .in("photos.status", ["live", "approved"])
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const RELATED = Object.entries(CATEGORY_META)
    .filter(([k]) => k !== slug)
    .slice(0, 6);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-secondary/40 border-b border-border py-10 px-4">
        <div className="mx-auto max-w-7xl">
          <nav className="text-xs text-muted-foreground mb-3">
            <Link href="/" className="hover:underline">Home</Link>
            {" / "}
            <span>Category</span>
            {" / "}
            <span className="font-medium text-foreground">{meta.label}</span>
          </nav>
          <h1 className="font-serif italic text-3xl sm:text-4xl tracking-tight mb-1">
            {meta.label}
          </h1>
          <p className="text-muted-foreground text-sm">
            {count ? `${count} look${count === 1 ? "" : "s"} — click any to shop` : meta.description}
          </p>
        </div>
      </div>

      {/* Category strip */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-1 overflow-x-auto py-2.5 scrollbar-hide">
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <Link
                key={k}
                href={`/category/${k}`}
                className={`shrink-0 text-xs font-medium border rounded-full px-3 py-1.5 transition-colors whitespace-nowrap ${
                  k === slug
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {v.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Items grid */}
      <section className="py-10 px-4">
        <div className="mx-auto max-w-7xl">
          {!items || items.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <p className="text-lg font-semibold mb-2">No looks yet</p>
              <p className="text-sm mb-6">
                No {meta.label.toLowerCase()} looks have been added yet — check back soon.
              </p>
              <Link href="/looks" className="text-sm underline font-medium">
                Browse all looks
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {items.map((item) => {
                const photo = item.photos as unknown as {
                  id: string;
                  image_url: string | null;
                  celebrities: { name: string; slug: string } | null;
                } | null;
                const celeb = photo?.celebrities;
                if (!photo || !celeb) return null;
                return (
                  <Link
                    key={item.id}
                    href={`/celebrity/${celeb.slug}/item/${item.id}`}
                    className="group"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden rounded-2xl bg-secondary shadow-warm">
                      {photo.image_url ? (
                        <Image
                          src={photo.image_url}
                          alt={`${celeb.name} ${item.category}`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No image
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <p className="text-primary-foreground text-xs font-semibold">{celeb.name}</p>
                        <p className="text-primary-foreground/70 text-xs">Shop →</p>
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <p className="text-xs text-muted-foreground">{celeb.name}</p>
                      {(item.color || item.brand_guess) && (
                        <p className="text-xs text-muted-foreground capitalize">
                          {[item.color, item.brand_guess].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              {currentPage > 1 && (
                <Link
                  href={`/category/${slug}?page=${currentPage - 1}`}
                  className="border border-border rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
                >
                  ← Prev
                </Link>
              )}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) {
                    p = i + 1;
                  } else if (currentPage <= 4) {
                    p = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    p = totalPages - 6 + i;
                  } else {
                    p = currentPage - 3 + i;
                  }
                  return (
                    <Link
                      key={p}
                      href={`/category/${slug}?page=${p}`}
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        p === currentPage
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-secondary"
                      }`}
                    >
                      {p}
                    </Link>
                  );
                })}
              </div>
              {currentPage < totalPages && (
                <Link
                  href={`/category/${slug}?page=${currentPage + 1}`}
                  className="border border-border rounded-full px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Related categories */}
      <section className="py-10 px-4 bg-secondary/40 border-t border-border">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-lg font-bold mb-4">Browse other categories</h2>
          <div className="flex flex-wrap gap-2">
            {RELATED.map(([k, v]) => (
              <Link
                key={k}
                href={`/category/${k}`}
                className="border border-border bg-card rounded-full px-4 py-2 text-sm font-medium hover:border-clay hover:text-clay transition-colors"
              >
                {v.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
