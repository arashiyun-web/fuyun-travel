/** @type {import('next').NextConfig} */
const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

// /service/* 與 /services/* 內容重複：/services/* 為正本，舊 /service/* 一律 301 到對應正本（AEO 2026-11-13）。
// 對應：bus-charter→coach-charter、nine-seater→van-charter、corporate-trip→business-charter、day-tour→custom-tour。
const serviceRedirects = [
  ["/service", "/services"],
  ["/service/price", "/services/price"],
  ["/service/bus-charter", "/services/coach-charter"],
  ["/service/nine-seater", "/services/van-charter"],
  ["/service/school-trip", "/services/school-trip"],
  ["/service/corporate-trip", "/services/business-charter"],
  ["/service/airport-transfer", "/services/airport-transfer"],
  ["/service/day-tour", "/services/custom-tour"],
].map(([source, destination]) => ({ source, destination, statusCode: 301 }));

const nextConfig = {
  reactStrictMode: true,
  // 舊示範平台已關閉：暫時轉址（302）回首頁，public/platform/ 檔案保留以便還原。
  async redirects() {
    return [
      ...serviceRedirects,
      { source: "/service/:path*", destination: "/services", statusCode: 301 },
      { source: "/platform", destination: "/", statusCode: 302 },
      { source: "/platform/:path*", destination: "/", statusCode: 302 },
    ];
  },
  async headers() {
    return [
      { source: "/platform", headers: noindex },
      { source: "/platform/:path*", headers: noindex },
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/ai-test", headers: noindex },
      { source: "/ai-test/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
