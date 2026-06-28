"use client";

import { useState } from "react";
import { deleteMerch } from "@/app/admin/merch/actions";
import { Button } from "@/components/ui/button";

export function DeleteMerchButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this merch product?")) return;
    setLoading(true);
    await deleteMerch(id);
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive shrink-0"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? "..." : "Delete"}
    </Button>
  );
}
