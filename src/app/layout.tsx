import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { CookieBanner } from "@/components/cookie-banner";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

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
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <footer className="relative border-t border-border bg-primary text-primary-foreground py-16 px-4 texture-grain overflow-hidden">
          <div className="relative mx-auto max-w-7xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-12">
              {/* Brand */}
              <div className="col-span-2 sm:col-span-1">
                <p className="font-serif italic text-2xl mb-3">Spotted</p>
                <p className="text-xs leading-relaxed text-primary-foreground/60 max-w-[22ch]">
                  Discover what your favourite UK celebrities are wearing —
                  and shop the look for less.
                </p>
              </div>
              {/* Discover */}
              <div>
                <p className="font-semibold mb-4 text-xs uppercase tracking-[0.15em] text-primary-foreground/50">
                  Discover
                </p>
                <nav className="space-y-2.5 text-primary-foreground/70">
                  <a href="/" className="block hover:text-primary-foreground transition-colors">Home</a>
                  <a href="/celebrities" className="block hover:text-primary-foreground transition-colors">All Celebrities</a>
                  <a href="/looks" className="block hover:text-primary-foreground transition-colors">Latest Looks</a>
                  <a href="/trending" className="block hover:text-primary-foreground transition-colors">Trending</a>
                  <a href="/news" className="block hover:text-primary-foreground transition-colors">News</a>
                  <a href="/search" className="block hover:text-primary-foreground transition-colors">Search</a>
                  <a href="/category/dress" className="block hover:text-primary-foreground transition-colors">Dresses</a>
                  <a href="/category/bag" className="block hover:text-primary-foreground transition-colors">Bags</a>
                  <a href="/category/shoes" className="block hover:text-primary-foreground transition-colors">Shoes</a>
                </nav>
              </div>
              {/* Company */}
              <div>
                <p className="font-semibold mb-4 text-xs uppercase tracking-[0.15em] text-primary-foreground/50">
                  Company
                </p>
                <nav className="space-y-2.5 text-primary-foreground/70">
                  <a href="/about" className="block hover:text-primary-foreground transition-colors">About</a>
                  <a href="/contact" className="block hover:text-primary-foreground transition-colors">Contact</a>
                  <a href="/privacy" className="block hover:text-primary-foreground transition-colors">Privacy</a>
                  <a href="/terms" className="block hover:text-primary-foreground transition-colors">Terms</a>
                </nav>
              </div>
              {/* Newsletter */}
              <div>
                <p className="font-semibold mb-4 text-xs uppercase tracking-[0.15em] text-primary-foreground/50">
                  Newsletter
                </p>
                <p className="text-xs mb-4 leading-relaxed text-primary-foreground/60">
                  New looks and shopping finds — direct to your inbox.
                </p>
                <a
                  href="/#newsletter"
                  className="inline-block text-xs font-semibold bg-clay text-clay-foreground px-4 py-2 rounded-full hover:bg-clay/90 transition-colors"
                >
                  Subscribe
                </a>
                <a href="/unsubscribe" className="block text-xs mt-3 text-primary-foreground/50 hover:text-primary-foreground transition-colors">
                  Unsubscribe
                </a>
              </div>
            </div>
            <div className="border-t border-primary-foreground/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-primary-foreground/50">
              <p className="text-xs">© {new Date().getFullYear()} Spotted. UK Celebrity Fashion.</p>
              <p className="text-xs">
                Some links are affiliate links — we may earn a small commission.
              </p>
            </div>
          </div>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
