import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photo, product, and news images come from arbitrary retailer and
    // news CDNs (imported via the feed pipeline), so any HTTPS host is
    // allowed rather than maintaining a per-CDN allowlist.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
