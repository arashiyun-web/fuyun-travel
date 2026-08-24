import Script from "next/script";
import { Suspense } from "react";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import FloatingContactBarV2 from "@/components/FloatingContactBar_v2";
import FloatingLineButton from "@/components/FloatingLineButton";
import Footer from "@/components/Footer";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function SiteRootLayout({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: string;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <html lang={lang}>
      <body>
        <LanguageSwitcher />
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
        {pixelId ? (
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
          </Script>
        ) : null}
        <Script id="sw-register" strategy="afterInteractive">{`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`}</Script>
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
        <main className="page">{children}</main>
        <Footer />
        <FloatingContactBarV2 />
        <FloatingLineButton />
      </body>
    </html>
  );
}
