"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase
      .from("newsletter_signups")
      .insert({ email });

    if (error) {
      if (error.code === "23505") {
        setMessage("You're already signed up!");
        setStatus("success");
      } else {
        setMessage("Something went wrong. Please try again.");
        setStatus("error");
      }
    } else {
      setMessage("You're in! We'll be in touch.");
      setStatus("success");
      setEmail("");
    }
  }

  if (status === "success") {
    return (
      <p className="text-green-400 font-medium">{message}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
      />
      <Button
        type="submit"
        disabled={status === "loading"}
        className="bg-white text-black hover:bg-gray-100 shrink-0"
      >
        {status === "loading" ? "..." : "Subscribe"}
      </Button>
      {status === "error" && (
        <p className="text-red-400 text-sm mt-2">{message}</p>
      )}
    </form>
  );
}
