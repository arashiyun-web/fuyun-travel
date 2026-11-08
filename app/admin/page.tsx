"use client";

import { FormEvent, useEffect, useState } from "react";

type Summary = {
  inquiries: number;
  quotes: number;
  operationsJobs: number;
  operationsQueued: number;
  operationsPublished: number;
};

type Order = {
  order_id: string;
  order_status: string;
  revenue: number;
  total_cost: number;
  net_profit: number;
};

type HealthFlag = { name: string; set: boolean };
type HealthFeature = {
  ready?: boolean;
  line?: boolean;
  email?: boolean;
  livePublish?: boolean;
  env?: HealthFlag[];
  optional?: string[];
  notUsed?: string[];
  lineEither?: string[];
  emailOptional?: string[];
};

const featureLabels: Record<string, string> = {
  copywriting: "文案",
  imageUpload: "圖片上傳",
  facebookPage: "Facebook 粉專",
  instagramLogin: "Instagram 登入",
  x: "X 發文",
  scheduler: "排程",
  inquiryNotify: "詢價通知",
};

const initialSummary: Summary = {
  inquiries: 0,
  quotes: 0,
  operationsJobs: 0,
  operationsQueued: 0,
  operationsPublished: 0,
};

export default function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [orders, setOrders] = useState<Order[]>([]);
  const [health, setHealth] = useState<Record<string, HealthFeature> | null>(null);
  const [healthError, setHealthError] = useState("");

  async function fetchDashboard(nextToken: string) {
    setLoadError("");
    try {
      const response = await fetch("/api/admin/financials/profit-analysis", {
        headers: { Authorization: `Bearer ${nextToken}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "讀取失敗");
      setSummary(data.summary);
      setOrders(data.details);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "登入成功，但資料讀取失敗");
    }
    try {
      const healthResponse = await fetch("/api/admin/health", {
        headers: { Authorization: `Bearer ${nextToken}` },
        cache: "no-store",
      });
      const healthData = await healthResponse.json();
      if (!healthResponse.ok || !healthData.success) throw new Error(healthData.error || "設定狀態讀取失敗");
      setHealth(healthData.features);
      setHealthError("");
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : "設定狀態讀取失敗");
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "登入失敗");
      localStorage.setItem("admin_token", data.token);
      setToken(data.token);
      setPassword("");
      await fetchDashboard(data.token);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登入失敗");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function logout() {
    // The HttpOnly session cookie can only be cleared by the server; the bearer token is local.
    const cleared = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      .then((response) => response.ok)
      .catch(() => false);
    localStorage.removeItem("admin_token");
    setToken("");
    setOrders([]);
    setSummary(initialSummary);
    if (!cleared) setLoginError("登出時無法清除伺服器登入狀態，請關閉瀏覽器或稍後再按一次登出。");
  }

  function openPlatformAdmin() {
    window.location.assign("/admin");
  }

  function openOperations() {
    window.location.href = "/admin/operations";
  }

  function openSocialDistribute() {
    window.location.href = "/admin/distribute";
  }

  function openContentSync() {
    window.location.href = "/admin/content-sync";
  }

  useEffect(() => {
    const saved = localStorage.getItem("admin_token") || "";
    if (saved) {
      setToken(saved);
      fetchDashboard(saved);
    }
  }, []);

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-160px)] flex items-center justify-center text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="border-b border-slate-800 pb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">fuyuntravel.com admin</p>
            <h1 className="text-xl font-bold text-amber-400 mt-1">最高權限登入</h1>
            <p className="text-xs text-slate-500 mt-2">登入後自動建立 12 小時最高權限 Token。</p>
          </div>

          {loginError ? (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
              {loginError}
            </div>
          ) : null}

          <form className="space-y-4 text-xs" onSubmit={login}>
            <div>
              <label htmlFor="admin-username" className="text-slate-400 block mb-1">帳號</label>
              <input id="admin-username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label htmlFor="admin-password" className="text-slate-400 block mb-1">密碼</label>
              <input id="admin-password" name="password" type="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500" />
            </div>
            <button type="submit" disabled={isLoggingIn} className="w-full py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all disabled:opacity-60">
              {isLoggingIn ? "驗證最高權限中..." : "登入核心控制台"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <Metric label="詢價筆數" value={String(summary.inquiries)} />
        <Metric label="報價筆數" value={String(summary.quotes)} muted />
        <Metric label="發布工作" value={String(summary.operationsJobs)} highlight />
        <Metric label="待發／已發" value={`${summary.operationsQueued}／${summary.operationsPublished}`} success />
      </div>

      <SettingsStatus health={health} error={healthError} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-base font-medium text-slate-200">發布工作狀態</h2>
            <button type="button" onClick={() => void logout()} className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-400 hover:border-red-500/60 hover:text-red-300 transition-all">登出</button>
          </div>
          {loadError ? <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">{loadError}</div> : null}
          {orders.length ? orders.map((order) => (
            <div key={order.order_id} className="p-4 rounded-xl border bg-slate-950 border-slate-800 mb-3">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-amber-400">{order.order_id}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">{order.order_status} 筆</span>
              </div>
            </div>
          )) : <div className="text-center py-12 text-xs text-slate-600 tracking-wide">目前沒有發布工作。</div>}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-base font-medium text-amber-400">當前團體營運與財務編輯器</h2>
          <div className="text-center py-12 text-xs text-slate-600 tracking-wide">請點擊左側單號，即可調出完整的營運編輯面板。</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">platform operations</p>
            <h2 className="text-base font-medium text-slate-200 mt-1">其他平台管理功能</h2>
            <p className="text-xs text-slate-500 mt-2">行程管理、即時訂單、會員明細、系統級推播。</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => window.location.assign("/admin/inquiries")} className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all">
              網站詢價
            </button>
            <button type="button" onClick={() => window.location.assign("/admin/quotes")} className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all">
              報價草稿
            </button>
            <button type="button" onClick={openOperations} className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all">
              營運發布
            </button>
            <button type="button" onClick={openContentSync} className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all">
              社群內容同步清單
            </button>
            <button type="button" onClick={openSocialDistribute} className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all">
              社群分發作業
            </button>
            <button type="button" onClick={openPlatformAdmin} className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all">
              開啟平台管理後台
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsStatus({ health, error }: { health: Record<string, HealthFeature> | null; error: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider">settings</p>
        <h2 className="text-base font-medium text-slate-200 mt-1">外部設定狀態</h2>
        <p className="text-xs text-slate-500 mt-2">只顯示名稱有沒有填。未填就是未設定，不會當成已可用。這裡不能送出、發文或開啟正式發布。</p>
      </div>
      {error ? <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">{error}</div> : null}
      {health ? Object.entries(health).map(([key, feature]) => {
        const skip = new Set([...(feature.optional || []), ...(feature.notUsed || []), ...(feature.emailOptional || [])]);
        const either = feature.lineEither || [];
        const eitherReady = either.some((name) => feature.env?.some((item) => item.name === name && item.set));
        const missing = (feature.env || []).filter((item) => !item.set && !skip.has(item.name) && !(either.includes(item.name) && eitherReady));
        const eitherMissing = either.length > 0 && !eitherReady;
        const ready = feature.ready ?? ((feature.line || feature.email) ? true : false);
        return (
          <div key={key} className="border border-slate-800 rounded-xl p-3">
            <p className="text-sm text-slate-200">{featureLabels[key] || key}：{ready ? "已設定" : "未完成"}{key === "scheduler" ? `；正式發布開關${feature.livePublish ? "已打開" : "未打開"}` : ""}{key === "inquiryNotify" ? `；LINE ${feature.line ? "已設定" : "未設定"}，Email ${feature.email ? "已設定" : "未設定"}` : ""}</p>
            {eitherMissing ? <p className="text-xs text-amber-300 mt-1">擇一即可：LINE_ADMIN_USER_ID 或 ADMIN_LINE_USER_ID</p> : null}
            {missing.filter((item) => !either.includes(item.name)).length ? <p className="text-xs text-amber-300 mt-1">未填：{missing.filter((item) => !either.includes(item.name)).map((item) => item.name).join("、")}</p> : null}
            {key === "imageUpload" ? <p className="text-xs text-slate-500 mt-1">可省略：R2_ENDPOINT。位址可由 R2_ACCOUNT_ID 組成。</p> : null}
            {key === "inquiryNotify" ? <p className="text-xs text-slate-500 mt-1">可省略：SMTP_PORT（預設 587）、INQUIRY_TO_EMAIL 與 INQUIRY_FROM_EMAIL（未填時用 SMTP_USER）。</p> : null}
            {feature.notUsed?.length ? <p className="text-xs text-slate-500 mt-1">不採用：{feature.notUsed.join("、")}。X 發文要用使用者授權的四組金鑰，不能用 app-only bearer。</p> : null}
            {key === "instagramLogin" ? <p className="text-xs text-slate-500 mt-1">帳號 token 在完成一次 Instagram 登入後寫入系統，不必另外貼進環境變數。</p> : null}
          </div>
        );
      }) : <p className="text-xs text-slate-600">尚未讀到設定狀態。</p>}
    </div>
  );
}

function Metric({ label, value, muted, highlight, success }: { label: string; value: string; muted?: boolean; highlight?: boolean; success?: boolean }) {
  return (
    <div className={highlight ? "border-l border-amber-500/20 pl-4 bg-gradient-to-r from-amber-500/5 to-transparent" : ""}>
      <p className={highlight ? "text-xs text-amber-400 uppercase tracking-wider" : "text-xs text-slate-400 uppercase tracking-wider"}>{label}</p>
      <p className={`text-2xl font-mono font-bold mt-1 ${highlight ? "text-amber-400" : success ? "text-emerald-400" : muted ? "text-slate-300" : "text-slate-100"}`}>{value}</p>
    </div>
  );
}
