import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { CookieBanner } from "@/components/cookie-banner";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
    images: [
      {
        url: `${siteUrl}/api/og?title=Spotted&subtitle=UK Celebrity Fashion Finds`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${siteUrl}/api/og?title=Spotted&subtitle=UK Celebrity Fashion Finds`],
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
        <footer className="border-t bg-gray-50 py-14 px-4 text-sm text-muted-foreground">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
              {/* Brand */}
              <div className="col-span-2 sm:col-span-1">
                <p className="font-black text-xl text-foreground mb-2">Spotted</p>
                <p className="text-xs leading-relaxed">
                  Discover what your favourite UK celebrities are wearing — and shop
                  the look for less.
                </p>
              </div>
              {/* Discover */}
              <div>
                <p className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">Discover</p>
                <nav className="space-y-2">
                  <a href="/" className="block hover:text-foreground transition-colors">Home</a>
                  <a href="/celebrities" className="block hover:text-foreground transition-colors">All Celebrities</a>
                  <a href="/looks" className="block hover:text-foreground transition-colors">Latest Looks</a>
                  <a href="/trending" className="block hover:text-foreground transition-colors">Trending</a>
                  <a href="/news" className="block hover:text-foreground transition-colors">News</a>
                  <a href="/search" className="block hover:text-foreground transition-colors">Search</a>
                  <a href="/category/dress" className="block hover:text-foreground transition-colors">Dresses</a>
                  <a href="/category/bag" className="block hover:text-foreground transition-colors">Bags</a>
                  <a href="/category/shoes" className="block hover:text-foreground transition-colors">Shoes</a>
                </nav>
              </div>
              {/* Company */}
              <div>
                <p className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">Company</p>
                <nav className="space-y-2">
                  <a href="/about" className="block hover:text-foreground transition-colors">About</a>
                  <a href="/contact" className="block hover:text-foreground transition-colors">Contact</a>
                  <a href="/privacy" className="block hover:text-foreground transition-colors">Privacy</a>
                  <a href="/terms" className="block hover:text-foreground transition-colors">Terms</a>
                </nav>
              </div>
              {/* Newsletter */}
              <div>
                <p className="font-semibold text-foreground mb-3 text-xs uppercase tracking-wider">Newsletter</p>
                <p className="text-xs mb-3 leading-relaxed">
                  New looks and shopping finds — direct to your inbox.
                </p>
                <a
                  href="/#newsletter"
                  className="inline-block text-xs bg-black text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                >
                  Subscribe
                </a>
                <a href="/unsubscribe" className="block text-xs mt-2 hover:text-foreground transition-colors">
                  Unsubscribe
                </a>
              </div>
            </div>
            <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs">© {new Date().getFullYear()} Spotted. UK Celebrity Fashion.</p>
              <p className="text-xs">
                Some links are affiliate links — we may earn a small commission.
              </p>
            </div>
          </div>
        </footer>
        <CookieBanner />
        <SpeedInsights />
      </body>
    </html>
  );
}
