"use client";

import { useState } from "react";
import { deletePhoto } from "@/app/admin/photos/actions";
import { Button } from "@/components/ui/button";

interface Props {
  photoId: string;
}

export function DeletePhotoButton({ photoId }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-2 items-center">
        <span className="text-xs text-red-600 font-medium">Delete this photo?</span>
        <Button
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            await deletePhoto(photoId);
          }}
        >
          {deleting ? "Deleting..." : "Yes, delete"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setConfirming(true)}>
      Delete photo
    </Button>
  );
}
