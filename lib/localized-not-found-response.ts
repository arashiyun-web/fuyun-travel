const NOT_FOUND_COPY = {
  "zh-Hant": {
    title: "找不到此頁面",
    description: "您要瀏覽的頁面不存在或已移動。",
    home: "回到首頁",
    inquiry: "聯絡我們",
    homePath: "/",
  },
  "zh-Hans": {
    title: "找不到此页面",
    description: "您要浏览的页面不存在或已移动。",
    home: "返回首页",
    inquiry: "联系我们",
    homePath: "/zh-cn",
  },
  en: {
    title: "Page not found",
    description: "The page you requested does not exist or has moved.",
    home: "Back to home",
    inquiry: "Contact us",
    homePath: "/en",
  },
  ja: {
    title: "ページが見つかりません",
    description: "お探しのページは存在しないか、移動した可能性があります。",
    home: "ホームへ戻る",
    inquiry: "お問い合わせ",
    homePath: "/ja",
  },
  ko: {
    title: "페이지를 찾을 수 없습니다",
    description: "요청하신 페이지가 없거나 이동되었습니다.",
    home: "홈으로 돌아가기",
    inquiry: "문의하기",
    homePath: "/ko",
  },
  ms: {
    title: "Halaman tidak dijumpai",
    description: "Halaman yang anda cari tidak wujud atau telah dipindahkan.",
    home: "Kembali ke laman utama",
    inquiry: "Hubungi kami",
    homePath: "/ms",
  },
  th: {
    title: "ไม่พบหน้านี้",
    description: "หน้าที่คุณต้องการไม่มีอยู่หรือถูกย้ายแล้ว",
    home: "กลับหน้าหลัก",
    inquiry: "ติดต่อเรา",
    homePath: "/th",
  },
  vi: {
    title: "Không tìm thấy trang",
    description: "Trang bạn yêu cầu không tồn tại hoặc đã được di chuyển.",
    home: "Về trang chủ",
    inquiry: "Liên hệ chúng tôi",
    homePath: "/vi",
  },
} as const;

export type NotFoundLocale = keyof typeof NOT_FOUND_COPY;

export function localizedNotFoundResponse(locale: NotFoundLocale): Response {
  const text = NOT_FOUND_COPY[locale];
  const html = `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,follow">
    <title>404 — ${text.title} | 浮雲輕鬆遊</title>
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{min-height:100vh;display:grid;place-items:center;padding:2rem}.card{width:min(44rem,100%);text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:1.5rem;padding:clamp(2rem,6vw,4rem);box-shadow:0 18px 50px rgba(15,23,42,.08)}
      .code{font-weight:700;letter-spacing:.2em;color:#64748b}h1{font-size:clamp(2rem,6vw,3rem);margin:.75rem 0 0}p{color:#475569;font-size:1.08rem;line-height:1.8}.actions{display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem;margin-top:2rem}a{border:1px solid #cbd5e1;border-radius:999px;padding:.8rem 1.4rem;color:#0f172a;text-decoration:none;font-weight:650}a.primary{background:#0f172a;color:#fff;border-color:#0f172a}
    </style>
  </head>
  <body>
    <main data-localized-not-found="${locale}">
      <section class="card">
        <div class="code">404</div>
        <h1>${text.title}</h1>
        <p>${text.description}</p>
        <div class="actions">
          <a class="primary" href="${text.homePath}">${text.home}</a>
          <a href="/contact/inquiry">${text.inquiry}</a>
        </div>
      </section>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
