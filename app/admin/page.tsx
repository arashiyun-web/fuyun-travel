"use client";

import { FormEvent, useEffect, useState } from "react";

type Summary = {
  total_revenue: number;
  total_cost: number;
  total_net_profit: number;
  overall_profit_margin: number | string;
};

type Order = {
  order_id: string;
  order_status: string;
  revenue: number;
  total_cost: number;
  net_profit: number;
};

const initialSummary: Summary = {
  total_revenue: 0,
  total_cost: 0,
  total_net_profit: 0,
  overall_profit_margin: 0,
};

export default function AdminPage() {
  const [username, setUsername] = useState("arashiyun6866");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [orders, setOrders] = useState<Order[]>([]);

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
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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

  function logout() {
    localStorage.removeItem("admin_token");
    setToken("");
    setOrders([]);
    setSummary(initialSummary);
  }

  function openPlatformAdmin() {
    sessionStorage.setItem("travel-commerce-session-v1", "u-owner");
    window.location.href = "/platform/index.html?v=official-owner-login-v5#admin";
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
              <input id="admin-username" value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label htmlFor="admin-password" className="text-slate-400 block mb-1">密碼</label>
              <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500" />
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
        <Metric label="總營業額" value={`$${summary.total_revenue}`} />
        <Metric label="總營運成本" value={`$${summary.total_cost}`} muted />
        <Metric label="核心絕對淨利" value={`$${summary.total_net_profit}`} highlight />
        <Metric label="總毛利率" value={`${summary.overall_profit_margin}%`} success />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-base font-medium text-slate-200">全線訂單營運控制台</h2>
            <button type="button" onClick={logout} className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-400 hover:border-red-500/60 hover:text-red-300 transition-all">登出</button>
          </div>
          {loadError ? <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">{loadError}</div> : null}
          {orders.length ? orders.map((order) => (
            <div key={order.order_id} className="p-4 rounded-xl border bg-slate-950 border-slate-800 mb-3">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-amber-400">{order.order_id}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">{order.order_status}</span>
              </div>
            </div>
          )) : <div className="text-center py-12 text-xs text-slate-600 tracking-wide">目前尚無訂單資料。</div>}
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
          <button type="button" onClick={openPlatformAdmin} className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all">
            開啟平台管理後台
          </button>
        </div>
      </div>
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
