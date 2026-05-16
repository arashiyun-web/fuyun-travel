import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "雲驛旅行社｜浮雲輕旅｜專業包車旅遊服務",
    template: "%s｜雲驛旅行社｜浮雲輕旅"
  },
  description:
    "雲驛旅行社｜浮雲輕旅提供台灣專業包車旅遊服務，包含企業接待、機場接送、環島旅遊、客製行程與高品質小團旅遊。",
  keywords: [
    "台灣包車",
    "包車旅遊",
    "雲驛旅行社",
    "浮雲輕旅",
    "企業包車",
    "商務接待",
    "客製旅遊",
    "小團高品質",
    "遊覽車",
    "企業接送",
    "新北包車",
    "板橋包車"
  ],
  openGraph: {
    title: "雲驛旅行社｜浮雲輕旅｜專業包車旅遊服務",
    description: "企業接待、機場接送、環島旅遊、客製行程與高品質台灣包車服務。",
    url: siteUrl,
    siteName: "雲驛旅行社｜浮雲輕旅",
    locale: "zh_TW",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1f3a"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
