import type { Metadata } from "next";
import Link from "next/link";
import InquiryForm from "@/components/InquiryForm";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "立即報價",
  description: "填寫台灣包車、遊覽車、中巴、九人座、機場接送與客製化行程詢價需求。",
  path: "/contact/inquiry",
});

export default function InquiryPage() {
  return (
    <>
      <p>
        <Link href="/contact">← 返回聯絡我們</Link>
      </p>
      <h1>立即報價</h1>
      <p className="lead">請留下基本需求，客服會依日期、人數、車型與路線協助評估。</p>
      <InquiryForm />
    </>
  );
}
