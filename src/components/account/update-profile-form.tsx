"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  userId: string;
  initialDisplayName: string;
}

export function UpdateProfileForm({ userId, initialDisplayName }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: displayName });

    if (error) {
      setStatus("error");
    } else {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <div className="flex-1">
        <label className="block text-sm font-medium mb-1.5">Display name</label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          maxLength={50}
        />
      </div>
      <Button type="submit" disabled={status === "saving"} className="shrink-0">
        {status === "saving" ? "Saving..." : status === "saved" ? "Saved!" : "Save"}
      </Button>
      {status === "error" && (
        <p className="text-sm text-destructive">Something went wrong.</p>
      )}
    </form>
  );
}
