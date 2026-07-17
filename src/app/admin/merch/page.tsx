import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { AddMerchForm } from "@/components/admin/add-merch-form";
import { DeleteMerchButton } from "@/components/admin/delete-merch-button";
import { formatPrice } from "@/lib/utils";

export default async function AdminMerchPage() {
  const supabase = await createClient();

  const [{ data: merch }, { data: celebrities }] = await Promise.all([
    supabase
      .from("merch_products")
      .select("*, celebrities(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("celebrities")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Merch Products</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* List */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            All merch ({merch?.length ?? 0})
          </h2>
          {!merch || merch.length === 0 ? (
            <p className="text-sm text-muted-foreground">No merch added yet.</p>
          ) : (
            <div className="space-y-3">
              {merch.map((item) => {
                const celeb = item.celebrities as { name: string } | null;
                return (
                  <div key={item.id} className="flex gap-3 border rounded-lg p-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          —
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {celeb?.name ?? "—"}
                        {item.price ? ` · ${formatPrice(Number(item.price))}` : ""}
                      </p>
                    </div>
                    <DeleteMerchButton id={item.id} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add form */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Add merch product</h2>
          <AddMerchForm celebrities={celebrities ?? []} />
        </div>
      </div>
    </div>
  );
}
