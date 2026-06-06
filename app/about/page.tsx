import type { Metadata } from "next";
import { COMPANY, organizationJsonLd, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "關於我們",
  description: "浮雲輕鬆遊品牌故事：創辦人雲惠民從遊覽車司機起家，至今仍親自服務旅客，重視安全、誠信與專業。",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
      <h1>關於我們</h1>
      <p className="lead">浮雲輕鬆遊由旅行社與車隊服務經驗累積而成，讓包車旅遊更安心、更好溝通。</p>

      <section className="card-grid">
        <div className="card">
          <h3>品牌故事</h3>
          <p>創辦人雲惠民從遊覽車司機起家，熟悉旅客、司機、學校與企業行政窗口在旅途中真正需要被照顧的細節。</p>
        </div>
        <div className="card">
          <h3>服務精神</h3>
          <p>至今仍親自服務旅客，強調安全、誠信與專業，讓每一次出發都有清楚窗口與可追蹤流程。</p>
        </div>
        <div className="card">
          <h3>公司資訊</h3>
          <p>{COMPANY.companyName}｜{COMPANY.fleetCompanyName}</p>
          <p>統編：{COMPANY.taxId}</p>
          <p>{COMPANY.memberVerify}</p>
          <p>{COMPANY.performanceBond}</p>
          <p>電話：{COMPANY.phone}</p>
          <p>地址：{COMPANY.address}</p>
        </div>
      </section>
    </>
  );
}
