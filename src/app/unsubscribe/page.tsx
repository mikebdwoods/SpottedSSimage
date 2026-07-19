"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UnsubscribePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");

    const supabase = createClient();
    const { error } = await supabase
      .from("newsletter_signups")
      .delete()
      .eq("email", email.trim().toLowerCase());

    if (error) {
      setMessage("Something went wrong. Please try again or email hello@spotted.co.uk.");
      setStatus("error");
    } else {
      setMessage("Done — you've been removed from the Spotted newsletter.");
      setStatus("done");
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-2">Unsubscribe</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Enter your email below and you&apos;ll be removed from the Spotted newsletter immediately.
        </p>

        {status === "done" ? (
          <div className="rounded-2xl border border-border bg-secondary/40 p-6">
            <p className="font-semibold mb-1">You&apos;re unsubscribed</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {status === "error" && (
              <p className="text-sm text-destructive">{message}</p>
            )}
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Removing..." : "Unsubscribe"}
            </Button>
          </form>
        )}

        <p className="text-xs text-muted-foreground mt-6">
          Changed your mind?{" "}
          <a href="/" className="underline">
            Go back to Spotted
          </a>
        </p>
      </div>
    </div>
  );
}
