# VALIDATION_REPORT.md

> fuyuntravel.com 本輪驗收報告（2026-09-23）
> 候選版本：commit `3dd1eea` ｜ clean build `knj9iozvL7mgN8Gbqs29S` ｜ prod `iklolu4l1`

## 驗證方法
- **local preview**：`npx next start -H 127.0.0.1 -p 3211`，`DATABASE_URL` 指向 Neon（真實內容）
- **webmcp runtime**：`node scripts/harness-webmcp.mjs`（mock WebMCP API 表面，真跑 lib 邏輯）
- **Neon 唯讀**：Prisma `findMany / count`（唯讀，不寫、不遷移、不 seed）
- **可重現 build**：isolated `git clone --local` @ `3dd1eea` + Node 24.5.0 arm64 + `npm ci` + `next build`
- **prod**：`vercel deploy --prod` + `curl` fuyuntravel.com 全路由 + fingerprint 比對

---

## 1. 路由回歸（14 條）
| 路由 | Local 3211 | Prod |
|---|---|---|
| `/` | 200 | 200 |
| `/services` | 200 | 200 |
| `/highlights` | 200 | 200 |
| `/contact` | 200 | 200 |
| `/contact/inquiry` | 200 | 200 |
| `/charter-bus/taipei` | 200 | 200 |
| `/charter-bus/taoyuan` | 200 | 200 |
| `/charter-bus/taichung` | 200 | 200 |
| `/charter-bus/tainan` | 200 | 200 |
| `/charter-bus/kaohsiung` | 200 | 200 |
| `/charter-bus/hsinchu` | 200 | 200 |
| `/charter-bus/new-taipei` | 200 | 200 |
| `/itineraries/1` | 200 | 200 |
| `/itineraries/6` | 200 | 200 |

**ROUTE_REGRESSION = PASS**（14/14）

## 2. /highlights 500 根因
- **HIGHLIGHTS_500_CAUSE = 已證實**：缺有效 `DATABASE_URL`（Prisma 無連線目標 → handler 拋錯 → 500）
- 修復＝補 env，**未改 schema、未換 DB 目標、未動 force-dynamic**
- 本地 empty-state（`127.0.0.1:5433`, 0 筆）渲染「準備中」；Neon（10 篇）渲染真實列表 → 兩條路徑都過
- **HIGHLIGHTS_EMPTY_STATE = PASS（雙路徑驗收）**
- 舊 500 log：未保留原始 stack trace，根因以「DB 連線」復現+修復證實；未補造 stack

## 3. Neon 真實內容
- **NEON_CONTENT = PASS**
- 連線目標類別：Neon pooler（`-pooler`）→ 唯讀讀回；host `ep-proud-wildflower-...ap-southeast-1.aws.neon.tech`，db `neondb`
- `featuredSpot`：total 10 / published 10
- 有照片文章：`cmt2ayy*(6 篇，photoUrls 2-5 張)` + sourceUrl
- 頁面整合（local + prod 一致）：**10 標題、5 照片區塊、來源連結、0 簡體字** → 非僅 DB 有數據
- **PAGE_INTEGRATION = PASS**（標題/照片/連結/內容/inquiry 入口全數實渲染）

## 4. WebMCP
- **WEBMCP_RUNTIME = PASS（Node 層）/ NOT_TESTED（Chromium 端）**
- Node harness：`PASS: 23  FAIL: 0`（registerTool / getTools / executeTool / StrictMode 雙掛 / 缺欄 / 不存在日期 / party 越界 / 未註冊 tool 拋錯）
- built page 含 `WebMCPQuoteTool + webmcp-quote-tool + get_quote` tokens（local + prod）
- **限制**：本 host 無 Chromium，`navigator.modelContext` 真端上註冊未在本機實跑；`scripts/browser-webmcp-verify.py` 留作支援環境執行（影響範圍＝agentic 瀏覽器端註冊路徑，本輪以「打包存在 + 邏輯全綠」收口）
- 未用 stub/假註冊製造 PASS，未杜撰 API

