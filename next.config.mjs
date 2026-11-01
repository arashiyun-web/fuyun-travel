/** @type {import('next').NextConfig} */
const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/platform", headers: noindex },
      { source: "/platform/:path*", headers: noindex },
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
    ];
  },
};

export default nextConfig;
