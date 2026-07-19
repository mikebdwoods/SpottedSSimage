"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      setStatus("error");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords don't match.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setStatus("error");
    } else {
      setStatus("done");
      setPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        autoComplete="new-password"
        minLength={8}
      />
      <Input
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        autoComplete="new-password"
        minLength={8}
      />
      <Button type="submit" size="sm" disabled={status === "loading" || !password}>
        {status === "loading" ? "Updating..." : "Update password"}
      </Button>
      {status === "error" && <p className="text-destructive text-sm">{message}</p>}
      {status === "done" && <p className="text-sm text-green-600">Password updated.</p>}
    </form>
  );
}
