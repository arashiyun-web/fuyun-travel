# 雲驛旅行社・雲陞通運一頁式網站

台灣包車旅遊一頁式網站，使用 Next.js + Tailwind CSS，可部署到 Vercel。

## 專案結構

```txt
.
├─ app/
│  ├─ api/inquiry/route.ts      # 詢價表單寄信 API
│  ├─ globals.css               # Tailwind 與全域樣式
│  ├─ layout.tsx                # SEO metadata
│  └─ page.tsx                  # 一頁式首頁
├─ components/
│  └─ InquiryForm.tsx           # 前端詢價表單
├─ .env.example                 # 環境變數範本
├─ package.json
├─ tailwind.config.ts
├─ postcss.config.mjs
├─ next.config.mjs
└─ tsconfig.json
```

## 本機執行

```bash
npm install
npm run dev
```

開啟：

```txt
http://localhost:3000
```

## Email 表單設定

複製 `.env.example` 成 `.env.local`：

```bash
cp .env.example .env.local
```

設定 SMTP：

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
INQUIRY_TO_EMAIL=your-email@gmail.com
INQUIRY_FROM_EMAIL=your-email@gmail.com
NEXT_PUBLIC_LINE_URL=https://line.me/R/ti/p/@yourlineid
NEXT_PUBLIC_PHONE=0906528185
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

Gmail 需使用「應用程式密碼」，不能直接使用一般登入密碼。

## Vercel 部署教學

1. 將專案推到 GitHub。
2. 登入 [Vercel](https://vercel.com)。
3. 點選 `Add New Project`。
4. 選擇這個 GitHub repository。
5. Framework Preset 選 `Next.js`。
6. 在 `Environment Variables` 加入：
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `INQUIRY_TO_EMAIL`
   - `INQUIRY_FROM_EMAIL`
   - `NEXT_PUBLIC_LINE_URL`
   - `NEXT_PUBLIC_PHONE`
   - `NEXT_PUBLIC_SITE_URL`
7. 點選 `Deploy`。

## 上線前要改的資料

- `NEXT_PUBLIC_LINE_URL`：改成官方 LINE 連結
- `NEXT_PUBLIC_PHONE`：改成正式客服電話
- `NEXT_PUBLIC_SITE_URL`：改成正式網址
- `app/layout.tsx`：可依正式品牌與關鍵字微調 SEO
- `app/page.tsx`：可加入公司地址、統編、實際車型照片
