"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rebuildBrandProfile } from "@/app/admin/celebrities/actions";
import { Button } from "@/components/ui/button";

interface Props {
  celebId: string;
}

export function RebuildBrandProfileButton({ celebId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setLoading(true);
    await rebuildBrandProfile(celebId);
    setLoading(false);
    setDone(true);
    setTimeout(() => router.refresh(), 4000);
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={loading || done} className="text-xs">
      {done ? "Rebuilding... refresh in a few seconds" : loading ? "Requesting..." : "Rebuild brand profile"}
    </Button>
  );
}
