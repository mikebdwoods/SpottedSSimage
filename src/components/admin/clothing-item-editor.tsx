"use client";

import { useState } from "react";
import { updateClothingItem } from "@/app/admin/items/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Item {
  id: string;
  category: string | null;
  color: string | null;
  description: string | null;
  brand_guess: string | null;
}

export function ClothingItemEditor({ item }: { item: Item }) {
  const [category, setCategory] = useState(item.category ?? "");
  const [colour, setColour] = useState(item.color ?? "");
  const [styleDesc, setStyleDesc] = useState(item.description ?? "");
  const [brand, setBrand] = useState(item.brand_guess ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    await updateClothingItem(item.id, {
      category,
      color: colour,
      description: styleDesc,
      brand_guess: brand,
    });
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Category</label>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. dress, top, jeans"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Colour</label>
        <Input
          value={colour}
          onChange={(e) => setColour(e.target.value)}
          placeholder="e.g. black, navy blue"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Style description
        </label>
        <Textarea
          value={styleDesc}
          onChange={(e) => setStyleDesc(e.target.value)}
          rows={3}
          placeholder="Describe the item style..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Estimated brand
        </label>
        <Input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Zara, ASOS"
        />
      </div>
      <Button type="submit" disabled={status === "saving"}>
        {status === "saving"
          ? "Saving..."
          : status === "saved"
          ? "Saved!"
          : "Save changes"}
      </Button>
    </form>
  );
}
