import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Search | Spotted",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const query = (q ?? "").trim();

  const [{ data: celebrities }, { data: photos }] = await Promise.all([
    query.length >= 2
      ? supabase
          .from("celebrities")
          .select("id, name, slug, image_url, bio")
          .ilike("name", `%${query}%`)
          .order("name")
          .limit(12)
      : { data: [] },
    query.length >= 2
      ? supabase
          .from("clothing_items")
          .select(
            "id, category, style_description, colour, estimated_brand, photo_id, photos(id, fallback_image_url, celebrities(name, slug))"
          )
          .or(
            `category.ilike.%${query}%,style_description.ilike.%${query}%,colour.ilike.%${query}%,estimated_brand.ilike.%${query}%`
          )
          .limit(16)
      : { data: [] },
  ]);

  const totalResults = (celebrities?.length ?? 0) + (photos?.length ?? 0);

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Search bar */}
        <form method="get" className="mb-10">
          <div className="flex gap-3">
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search celebrities, outfits, brands..."
              autoFocus
              className="flex-1 border rounded-xl px-5 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="submit"
              className="bg-black text-white px-6 py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors shrink-0"
            >
              Search
            </button>
          </div>
        </form>

        {query.length >= 2 ? (
          <>
            <p className="text-sm text-muted-foreground mb-8">
              {totalResults === 0
                ? `No results for "${query}"`
                : `${totalResults} result${totalResults === 1 ? "" : "s"} for "${query}"`}
            </p>

            {/* Celebrities */}
            {celebrities && celebrities.length > 0 && (
              <section className="mb-12">
                <h2 className="text-lg font-bold mb-5">Celebrities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {celebrities.map((celeb) => (
                    <Link
                      key={celeb.id}
                      href={`/celebrity/${celeb.slug}`}
                      className="group flex flex-col items-center text-center p-4 border rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-200 mb-3">
                        {celeb.image_url ? (
                          <Image
                            src={celeb.image_url}
                            alt={celeb.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                            {celeb.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-semibold">{celeb.name}</p>
                      {celeb.bio && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {celeb.bio}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Items / Looks */}
            {photos && photos.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-5">Clothing Items</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {photos.map((item) => {
                    const photo = item.photos as unknown as {
                      id: string;
                      fallback_image_url: string | null;
                      celebrities: { name: string; slug: string } | null;
                    } | null;
                    const celeb = photo?.celebrities;
                    if (!photo || !celeb) return null;
                    return (
                      <Link
                        key={item.id}
                        href={`/celebrity/${celeb.slug}/item/${item.id}`}
                        className="group border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
                          {photo.fallback_image_url ? (
                            <Image
                              src={photo.fallback_image_url}
                              alt={`${celeb.name} ${item.category}`}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                              sizes="(max-width: 640px) 50vw, 25vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-xs text-muted-foreground">{celeb.name}</p>
                          <p className="text-sm font-semibold capitalize">{item.category}</p>
                          {item.colour && (
                            <p className="text-xs text-muted-foreground capitalize mt-0.5">
                              {item.colour}
                              {item.estimated_brand ? ` · ${item.estimated_brand}` : ""}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {totalResults === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg font-semibold mb-2">Nothing found</p>
                <p className="text-sm mb-6">Try a celebrity name, colour, or clothing type.</p>
                <Link href="/celebrities" className="text-sm underline font-medium">
                  Browse all celebrities
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-muted-foreground">
            <p className="mb-4 text-sm text-center">Try searching for a celebrity name, item colour, or brand.</p>
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {["Dua Lipa", "black dress", "blazer", "Harry Styles", "denim"].map((hint) => (
                <a
                  key={hint}
                  href={`/search?q=${encodeURIComponent(hint)}`}
                  className="text-xs border rounded-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  {hint}
                </a>
              ))}
            </div>
            <div className="border-t pt-8">
              <p className="text-sm font-semibold mb-4 text-foreground">Browse by category</p>
              <div className="flex flex-wrap gap-2">
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
                    className="text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors font-medium"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
