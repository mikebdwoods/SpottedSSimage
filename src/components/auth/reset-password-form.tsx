"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setCheckingSession(false);
    });
  }, []);

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
      setTimeout(() => {
        router.push("/account");
        router.refresh();
      }, 1500);
    }
  }

  if (checkingSession) {
    return <p className="text-center text-sm text-muted-foreground py-6">Checking your link...</p>;
  }

  if (!hasSession) {
    return (
      <div className="text-center py-6">
        <p className="text-lg font-medium mb-2">This link isn&apos;t valid</p>
        <p className="text-muted-foreground text-sm mb-4">
          It may have expired, or already been used. Request a new one below.
        </p>
        <a href="/auth/forgot-password" className="text-sm underline hover:text-clay font-medium">
          Request a new reset link
        </a>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="text-center py-6">
        <p className="text-lg font-medium mb-2">Password updated</p>
        <p className="text-muted-foreground text-sm">Taking you to your account...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Input
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Updating..." : "Update password"}
      </Button>
      {status === "error" && <p className="text-destructive text-sm">{message}</p>}
    </form>
  );
}
