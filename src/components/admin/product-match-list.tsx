"use client";

import { useState } from "react";
import Image from "next/image";
import {
  addProductMatch,
  deleteProductMatch,
  updateProductMatch,
} from "@/app/admin/items/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";

interface ProductMatch {
  id: string;
  product_name: string;
  retailer_name: string;
  product_url: string;
  affiliate_url: string | null;
  image_url: string | null;
  price_gbp: number | null;
  price_tier: "budget" | "mid" | "premium";
  match_type: "exact" | "same_brand" | "similar";
  sort_order: number;
}

interface Props {
  clothingItemId: string;
  initialMatches: ProductMatch[];
}

const EMPTY_FORM = {
  product_name: "",
  retailer_name: "",
  product_url: "",
  affiliate_url: "",
  image_url: "",
  price_gbp: "",
  price_tier: "mid" as const,
  match_type: "similar" as const,
};

export function ProductMatchList({ clothingItemId, initialMatches }: Props) {
  const [matches, setMatches] = useState<ProductMatch[]>(initialMatches);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductMatch>>({});
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
        ...form,
        price_gbp: form.price_gbp ? parseFloat(form.price_gbp) : undefined,
        affiliate_url: form.affiliate_url || undefined,
        image_url: form.image_url || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      // Refresh list by re-fetching would need a router refresh —
      // revalidatePath in the action handles server cache, page re-render on next nav
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add match");
    }
    setSaving(false);
  }

  async function handleDelete(matchId: string) {
    if (!confirm("Delete this product match?")) return;
    setDeletingId(matchId);
    await deleteProductMatch(matchId, clothingItemId);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    setDeletingId(null);
  }

  async function handleEditSave(matchId: string) {
    setSaving(true);
    const safeForm = {
      ...editForm,
      affiliate_url: editForm.affiliate_url ?? undefined,
      image_url: editForm.image_url ?? undefined,
      price_gbp: editForm.price_gbp ?? undefined,
    };
    await updateProductMatch(matchId, clothingItemId, safeForm);
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, ...editForm } : m))
    );
    setEditingId(null);
    setEditForm({});
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {matches.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          No product matches yet. Add one below.
        </p>
      )}

      {/* Existing matches */}
      {matches.map((match) =>
        editingId === match.id ? (
          <div key={match.id} className="border rounded-lg p-4 space-y-3 bg-gray-50">
            <Input
              value={editForm.product_name ?? match.product_name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, product_name: e.target.value }))
              }
              placeholder="Product name"
            />
            <Input
              value={editForm.retailer_name ?? match.retailer_name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, retailer_name: e.target.value }))
              }
              placeholder="Retailer"
            />
            <Input
              value={editForm.product_url ?? match.product_url}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, product_url: e.target.value }))
              }
              placeholder="Product URL"
            />
            <Input
              value={editForm.affiliate_url ?? match.affiliate_url ?? ""}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, affiliate_url: e.target.value }))
              }
              placeholder="Affiliate URL (optional)"
            />
            <Input
              value={editForm.image_url ?? match.image_url ?? ""}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, image_url: e.target.value }))
              }
              placeholder="Image URL (optional)"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editForm.price_gbp ?? match.price_gbp ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    price_gbp: parseFloat(e.target.value) || undefined,
                  }))
                }
                placeholder="Price (£)"
              />
              <Select
                value={editForm.price_tier ?? match.price_tier}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    price_tier: e.target.value as ProductMatch["price_tier"],
                  }))
                }
              >
                <option value="budget">Budget (under £45)</option>
                <option value="mid">Mid (£45–£70)</option>
                <option value="premium">Premium (£70+)</option>
              </Select>
            </div>
            <Select
              value={editForm.match_type ?? match.match_type}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  match_type: e.target.value as ProductMatch["match_type"],
                }))
              }
            >
              <option value="similar">Similar</option>
              <option value="same_brand">Same brand</option>
              <option value="exact">Exact match</option>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleEditSave(match.id)}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setEditForm({});
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div key={match.id} className="border rounded-lg p-4">
            <div className="flex gap-3">
              {match.image_url && (
                <div className="relative w-14 h-14 rounded overflow-hidden bg-gray-100 shrink-0">
                  <Image
                    src={match.image_url}
                    alt={match.product_name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {match.product_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {match.retailer_name}
                </p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {match.price_gbp && (
                    <span className="text-xs font-semibold">
                      {formatPrice(match.price_gbp)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground capitalize">
                    {match.price_tier}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {match.match_type.replace("_", " ")}
                  </span>
                </div>
                {match.affiliate_url && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Affiliate URL set
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(match.id);
                    setEditForm({});
                  }}
                >
                  Edit
                </Button>
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
        )
      )}

      {/* Add form */}
      {showForm ? (
        <form onSubmit={handleAdd} className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <p className="text-sm font-semibold">New product match</p>
          <Input
            required
            value={form.product_name}
            onChange={(e) => updateField("product_name", e.target.value)}
            placeholder="Product name *"
          />
          <Input
            required
            value={form.retailer_name}
            onChange={(e) => updateField("retailer_name", e.target.value)}
            placeholder="Retailer name *"
          />
          <Input
            required
            type="url"
            value={form.product_url}
            onChange={(e) => updateField("product_url", e.target.value)}
            placeholder="Product URL *"
          />
          <Input
            type="url"
            value={form.affiliate_url}
            onChange={(e) => updateField("affiliate_url", e.target.value)}
            placeholder="Affiliate URL (optional — use this for tracking)"
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
              value={form.price_gbp}
              onChange={(e) => updateField("price_gbp", e.target.value)}
              placeholder="Price in £ (e.g. 34.99)"
            />
            <Select
              value={form.price_tier}
              onChange={(e) => updateField("price_tier", e.target.value)}
            >
              <option value="budget">Budget (under £45)</option>
              <option value="mid">Mid (£45–£70)</option>
              <option value="premium">Premium (£70+)</option>
            </Select>
          </div>
          <Select
            value={form.match_type}
            onChange={(e) => updateField("match_type", e.target.value)}
          >
            <option value="similar">Similar style</option>
            <option value="same_brand">Same brand</option>
            <option value="exact">Exact match</option>
          </Select>
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
