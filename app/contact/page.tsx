import type { Metadata } from "next";
import Link from "next/link";
import LineButton from "@/components/LineButton";
import { COMPANY, pageMeta } from "@/lib/site";
import { contactItems } from "@/lib/siteContent";

export const metadata: Metadata = pageMeta({
  title: "聯絡我們",
  description: "透過詢價表單、LINE AI客服、電話與 Email 聯絡浮雲輕鬆遊，取得台灣包車旅遊建議與報價。",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <h1>聯絡我們</h1>
      <p className="lead">提供日期、人數、上車地點與目的地，我們會協助確認車型、路線與報價。</p>

      <section className="card-grid">
        {contactItems.map((item) => {
          const Icon = item.icon;
          return (
            <div className="card" key={item.slug}>
              <Icon size={28} />
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              {item.slug === "inquiry" ? <Link href="/contact/inquiry">填寫詢價表</Link> : null}
              {item.slug === "line" ? <LineButton>LINE 客服諮詢</LineButton> : null}
            </div>
          );
        })}

        <div className="card">
          <h3>電話與 Email</h3>
          <p>
            電話：<a href={`tel:${COMPANY.phone}`}>{COMPANY.phone}</a>
          </p>
          <p>
            Email：<a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </p>
          <p>地址：{COMPANY.address}</p>
        </div>
      </section>
    </>
  );
}
