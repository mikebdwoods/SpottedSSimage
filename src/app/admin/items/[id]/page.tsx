import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClothingItemEditor } from "@/components/admin/clothing-item-editor";
import { ProductMatchList } from "@/components/admin/product-match-list";

export default async function AdminItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: item }, { data: matches }] = await Promise.all([
    supabase
      .from("v_clothing_item")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("product_matches")
      .select("*")
      .eq("clothing_item_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!item) notFound();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/admin/photos/${item.photo_id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Photo
        </Link>
        <h1 className="text-2xl font-bold capitalize">{item.category}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Item details + edit */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Item Details</h2>
          <ClothingItemEditor item={item} />
        </div>

        {/* Product matches */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Product Matches ({matches?.length ?? 0})
          </h2>
          <ProductMatchList
            clothingItemId={id}
            initialMatches={matches ?? []}
          />
        </div>
      </div>
    </div>
  );
}
