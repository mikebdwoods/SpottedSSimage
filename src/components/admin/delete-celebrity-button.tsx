"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCelebrity } from "@/app/admin/celebrities/actions";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  name: string;
}

export function DeleteCelebrityButton({ id, name }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteCelebrity(id);
      router.push("/admin/celebrities");
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Delete <strong>{name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Yes, delete"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive border-destructive/30 hover:bg-destructive/5"
      onClick={() => setConfirming(true)}
    >
      Delete celebrity
    </Button>
  );
}
