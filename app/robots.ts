import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/terms", "/privacy", "/contact"],
      disallow: ["/appointments", "/groups", "/invite", "/line", "/mypage", "/share"]
    },
    sitemap: "https://www.clinic-tsukisoi.jp/sitemap.xml"
  };
}
