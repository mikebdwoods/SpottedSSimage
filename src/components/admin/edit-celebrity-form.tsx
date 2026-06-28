"use client";

import { useState, useRef } from "react";
import { updateCelebrity } from "@/app/admin/celebrities/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

interface Props {
  celebrity: {
    id: string;
    name: string;
    bio: string | null;
    gender: string | null;
    image_url: string | null;
  };
}

export function EditCelebrityForm({ celebrity }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setError("");

    const formData = new FormData(e.currentTarget);
    try {
      await updateCelebrity(celebrity.id, formData);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Name *</label>
        <Input name="name" defaultValue={celebrity.name} required />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Bio</label>
        <Textarea
          name="bio"
          defaultValue={celebrity.bio ?? ""}
          placeholder="Short bio..."
          rows={4}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Gender</label>
        <Select name="gender" defaultValue={celebrity.gender ?? ""}>
          <option value="">Not specified</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="non-binary">Non-binary</option>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Photo{" "}
          {celebrity.image_url && (
            <span className="text-muted-foreground font-normal">(leave empty to keep current)</span>
          )}
        </label>
        <Input type="file" name="image" accept="image/*" />
      </div>

      {status === "done" && (
        <p className="text-sm text-green-600 font-medium">Saved!</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
