import type { Metadata } from "next";
import Link from "next/link";
import LegalInfo from "@/components/LegalInfo";
import LineButton from "@/components/LineButton";
import { SITE, COMPANY } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE.defaultTitle },
  description: SITE.defaultDescription,
  alternates: { canonical: SITE.url },
  openGraph: {
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    url: SITE.url,
    siteName: SITE.name,
    locale: "zh_TW",
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: COMPANY.companyName,
  alternateName: COMPANY.siteName,
  url: SITE.url,
  telephone: COMPANY.phone,
  email: COMPANY.email,
  faxNumber: COMPANY.fax,
  address: {
    "@type": "PostalAddress",
    streetAddress: COMPANY.address,
    addressCountry: "TW",
  },
  areaServed: "Taiwan",
  serviceType: ["台灣包車旅遊", "企業接待", "機場接送", "客製化行程規劃"],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="hero">
        <h1>專業包車旅遊服務</h1>
        <p className="lead">
          浮雲旅遊提供台灣包車旅遊、企業接待、機場接送與客製化行程規劃，由專人協助確認車型、日期與報價。
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/contact/inquiry">立即詢價</Link>
          <Link className="btn" href="/itineraries">查看行程</Link>
          <LineButton>LINE 諮詢</LineButton>
        </div>
      </section>

      <section className="card-grid">
        <Link className="card" href="/services">
          <h3>服務</h3>
          <p>包車旅遊、機場接送、企業接待與客製行程。</p>
        </Link>
        <Link className="card" href="/fleet">
          <h3>車型</h3>
          <p>大型遊覽車、中巴、商務車，依人數與行李安排。</p>
        </Link>
        <Link className="card" href="/itineraries">
          <h3>行程</h3>
          <p>精選旅遊、報名選位與會員訂單查詢。</p>
        </Link>
        <Link className="card" href="/contact">
          <h3>聯絡</h3>
          <p>LINE、電話、Email 與表單詢價。</p>
        </Link>
      </section>

      <LegalInfo />
    </>
  );
}
