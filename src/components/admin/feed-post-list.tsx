"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { importExternalPost, importExternalPostBatch } from "@/app/admin/feed/actions";
import { Button } from "@/components/ui/button";

export interface FeedPost {
  id: string;
  title: string | null;
  image_url: string | null;
  link: string | null;
  publisher_url: string | null;
  source_name: string | null;
  published_at: string | null;
  photo_id: string | null;
  celeb_name: string | null;
}

interface Props {
  posts: FeedPost[];
}

export function FeedPostList({ posts }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchState, setBatchState] = useState<"idle" | "importing" | "done">("idle");
  const [error, setError] = useState("");

  const importable = posts.filter((p) => !p.photo_id && p.image_url);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === importable.length
        ? new Set()
        : new Set(importable.map((p) => p.id))
    );
  }

  async function handleSingle(postId: string, runAI: boolean) {
    setBusyId(postId);
    setError("");
    try {
      await importExternalPost(postId, runAI);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
    setBusyId(null);
  }

  async function handleBatch(runAI: boolean) {
    if (selected.size === 0) return;
    setBatchState("importing");
    setError("");
    try {
      await importExternalPostBatch([...selected], runAI);
      setBatchState("done");
      setSelected(new Set());
      setTimeout(() => {
        setBatchState("idle");
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch import failed");
      setBatchState("idle");
    }
  }

  return (
    <div>
      {/* Bulk action bar */}
      {importable.length > 0 && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.size === importable.length && importable.length > 0}
              onChange={toggleAll}
              className="rounded"
            />
            Select all on page ({importable.length})
          </label>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                size="sm"
                onClick={() => handleBatch(true)}
                disabled={batchState !== "idle"}
                className="text-xs"
              >
                {batchState === "importing"
                  ? "Importing..."
                  : batchState === "done"
                  ? "Done ✓"
                  : `Import ${selected.size} + AI`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBatch(false)}
                disabled={batchState !== "idle"}
                className="text-xs"
              >
                Import only
              </Button>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <div className="border rounded-lg overflow-hidden divide-y">
        {posts.map((post) => {
          const canImport = !post.photo_id && !!post.image_url;
          return (
            <div key={post.id} className="flex items-start gap-3 p-4 hover:bg-gray-50">
              <div className="pt-1 shrink-0">
                {canImport ? (
                  <input
                    type="checkbox"
                    checked={selected.has(post.id)}
                    onChange={() => toggle(post.id)}
                    className="rounded"
                  />
                ) : (
                  <span className="inline-block w-4" />
                )}
              </div>
              {post.image_url && (
                <a
                  href={post.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-20 h-24 object-cover rounded-lg bg-gray-100"
                    loading="lazy"
                  />
                </a>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-1">
                  <span className="font-semibold text-foreground">
                    {post.celeb_name ?? "—"}
                  </span>
                  {post.source_name && <span>· {post.source_name}</span>}
                  {post.published_at && (
                    <span>
                      · {new Date(post.published_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-2">
                  {post.title ?? "Untitled post"}
                </p>
                <a
                  href={post.publisher_url || post.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                >
                  View source →
                </a>
              </div>
              <div className="shrink-0">
                {post.photo_id ? (
                  <Link
                    href={`/admin/photos/${post.photo_id}`}
                    className="text-xs font-semibold text-green-600 hover:underline"
                  >
                    Imported ✓
                  </Link>
                ) : (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleSingle(post.id, true)}
                      disabled={busyId === post.id}
                      className="text-xs"
                    >
                      {busyId === post.id ? "..." : "Import + AI"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSingle(post.id, false)}
                      disabled={busyId === post.id}
                      className="text-xs"
                    >
                      Import
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
