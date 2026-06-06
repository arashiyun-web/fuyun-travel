import type { Metadata } from "next";
import { COMPANY, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "隱私權政策",
  description: `${COMPANY.companyName} 對詢價、聯絡、LINE 與網站資料使用的隱私權說明。`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <article className="privacy">
      <h1>隱私權政策</h1>
      <p>
        {COMPANY.companyName} 會將您提供的姓名、電話、LINE、Email、旅遊需求與詢價內容，用於回覆詢價、安排車輛、客服聯繫與服務改善。
      </p>

      <h2>資料使用目的</h2>
      <p>包含包車旅遊報價、行程建議、車隊調度、客服回覆、LINE 通知與必要的服務紀錄。</p>

      <h2>資料保存與保護</h2>
      <p>站內第一版以伺服器記憶體示範資料流，正式上線可銜接資料庫、權限控管、稽核紀錄與加密保存。</p>

      <h2>聯絡窗口</h2>
      <p>
        電話：{COMPANY.phone}｜Email：{COMPANY.email}｜地址：{COMPANY.address}
      </p>
    </article>
  );
}
