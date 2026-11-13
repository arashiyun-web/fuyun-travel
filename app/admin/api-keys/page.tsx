import Link from "next/link";
import { adminSessionTokenFromCookies } from "@/lib/adminSession";
import ApiKeysManager from "./ApiKeysManager";

export const dynamic = "force-dynamic";

export default function ApiKeysPage() {
  const session = adminSessionTokenFromCookies();
  return <div className="min-h-[calc(100vh-160px)] space-y-6 text-slate-100">
    <Link href="/admin" className="text-xs text-amber-400">← 回後台首頁</Link>
    <header className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h1 className="text-xl font-bold text-amber-400">AI API 金鑰</h1>
      <p className="mt-2 text-sm text-slate-400">管理員可核發與停用金鑰、查看用量。新金鑰的明碼只顯示一次，請立即安全保存。</p>
    </header>
    {session ? <ApiKeysManager /> : <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
      請先到 <Link href="/admin" className="underline">/admin</Link> 登入管理員。
    </p>}
  </div>;
}
