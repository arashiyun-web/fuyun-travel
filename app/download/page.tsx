import type { Metadata } from "next";
import Link from "next/link";
import { LINE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "下載 App｜浮雲輕鬆遊",
  description: "將浮雲輕鬆遊安裝到 Android、iPhone 或 iPad 主畫面，台灣包車詢價一鍵搞定。",
  robots: { index: true, follow: true },
};

export default function DownloadPage() {
  return (
    <div className="page-inner" style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>下載浮雲輕鬆遊 App</h1>
      <p className="lead" style={{ marginBottom: "2rem" }}>
        安裝後開啟即是完整網站，無廣告、載入更快、支援離線瀏覽。
      </p>

      {/* Android PWA */}
      <section style={{ background: "var(--card)", borderRadius: 12, padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Android 安裝（加入主畫面）</h2>
        <ol style={{ paddingLeft: "1.2rem", lineHeight: 2 }}>
          <li>用 Chrome 開啟 <strong>fuyuntravel.com</strong></li>
          <li>點右上角選單（三個點）</li>
          <li>選「安裝應用程式」或「加到主畫面」</li>
          <li>確認安裝，主畫面即出現浮雲輕鬆遊圖示</li>
        </ol>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          ※ 不需下載 APK，也不需開啟未知來源安裝權限
        </p>
      </section>

      {/* iOS PWA */}
      <section style={{ background: "var(--card)", borderRadius: 12, padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>iPhone / iPad 安裝（加入主畫面）</h2>
        <ol style={{ paddingLeft: "1.2rem", lineHeight: 2 }}>
          <li>用 Safari 開啟 <strong>fuyuntravel.com</strong></li>
          <li>點底部分享按鈕（方形加箭頭）</li>
          <li>選「加入主畫面」→「新增」</li>
          <li>主畫面即出現浮雲輕鬆遊圖示，點擊即全螢幕開啟</li>
        </ol>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          ※ iOS 不支援 APK，請用上方步驟代替
        </p>
      </section>

      {/* CTA */}
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <p style={{ marginBottom: "1rem" }}>安裝完成？立即詢價！</p>
        <a
          href={LINE_URL || "https://line.me/R/ti/p/@fuyuntravel"}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            background: "#06C755",
            color: "#fff",
            padding: "0.75rem 2rem",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: "1.1rem",
            textDecoration: "none",
          }}
        >
          LINE 詢價
        </a>
        <p style={{ marginTop: "1rem" }}>
          <Link href="/">← 回首頁</Link>
        </p>
      </div>
    </div>
  );
}
