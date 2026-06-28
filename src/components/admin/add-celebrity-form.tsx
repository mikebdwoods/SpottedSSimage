"use client";

import { useState, useRef } from "react";
import { addCelebrity } from "@/app/admin/celebrities/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { slugify } from "@/lib/utils";

export function AddCelebrityForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setError("");

    const formData = new FormData(e.currentTarget);
    try {
      await addCelebrity(formData);
      setStatus("done");
      formRef.current?.reset();
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Name *</label>
        <Input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Taylor Swift"
          required
        />
        {name && (
          <p className="text-xs text-muted-foreground mt-1">
            Slug: <code>{slugify(name)}</code>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Bio</label>
        <Textarea name="bio" placeholder="Short bio..." rows={3} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Gender</label>
        <Select name="gender">
          <option value="">Not specified</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="non-binary">Non-binary</option>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Photo</label>
        <Input type="file" name="image" accept="image/*" />
      </div>

      {status === "done" && (
        <p className="text-sm text-green-600 font-medium">Celebrity added!</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={status === "saving"} className="w-full">
        {status === "saving" ? "Saving..." : "Add celebrity"}
      </Button>
    </form>
  );
}
