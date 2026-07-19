"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deactivateUser, reactivateUser } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";

export function UserStatusActions({
  userId,
  isBanned,
}: {
  userId: string;
  isBanned: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleReactivate() {
    setLoading(true);
    await reactivateUser(userId);
    setLoading(false);
    router.refresh();
  }

  async function handleDeactivate() {
    setLoading(true);
    await deactivateUser(userId, 36500);
    setLoading(false);
    setConfirming(false);
    router.refresh();
  }

  if (isBanned) {
    return (
      <Button size="sm" variant="outline" disabled={loading} onClick={handleReactivate}>
        {loading ? "..." : "Reactivate"}
      </Button>
    );
  }

  if (confirming) {
    return (
      <div className="flex gap-1.5 items-center">
        <Button size="sm" variant="destructive" disabled={loading} onClick={handleDeactivate}>
          {loading ? "..." : "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-red-400 hover:text-red-600 hover:bg-red-50"
      onClick={() => setConfirming(true)}
    >
      Deactivate
    </Button>
  );
}
