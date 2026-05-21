import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fuyuntravel.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "浮雲旅遊｜專業包車旅遊服務",
    template: "%s｜浮雲旅遊"
  },
  description:
    "浮雲旅遊提供台灣包車、企業接待、機場接送與精選行程報名服務，結合專業車隊與客製化旅遊安排。",
  keywords: [
    "浮雲旅遊",
    "台灣包車",
    "包車旅遊",
    "遊覽車",
    "企業接待",
    "機場接送",
    "行程報名"
  ],
  openGraph: {
    title: "浮雲旅遊｜專業包車旅遊服務",
    description: "台灣包車、企業接待、機場接送與精選行程報名服務。",
    url: siteUrl,
    siteName: "浮雲旅遊",
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
  themeColor: "#2f2f2f"
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
