import { commandDocs } from "@/data/commandDocs";
import { SITE_URL } from "@/lib/site";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/commands`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...commandDocs.map((doc) => ({
      url: `${SITE_URL}/commands/${doc.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/install`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/status`, lastModified, changeFrequency: "always", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
