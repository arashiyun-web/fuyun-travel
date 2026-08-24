import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "한국어",
  description: "대만 전세 차량 및 여행 상담 입구.",
  path: "/ko",
});

export default function KoPage() {
  return (
    <>
      <h1>Fuyun Travel</h1>
      <p className="lead">대만 전세 차량, 공항 픽업, 단체 여행 상담을 위한 입구입니다.</p>
      <Link href="/contact/inquiry">견적 문의</Link>
    </>
  );
}
