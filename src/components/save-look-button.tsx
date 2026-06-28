"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

interface Props {
  photoId: string;
  initialSaved: boolean;
  isSignedIn: boolean;
}

export function SaveLookButton({ photoId, initialSaved, isSignedIn }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isSignedIn) {
      router.push("/auth/login");
      return;
    }
    setLoading(true);
    const method = saved ? "DELETE" : "POST";
    try {
      await fetch("/api/save-look", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_id: photoId }),
      });
      setSaved(!saved);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Unsave look" : "Save look"}
      className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
        saved
          ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
          : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Heart
        className={`h-4 w-4 transition-all ${saved ? "fill-red-500 text-red-500" : ""}`}
      />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
