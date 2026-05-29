import type { Metadata } from "next";
import { COMPANY, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "隱私權政策",
  description: `${COMPANY.companyName}（${COMPANY.siteName}）個人資料蒐集、處理及利用之告知事項。`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <article className="privacy">
      <h1>隱私權政策</h1>
      <p>
        {COMPANY.companyName}（品牌「{COMPANY.siteName}」）尊重並保護您的個人資料。
        當您使用本網站、填寫詢價表單、加入 LINE 官方帳號或註冊會員時，即表示您了解本政策。
      </p>

      <h2>一、蒐集機關</h2>
      <p>{COMPANY.companyName}</p>

      <h2>二、蒐集目的</h2>
      <p>旅遊詢價、包車報價、訂單聯繫、客服回覆、行程安排與會員通知。</p>

      <h2>三、蒐集資料類別</h2>
      <p>姓名、電話、Email、LINE ID，以及您主動提供的出發日期、地點、人數、車型、行程需求與備註。</p>

      <h2>四、利用期間、地區、對象及方式</h2>
      <p>
        期間：自蒐集之日起至您要求停止利用或本公司停止提供服務時止。
        地區：台灣及提供服務所需之地區。
        對象：本公司及完成您委託服務所必要之合作夥伴，例如車隊、住宿、餐廳或保險服務單位。
        方式：以電話、電子郵件、LINE、簡訊或網站系統聯繫與保存。
      </p>

      <h2>五、當事人權利</h2>
      <p>
        依個人資料保護法，您得向本公司請求查詢、閱覽、製給複製本、補充或更正、停止蒐集處理利用，或刪除個人資料。
      </p>

      <h2>六、不提供資料之影響</h2>
      <p>若您不提供必要資料，本公司可能無法提供報價、預訂、聯繫或後續服務。</p>

      <h2>七、聯絡窗口</h2>
      <p>
        聯絡人：{COMPANY.contactPerson}　電話：{COMPANY.phone}　Email：{COMPANY.email}
      </p>

      <h2>八、政策更新</h2>
      <p>本政策如有調整，將公告於本網站。</p>
    </article>
  );
}
