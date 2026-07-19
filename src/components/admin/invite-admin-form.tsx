"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { inviteAdmin } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteAdminForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await inviteAdmin(formData);
      formRef.current?.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-wrap gap-2 items-center">
      <Input
        type="email"
        name="email"
        placeholder="email@example.com"
        required
        className="max-w-xs"
      />
      <select
        name="role"
        defaultValue="admin"
        className="h-10 rounded-full border border-border bg-transparent px-4 text-sm"
      >
        <option value="admin">Admin</option>
        <option value="user">User</option>
      </select>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Inviting..." : "Invite"}
      </Button>
      {error && <p className="text-destructive text-sm w-full">{error}</p>}
    </form>
  );
}
