import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-black mb-4">404</p>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        This look might have been taken down, or the URL is wrong.
      </p>
      <Link href="/">
        <Button>Back to homepage</Button>
      </Link>
    </div>
  );
}
