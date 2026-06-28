import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://spotted.co.uk";

  const [{ data: celebrities }, { data: photos }] = await Promise.all([
    supabase.from("celebrities").select("slug, created_at"),
    supabase
      .from("photos")
      .select("id, celebrity_id, created_at, celebrities(slug)")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const celebUrls: MetadataRoute.Sitemap = (celebrities ?? []).map((c) => ({
    url: `${baseUrl}/celebrity/${c.slug}`,
    lastModified: c.created_at,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const photoUrls: MetadataRoute.Sitemap = (photos ?? []).map((p) => {
    const slug = (p.celebrities as unknown as { slug: string } | null)?.slug;
    return {
      url: `${baseUrl}/celebrity/${slug}/photo/${p.id}`,
      lastModified: p.created_at,
      changeFrequency: "weekly",
      priority: 0.6,
    };
  });

  const staticUrls: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/celebrities`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/search`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [...staticUrls, ...celebUrls, ...photoUrls];
}
