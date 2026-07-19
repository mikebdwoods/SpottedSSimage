"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      setStatus("error");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  if (status === "sent") {
    return (
      <div className="text-center py-6">
        <p className="text-lg font-medium mb-2">Check your email</p>
        <p className="text-muted-foreground text-sm">
          We&apos;ve sent a magic link to <strong>{email}</strong>. Click it to
          sign in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode === "password" ? (
        <form onSubmit={handlePasswordSignIn} className="space-y-3">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end -mt-1">
            <Link href="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-clay hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Signing in..." : "Sign in"}
          </Button>
          {status === "error" && <p className="text-destructive text-sm">{message}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Prefer a link instead?{" "}
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setMessage("");
                setMode("magic-link");
              }}
              className="underline hover:text-clay"
            >
              Email me a magic link
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-3">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Sending..." : "Send magic link"}
          </Button>
          {status === "error" && <p className="text-destructive text-sm">{message}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Have a password?{" "}
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setMessage("");
                setMode("password");
              }}
              className="underline hover:text-clay"
            >
              Sign in with password
            </button>
          </p>
        </form>
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={handleGoogleLogin} type="button">
        Continue with Google
      </Button>
    </div>
  );
}
