import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "日本語",
  description: "台湾貸切チャーターと旅行相談の入口。",
  path: "/ja",
});

export default function JaPage() {
  return (
    <>
      <h1>浮雲輕鬆遊</h1>
      <p className="lead">台湾での貸切車、空港送迎、団体旅行の相談窓口です。</p>
      <Link href="/contact/inquiry">見積もり相談</Link>
    </>
  );
}
