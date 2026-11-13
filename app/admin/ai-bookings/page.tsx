import Link from "next/link";
import { adminSessionTokenFromCookies } from "@/lib/adminSession";
import AiBookingList from "./AiBookingList";

export const dynamic = "force-dynamic";

export default function AiBookingsPage() {
  const session = adminSessionTokenFromCookies();
  return <div className="min-h-[calc(100vh-160px)] space-y-6 text-slate-100">
    <Link href="/admin" className="text-xs text-amber-400">← 回後台首頁</Link>
    <header className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h1 className="text-xl font-bold text-amber-400">AI 待確認訂單</h1>
      <p className="mt-2 text-sm text-slate-400">顯示最近 100 筆需求。由專人確認車輛與價格，聯絡旅客並另行提供正式報價。</p>
    </header>
    {session ? <AiBookingList /> : <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
      請先到 <Link href="/admin" className="underline">/admin</Link> 登入管理員。
    </p>}
  </div>;
}