## 5. UI / JSON-LD
- **UI / JSON_LD = PASS**
- `/services`：`42 人座大巴` ×1、`FAQPage` ×1、`Vehicle` ×1（local + prod）
- `/charter-bus/taipei`：webmcp 組件 markers 存在
- `/itineraries/1`：`TouristTrip` JSON-LD ×1（local + prod）
- 簡體字腐蝕（`预/团/费/东`）：**0**（/highlights）
- 手機寬度：版面為響應式 Tailwind，本輪無專屬手機斷點改動；**Android 實機 = NOT_TESTED**（無實機/無 Chromium），與手模擬分開記錄

## 6. Website / IG
- **WEBSITE = DEPLOYED_VERIFIED**
- **IG = PARTIAL**
  - repo 含 `app/api/social/{generate,publish}` + `lib/social/{captionGenerator,imageResize,publishers}.ts`
  - Vercel 已有 5 個 `INSTAGRAM_LOGIN_*` secret（17h ago）
  - **缺口**：IG OAuth 端點不在本候選 commit（來自上一輪 Windows dirty tree）→ IG publish 完整鏈未在本輪驗收
  - 網站 12（14）個 200 **不等於** IG 串接/發布成功 —— 已分開判定

## 7. 提交 / 建置
- **COMMIT_SECRET_CHECK = PASS**
  - `.env.local` gitignored（規則 `.env*`），未入 git；`.env`（tracked）僅 LINE_*（非本輪新增）
  - 5 個 webmcp 檔 + 3 script secret scan → 全 clean；`.bak/.codex/.loopx` 未 commit
- **TYPECHECK / CLEAN_BUILD = PASS**
  - `npm ci` 548 pkgs / 21s / EXIT=0
  - `next build`（Node 24.5.0 arm64 isolated clone @ `3dd1eea`）EXIT=0
  - BUILD_ID `knj9iozvL7mgN8Gbqs29S`；`/highlights`、`/charter-bus/[city]`、`/itineraries/[id]` 均 pre-render

## 8. 部署 / 回滾
- **PRODUCTION = DEPLOYED_VERIFIED**
  - `vercel deploy --prod` → `fuyun-travel-iklolu4l1` → **Ready 1m** → alias `fuyuntravel.com` + `yunsun.com.tw`
  - **fingerprint MATCH**：prod 引用 chunk `2117-05a434b55f5c9945.js` 存在於本輪 clean build → 線上＝`3dd1eea` build
  - 部署後 /highlights 仍 10 篇 + 照片 + 來源連結 + inquiry 入口 ✓
- **ROLLBACK_TARGET = fuyun-travel-6clm0uij2**（上一個 Ready）
  - 回滾：`npx vercel redeploy https://fuyun-travel-6clm0uij2-arashiyun-s-projects.vercel.app --prod --yes`

---

## 最終判定
| 項 | 判定 |
|---|---|
| ROUTE_REGRESSION (14) | PASS |
| HIGHLIGHTS_500_CAUSE | 已證實（缺 DATABASE_URL） |
| HIGHLIGHTS_EMPTY_STATE | PASS |
| NEON_CONTENT / PAGE_INTEGRATION | PASS |
| WEBMCP_RUNTIME | PASS（Node）/ NOT_TESTED（Chromium 端） |
| UI / JSON_LD | PASS |
| WEBSITE | DEPLOYED_VERIFIED |
| IG | PARTIAL（OAuth 端點不在本輪 commit） |
| COMMIT_SECRET_CHECK | PASS |
| TYPECHECK / CLEAN_BUILD | PASS |
| PRODUCTION | DEPLOYED_VERIFIED |
| **OVERALL** | **PASS（本輪網站範圍）；IG 列為 PARTIAL 外部缺口** |
