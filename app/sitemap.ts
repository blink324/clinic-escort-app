import type { MetadataRoute } from "next";

const baseUrl = "https://www.clinic-tsukisoi.jp";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/terms", "/privacy", "/contact"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6
  }));
}
