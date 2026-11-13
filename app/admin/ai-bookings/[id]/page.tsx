import Link from "next/link";
import { adminSessionTokenFromCookies } from "@/lib/adminSession";
import AiBookingDetails from "./AiBookingDetails";

export const dynamic = "force-dynamic";

export default function AiBookingPage({ params }: { params: { id: string } }) {
  const session = adminSessionTokenFromCookies();
  return <div className="min-h-[calc(100vh-160px)] space-y-6 text-slate-100">
    <Link href="/admin/ai-bookings" className="text-xs text-amber-400">← 回 AI 訂單清單</Link>
    {session ? <AiBookingDetails key={params.id} id={params.id} /> : <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
      請先到 <Link href="/admin" className="underline">/admin</Link> 登入管理員。
    </p>}
  </div>;
}
