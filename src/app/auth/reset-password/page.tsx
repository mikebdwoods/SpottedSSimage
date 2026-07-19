import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Set a new password | Spotted" };

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Choose a new password for your account
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
