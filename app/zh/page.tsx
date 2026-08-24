import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "繁體中文",
  description: "浮雲輕鬆遊繁體中文入口。",
  path: "/zh",
});

export default function ZhPage() {
  return (
    <>
      <h1>浮雲輕鬆遊</h1>
      <p className="lead">繁體中文為主要內容語系，支援台灣包車旅遊、機場接送、校外教學與企業旅遊。</p>
      <Link href="/travel">前往旅遊內容中心</Link>
    </>
  );
}
