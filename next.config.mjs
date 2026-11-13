/** @type {import('next').NextConfig} */
const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig = {
  reactStrictMode: true,
  // 舊示範平台已關閉：暫時轉址（302）回首頁，public/platform/ 檔案保留以便還原。
  async redirects() {
    return [
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
