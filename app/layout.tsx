import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import "./globals.css";
import FloatingContactBar from "@/components/FloatingContactBar";
import Footer from "@/components/Footer";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.defaultTitle,
    template: `%s｜${SITE.name}`,
  },
  description: SITE.defaultDescription,
  keywords: [
    "浮雲輕鬆遊",
    "台灣包車",
    "遊覽車包車",
    "機場接送",
    "校外教學",
    "企業旅遊",
    "台灣旅遊",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: SITE.url },
  openGraph: {
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    url: SITE.url,
    siteName: SITE.name,
    locale: SITE.locale,
    type: "website",
    images: [SITE.ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    images: [SITE.ogImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f2f2f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="zh-Hant">
      <body>
        {gaId ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        ) : null}
        <Suspense fallback={null}>
          <AnalyticsProvider>
            <main className="page">{children}</main>
            <Footer />
            <FloatingContactBar />
          </AnalyticsProvider>
        </Suspense>
      </body>
    </html>
  );
}
