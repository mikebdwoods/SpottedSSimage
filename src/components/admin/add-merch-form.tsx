"use client";

import { useState } from "react";
import { addMerch } from "@/app/admin/merch/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface Celebrity {
  id: string;
  name: string;
}

export function AddMerchForm({ celebrities }: { celebrities: Celebrity[] }) {
  const [form, setForm] = useState({
    celeb_id: "",
    title: "",
    retailer: "",
    price: "",
    product_url: "",
    image_url: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError("");
    try {
      await addMerch({
        celeb_id: form.celeb_id,
        title: form.title,
        retailer: form.retailer || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        product_url: form.product_url,
        image_url: form.image_url || undefined,
      });
      setForm({
        celeb_id: "",
        title: "",
        retailer: "",
        price: "",
        product_url: "",
        image_url: "",
      });
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Celebrity *</label>
        <Select
          value={form.celeb_id}
          onChange={(e) => update("celeb_id", e.target.value)}
          required
        >
          <option value="">Select celebrity...</option>
          {celebrities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Product name *</label>
        <Input
          required
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. Official Tour Hoodie"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Retailer</label>
          <Input
            value={form.retailer}
            onChange={(e) => update("retailer", e.target.value)}
            placeholder="e.g. Official store"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Price (£)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="29.99"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Product URL *</label>
        <Input
          required
          type="url"
          value={form.product_url}
          onChange={(e) => update("product_url", e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Image URL</label>
        <Input
          type="url"
          value={form.image_url}
          onChange={(e) => update("image_url", e.target.value)}
          placeholder="https://..."
        />
      </div>

      {status === "done" && (
        <p className="text-sm text-green-600 font-medium">Merch added!</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={status === "saving"} className="w-full">
        {status === "saving" ? "Saving..." : "Add merch product"}
      </Button>
    </form>
  );
}
