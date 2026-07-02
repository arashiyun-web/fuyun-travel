import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "浮雲輕鬆遊",
    short_name: "浮雲輕鬆遊",
    description: "台灣包車旅遊、遊覽車包車、機場接送、校外教學、企業旅遊，一鍵詢價。",
    start_url: "/?utm_source=pwa",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#2f2f2f",
    background_color: "#1f1f1f",
    lang: "zh-Hant",
    scope: "/",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["travel", "lifestyle"],
    screenshots: [
      {
        src: "/hero-bus-sunny.png",
        sizes: "1672x941",
        type: "image/png",
      },
    ],
  };
}
