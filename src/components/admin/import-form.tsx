"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { triggerAI } from "@/app/admin/photos/actions";

interface Celebrity {
  id: string;
  name: string;
}

interface Props {
  celebrities: Celebrity[];
}

export function ImportForm({ celebrities }: Props) {
  const router = useRouter();
  const [celebrityId, setCelebrityId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [savedPhotoId, setSavedPhotoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!celebrityId || !imageUrl) return;

    setStatus("saving");
    setError("");
    const supabase = createClient();

    const { data: photo, error: insertError } = await supabase
      .from("photos")
      .insert({
        celebrity_id: celebrityId,
        fallback_image_url: imageUrl,
        source_url: sourceUrl || null,
        ai_status: "pending",
        published: false,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(`Save failed: ${insertError.message}`);
      setStatus("error");
      return;
    }

    setSavedPhotoId(photo.id);
    setStatus("done");
  }

  async function handleRunAI() {
    if (!savedPhotoId) return;
    await triggerAI(savedPhotoId);
    router.push("/admin/photos");
  }

  if (status === "done" && savedPhotoId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="font-medium text-green-800">Photo saved successfully!</p>
          <p className="text-sm text-green-700 mt-1">
            The photo has been imported and is ready for AI processing.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRunAI}>Run AI now</Button>
          <Button variant="outline" onClick={() => router.push("/admin/photos")}>
            Do it later
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5">Celebrity *</label>
        <Select
          value={celebrityId}
          onChange={(e) => setCelebrityId(e.target.value)}
          required
        >
          <option value="">Select a celebrity...</option>
          {celebrities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Image URL *</label>
        <Input
          type="url"
          placeholder="https://example.com/photo.jpg"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value);
            setPreview(false);
          }}
          required
        />
        {imageUrl && (
          <button
            type="button"
            className="text-xs text-blue-600 mt-1 hover:underline"
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? "Hide preview" : "Preview image"}
          </button>
        )}
        {preview && imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Preview"
            className="mt-2 rounded-lg max-h-64 object-contain border"
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Source URL (optional)</label>
        <Input
          type="url"
          placeholder="https://... (article or social post URL)"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={status === "saving"}
        className="w-full"
      >
        {status === "saving" ? "Saving..." : "Save photo"}
      </Button>
    </form>
  );
}
