"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCelebrityStatus } from "@/app/admin/celebrities/actions";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  isPublished: boolean;
}

export function PublishCelebrityToggle({ id, isPublished }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    await setCelebrityStatus(id, !isPublished);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">
          {isPublished ? "Published" : "Not published"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isPublished
            ? "Visible on the public site."
            : "Hidden from the public site until published."}
        </p>
      </div>
      <Button
        size="sm"
        variant={isPublished ? "outline" : "default"}
        onClick={handleToggle}
        disabled={loading}
      >
        {loading ? "..." : isPublished ? "Unpublish" : "Publish"}
      </Button>
    </div>
  );
}
