import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "旅客評價",
  description: "浮雲輕鬆遊旅客評價與服務回饋，包含家庭旅遊、企業旅遊、校外教學與機場接送。",
  path: "/reviews",
});

const reviews = [
  {
    name: "企業福委會窗口",
    text: "行前溝通清楚，司機準時，臨時調整集合點也能協助處理。",
    service: "企業旅遊",
  },
  {
    name: "家庭旅遊旅客",
    text: "帶長輩出門很怕行程太趕，這次安排的停靠點與休息時間剛好。",
    service: "銀髮旅遊",
  },
  {
    name: "學校行政老師",
    text: "分車資料與聯絡資訊整理完整，校外教學接送過程很順。",
    service: "校外教學",
  },
];

export default function ReviewsPage() {
  return (
    <>
      <h1>旅客評價</h1>
      <p className="lead">未來可串接 Google Business、Facebook 評價與站內審核流程，形成 Review Schema。</p>
      <section className="card-grid">
        {reviews.map((review) => (
          <article className="card" key={review.name}>
            <p className="lead">{review.service}</p>
            <h3>{review.name}</h3>
            <p>{review.text}</p>
          </article>
        ))}
      </section>
    </>
  );
}
