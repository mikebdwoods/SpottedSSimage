"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteInvite } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";

export function DeleteInviteButton({ email }: { email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-red-400 hover:text-red-600 hover:bg-red-50"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await deleteInvite(email);
        router.refresh();
      }}
    >
      {loading ? "..." : "Remove"}
    </Button>
  );
}
