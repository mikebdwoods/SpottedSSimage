"use client";

import { useState } from "react";
import { addClothingItem, deleteClothingItem } from "@/app/admin/photos/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  photoId: string;
}

export function AddClothingItemForm({ photoId }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "",
    colour: "",
    style_description: "",
    estimated_brand: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category.trim()) return;
    setStatus("saving");
    setError("");
    try {
      await addClothingItem(photoId, form);
      setForm({ category: "", colour: "", style_description: "", estimated_brand: "" });
      setStatus("done");
      setOpen(false);
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
      setStatus("idle");
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full mt-3"
      >
        + Add clothing item manually
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 border rounded-lg p-4 space-y-3 bg-gray-50">
      <p className="text-sm font-semibold">New clothing item</p>
      <Input
        required
        value={form.category}
        onChange={(e) => update("category", e.target.value)}
        placeholder="Category (e.g. dress, trainers) *"
      />
      <Input
        value={form.colour}
        onChange={(e) => update("colour", e.target.value)}
        placeholder="Colour (e.g. black, cream)"
      />
      <Textarea
        value={form.style_description}
        onChange={(e) => update("style_description", e.target.value)}
        rows={2}
        placeholder="Style description..."
      />
      <Input
        value={form.estimated_brand}
        onChange={(e) => update("estimated_brand", e.target.value)}
        placeholder="Estimated brand (e.g. Zara)"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={status === "saving"}>
          {status === "saving" ? "Adding..." : "Add item"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function DeleteClothingItemButton({
  itemId,
  photoId,
}: {
  itemId: string;
  photoId: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this clothing item and all its product matches?")) return;
    setLoading(true);
    await deleteClothingItem(itemId, photoId);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-destructive hover:underline disabled:opacity-50"
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
