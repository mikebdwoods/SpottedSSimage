"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";

export function UserRoleToggle({
  userId,
  isAdmin,
  disabled,
}: {
  userId: string;
  isAdmin: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await setUserRole(userId, isAdmin ? null : "admin");
    setLoading(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex gap-1.5 items-center">
        <Button size="sm" variant="destructive" disabled={loading} onClick={handleConfirm}>
          {loading ? "..." : isAdmin ? "Remove admin" : "Make admin"}
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
      variant={isAdmin ? "outline" : "secondary"}
      disabled={disabled}
      onClick={() => setConfirming(true)}
    >
      {isAdmin ? "Remove admin" : "Make admin"}
    </Button>
  );
}
