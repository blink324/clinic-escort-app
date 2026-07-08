import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "つきそい",
    short_name: "つきそい",
    description: "家族の通院予定と付き添い担当を共有するアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f8fb",
    theme_color: "#2f6fec",
    orientation: "portrait",
    icons: [
      {
        src: "/home-icon.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/home-icon.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
