import type { Metadata } from "next";
import Link from "next/link";
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

      <section className="hero hero-photo">
        <div className="hero__overlay">
          <p className="eyebrow">浮雲旅遊｜專業包車旅遊服務</p>
          <h1>專業包車旅遊服務</h1>
          <p className="lead">
            浮雲旅遊提供台灣包車旅遊、企業接待、機場接送與客製化行程規劃，由專人協助確認車型、日期與報價。
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/contact/inquiry">立即詢價</Link>
            <Link className="btn btn-glass" href="/itineraries">查看行程</Link>
            <LineButton>LINE 諮詢</LineButton>
          </div>
        </div>
      </section>

      <section className="card-grid feature-grid" aria-label="浮雲旅遊服務入口">
        <Link className="card feature-card" href="/services">
          <span className="feature-card__label">服務</span>
          <h3>包車與企業接待</h3>
          <p>包車旅遊、機場接送、企業接待與客製行程。</p>
        </Link>
        <Link className="card feature-card" href="/fleet">
          <span className="feature-card__label">車型</span>
          <h3>大型車、中巴、商務車</h3>
          <p>依照人數、行李量與路線安排合適車型。</p>
        </Link>
        <Link className="card feature-card" href="/itineraries">
          <span className="feature-card__label">行程</span>
          <h3>精選旅遊與報名選位</h3>
          <p>查看精選行程、會員訂單與座位預訂流程。</p>
        </Link>
        <Link className="card feature-card" href="/contact">
          <span className="feature-card__label">聯絡</span>
          <h3>LINE、電話、Email</h3>
          <p>由專人協助確認日期、車型、路線與報價。</p>
        </Link>
      </section>
    </>
  );
}
