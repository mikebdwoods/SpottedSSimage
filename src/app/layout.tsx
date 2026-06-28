import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { CookieBanner } from "@/components/cookie-banner";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spotted.co.uk";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Spotted — Celebrity Fashion Finds",
    template: "%s | Spotted",
  },
  description:
    "Discover what your favourite celebrities are wearing — and shop the look for less.",
  openGraph: {
    siteName: "Spotted",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main>{children}</main>
        <footer className="border-t py-10 px-4 text-sm text-muted-foreground">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-bold text-foreground">Spotted</p>
            <nav className="flex gap-5">
              <a href="/" className="hover:underline">Home</a>
              <a href="/privacy" className="hover:underline">Privacy</a>
            </nav>
            <p>© {new Date().getFullYear()} Spotted. UK Celebrity Fashion.</p>
          </div>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
