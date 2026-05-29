import type { Metadata } from "next";
import Link from "next/link";
import InquiryForm from "@/components/InquiryForm";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "填寫詢價表單",
  description: "留下出發日期、人數、出發地、目的地與需求，收到後將協助確認車型、路線與報價。",
  path: "/contact/inquiry",
});

export default function InquiryPage() {
  return (
    <>
      <p><Link href="/contact">← 返回聯絡方式</Link></p>
      <h1>填寫詢價表單</h1>
      <p className="lead">請留下出發日期、人數、出發地、目的地與需求。收到後會依內容協助確認車型、路線與報價。</p>
      <InquiryForm />
    </>
  );
}
