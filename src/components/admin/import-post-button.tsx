"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importExternalPost } from "@/app/admin/feed/actions";
import { Button } from "@/components/ui/button";

interface Props {
  postId: string;
}

export function ImportPostButton({ postId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleImport(runAI: boolean) {
    setState("importing");
    setError("");
    try {
      await importExternalPost(postId, runAI);
      setState("done");
      setTimeout(() => router.refresh(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="text-xs font-semibold text-green-600">Imported ✓</span>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex gap-1.5">
        <Button
          size="sm"
          onClick={() => handleImport(true)}
          disabled={state === "importing"}
          className="text-xs"
        >
          {state === "importing" ? "Importing..." : "Import + AI"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleImport(false)}
          disabled={state === "importing"}
          className="text-xs"
        >
          Import only
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
