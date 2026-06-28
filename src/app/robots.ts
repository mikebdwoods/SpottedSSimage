import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spotted.co.uk";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/auth/", "/unsubscribe"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
