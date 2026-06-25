import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Sign in to Spotted</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Join to save looks and leave comments
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
