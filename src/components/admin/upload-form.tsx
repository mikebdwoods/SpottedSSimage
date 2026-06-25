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

export function UploadForm({ celebrities }: Props) {
  const router = useRouter();
  const [celebrityId, setCelebrityId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "saving" | "done" | "error">("idle");
  const [savedPhotoId, setSavedPhotoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!celebrityId || !imageFile) return;

    setStatus("uploading");
    setError("");
    const supabase = createClient();

    // Upload to Supabase Storage
    const ext = imageFile.name.split(".").pop();
    const filename = `${crypto.randomUUID()}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("photos")
      .upload(filename, imageFile, { contentType: imageFile.type });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setStatus("error");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("photos").getPublicUrl(uploadData.path);

    setStatus("saving");

    // Insert photo record
    const { data: photo, error: insertError } = await supabase
      .from("photos")
      .insert({
        celebrity_id: celebrityId,
        fallback_image_url: publicUrl,
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
            The photo has been saved and is ready for AI processing.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRunAI}>Run AI now</Button>
          <Button
            variant="outline"
            onClick={() => router.push("/admin/photos")}
          >
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
        <label className="block text-sm font-medium mb-1.5">Source URL (optional)</label>
        <Input
          type="url"
          placeholder="https://..."
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Photo *</label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        disabled={status === "uploading" || status === "saving"}
        className="w-full"
      >
        {status === "uploading"
          ? "Uploading image..."
          : status === "saving"
          ? "Saving..."
          : "Save photo"}
      </Button>
    </form>
  );
}
