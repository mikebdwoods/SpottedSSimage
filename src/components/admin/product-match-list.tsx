"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  addProductMatch,
  deleteProductMatch,
  setPrimaryMatch,
} from "@/app/admin/items/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";

interface Product {
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  price: number | null;
  image_url: string | null;
  product_url: string | null;
}

interface Match {
  id: string;
  match_type: string | null;
  is_primary: boolean | null;
  products: Product | null;
}

interface Props {
  clothingItemId: string;
  initialMatches: Match[];
}

const EMPTY_FORM = {
  title: "",
  retailer: "",
  brand: "",
  product_url: "",
  image_url: "",
  price: "",
  match_type: "similar" as "exact" | "same_brand" | "similar",
};

export function ProductMatchList({ clothingItemId, initialMatches }: Props) {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await addProductMatch(clothingItemId, {
        title: form.title,
        retailer: form.retailer,
        brand: form.brand || undefined,
        product_url: form.product_url,
        image_url: form.image_url || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        match_type: form.match_type,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add match");
    }
    setSaving(false);
  }

  async function handleDelete(matchId: string) {
    if (!confirm("Remove this product match?")) return;
    setDeletingId(matchId);
    await deleteProductMatch(matchId, clothingItemId);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    setDeletingId(null);
  }

  async function handleSetPrimary(matchId: string) {
    await setPrimaryMatch(matchId, clothingItemId);
    setMatches((prev) =>
      prev.map((m) => ({ ...m, is_primary: m.id === matchId }))
    );
  }

  return (
    <div className="space-y-4">
      {matches.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          No product matches yet. Add one below.
        </p>
      )}

      {/* Existing matches */}
      {matches.map((match) => {
        const product = match.products;
        if (!product) return null;
        return (
          <div key={match.id} className="border rounded-lg p-4">
            <div className="flex gap-3">
              {product.image_url && (
                <div className="relative w-14 h-14 rounded overflow-hidden bg-gray-100 shrink-0">
                  <Image
                    src={product.image_url}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{product.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[product.brand, product.retailer].filter(Boolean).join(" · ")}
                </p>
                <div className="flex gap-2 mt-1 flex-wrap items-center">
                  {product.price != null && (
                    <span className="text-xs font-semibold">
                      {formatPrice(Number(product.price))}
                    </span>
                  )}
                  {match.match_type && (
                    <span className="text-xs text-muted-foreground">
                      {match.match_type.replace("_", " ")}
                    </span>
                  )}
                  {match.is_primary ? (
                    <span className="text-xs font-semibold text-amber-600">
                      ★ Top pick
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetPrimary(match.id)}
                      className="text-xs text-muted-foreground hover:text-amber-600 hover:underline"
                    >
                      Make top pick
                    </button>
                  )}
                </div>
                {product.product_url && (
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate block mt-0.5"
                  >
                    {product.product_url}
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(match.id)}
                  disabled={deletingId === match.id}
                >
                  {deletingId === match.id ? "..." : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add form */}
      {showForm ? (
        <form onSubmit={handleAdd} className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <p className="text-sm font-semibold">New product match</p>
          <Input
            required
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Product name *"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              required
              value={form.retailer}
              onChange={(e) => updateField("retailer", e.target.value)}
              placeholder="Retailer *"
            />
            <Input
              value={form.brand}
              onChange={(e) => updateField("brand", e.target.value)}
              placeholder="Brand"
            />
          </div>
          <Input
            required
            type="url"
            value={form.product_url}
            onChange={(e) => updateField("product_url", e.target.value)}
            placeholder="Product / affiliate URL *"
          />
          <Input
            type="url"
            value={form.image_url}
            onChange={(e) => updateField("image_url", e.target.value)}
            placeholder="Product image URL (optional)"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => updateField("price", e.target.value)}
              placeholder="Price in £ (e.g. 34.99)"
            />
            <Select
              value={form.match_type}
              onChange={(e) => updateField("match_type", e.target.value)}
            >
              <option value="similar">Similar style</option>
              <option value="same_brand">Same brand</option>
              <option value="exact">Exact match</option>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Price sets the tier automatically: under £45 budget · £45–£70 mid · £70+ premium.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Adding..." : "Add match"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          + Add product match
        </Button>
      )}
    </div>
  );
}
