import type { Metadata } from "next";
import Link from "next/link";
import LineButton from "@/components/LineButton";
import { COMPANY, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "聯絡方式",
  description: "透過詢價表單、LINE 官方帳號、電話或 Email 與浮雲旅遊聯繫，由專人協助確認車型、日期與報價。",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <h1>聯絡方式</h1>
      <p className="lead">
        歡迎提供出發日期、人數、上車地點與目的地，我們會由專人協助確認車型與報價。
      </p>

      <section className="card-grid">
        <Link className="card" href="/contact/inquiry">
          <h3>表單詢價</h3>
          <p>填寫旅遊類型、日期、路線、人數與車型需求，方便我們快速整理報價。</p>
        </Link>

        <div className="card">
          <h3>LINE 快速聯繫</h3>
          <p>適合即時詢問包車、接送、企業接待與客製化行程。</p>
          <LineButton>LINE 官方帳號諮詢</LineButton>
        </div>

        <div className="card">
          <h3>電話與 Email</h3>
          <p>
            電話：<a href={`tel:${COMPANY.phone}`}>{COMPANY.phone}</a>
          </p>
          <p>
            Email：<a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </p>
          <p>傳真：{COMPANY.fax}</p>
          <p>聯絡人：{COMPANY.contactPerson}</p>
        </div>

        <div className="card">
          <h3>公司地址</h3>
          <p>{COMPANY.address}</p>
          <p>{COMPANY.agencyType}</p>
        </div>
      </section>
    </>
  );
}
