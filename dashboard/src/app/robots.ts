import { SITE_URL } from "@/lib/site";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/commands", "/install", "/privacy", "/terms"],
        disallow: [
          "/api/",
          "/dashboard",
          "/servers",
          "/collections",
          "/profile",
          "/premium",
          "/my-bots",
          "/help",
          "/admin",
          "/insights",
          "/login",
          "/invite",
          "/support",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
