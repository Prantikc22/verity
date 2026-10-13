import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { SOLUTION_SLUGS } from "@/lib/seo-pages";

/** Public, indexable pages only (the app, auth and API stay out). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<[string, MetadataRoute.Sitemap[number]["changeFrequency"], number]> = [
    ["", "weekly", 1],
    ["/pricing", "monthly", 0.9],
    ["/docs", "weekly", 0.8],
    ["/mcp", "monthly", 0.7],
    ["/github", "monthly", 0.7],
    ["/solutions", "monthly", 0.8],
    ...SOLUTION_SLUGS.map((s): [string, "monthly", number] => [`/solutions/${s}`, "monthly", 0.8]),
    ["/compare/testsprite", "monthly", 0.7],
  ];
  return pages.map(([path, changeFrequency, priority]) => ({ url: `${SITE_URL}${path}`, changeFrequency, priority }));
}
