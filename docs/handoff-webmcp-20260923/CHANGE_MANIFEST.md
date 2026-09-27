# CHANGE_MANIFEST.md

> fuyuntravel.com 本輪變更清單（2026-09-23）
> 範圍：WebMCP 報價工具 + TouristTrip JSON-LD + baseline repair

## 本輪 commit

### Commit A：`2b11bd9` — baseline repair + webmcp 模組
```
fix: generateSchema baseline + webmcp 模組（lib + 測試 script）
 8 files changed, 717 insertions(+)
 create mode 100644 lib/webmcp-quote-utils.d.ts
 create mode 100644 lib/webmcp-quote-utils.mjs
 create mode 100644 lib/webmcp-tool.d.ts
 create mode 100644 lib/webmcp-tool.mjs
 create mode 100644 scripts/browser-webmcp-verify.py
 create mode 100644 scripts/harness-webmcp.mjs
 create mode 100644 scripts/test-webmcp-quote.mjs
```

| 檔案 | 改動 |
|---|---|
| `lib/seo/generateSchema.ts` | +50 行：`touristTripSchema()` + `charterFaqPageSchema()`（/services, /itineraries/[id] 已 import；缺則 build fail） |
| `lib/webmcp-tool.{d.ts,mjs}` | WebMCP `get_quote` tool 定義 + `buildWebMCPTool()` + `runGetQuote()` |
| `lib/webmcp-quote-utils.{d.ts,mjs}` | 報價草稿純邏輯：欄位校驗 / LINE 深連結 / mailto |
| `scripts/harness-webmcp.mjs` | Node mock harness（23 assertions，agent-call path 模擬） |
| `scripts/test-webmcp-quote.mjs` | 單元測試 |
| `scripts/browser-webmcp-verify.py` | Playwright Chromium 端上驗證（本 host 無法執行，留作 prod 端工具） |

### Commit B：`3dd1eea` — 頁面接線
```
feat: 包車城市頁接 WebMCP 報價 + 行程頁 TouristTrip JSON-LD
 2 files changed, 19 insertions(+)
```

| 檔案 | diff |
|---|---|
| `app/charter-bus/[city]/page.tsx` | +4：import + render `<WebMCPQuoteTool />` |
| `app/itineraries/[id]/page.tsx` | +15：import `touristTripSchema` + `<script type="application/ld+json">` 注入 TouristTrip |

## 排除在 commit 之外的檔案
| 檔案 | 原因 |
|---|---|
| `.env.local` | gitignored，local-only，含 DATABASE_URL |
| `app/*.{page.tsx,layout.tsx}.bak_*` | 本輪 local 備份，不入 git |
| `lib/seo/generateSchema.ts.bak_*` | 同上 |
| `.codex/`、`.loopx/` | tool 目錄 |
| `*.tsbuildinfo` | 已 gitignore |

## 環境設定變更（非程式碼 commit）
| 設定 | 位置 | 值（類別） | 來源 |
|---|---|---|---|
| `DATABASE_URL` | `.env.local`（local） | `postgresql://local:5433/fuyun_ai_platform`（**本地**，0 筆） | local synthetic |
| `DATABASE_URL` | Vercel env（prod） | **Neon encrypted**（111d ago） | pre-existing |
| `DATABASE_URL` | process.env（local 驗收） | **Neon**（ep-proud-wildflower） | `/ai-worktrees/fuyun-content-sync/.env.production.local` |

> ⚠️ 正式 prod 用的 `DATABASE_URL` 是 Vercel secret 裡已存在的（非本輪設定），指向 Neon。
> local `.env.local` 只影響 local preview 和 local build，不帶入 Vercel。

## 未改但受影響的檔案
| 檔案 | 說明 |
|---|---|
| `components/WebMCPQuoteTool.tsx` | 已 committed（c0c4398），本輪無改動 |
| `app/services/page.tsx` | `charterFaqPageSchema` consumer；commit A 補上它依賴的 baseline |
| `lib/prisma/index.ts` | Prisma client singleton；無改動 |
| `prisma/schema.prisma` | `FeaturedSpot` model；無改動 |

## Build 對應關係
| 環境 | Node | BUILD_ID | 來源 |
|---|---|---|---|
| local 3211 preview | 18.19.1 (system) | `K1q4FT1LGpED7lj6NkKQT` | worktree build（9/23 00:39） |
| clean build 驗收 | 24.5.0 (arm64 isolated) | `knj9iozvL7mgN8Gbqs29S` | isolated clone of `3dd1eea` |
| **Vercel prod** | 24.x (Vercel runtime) | **iklolu4l1** | 同上 clean build 上傳 |

> fingerprint cross-check：prod 頁 HTML 引用的 chunk `2117-05a434b55f5c9945.js` 存在於 `clean build` 目錄 + 不存在於上一個 prod → **prod = 3dd1eea 的 build**（MATCH）

## 回滾點
```bash
# 若要回滾 prod 到上一個 Ready：
npx vercel redeploy https://fuyun-travel-6clm0uij2-arashiyun-s-projects.vercel.app --prod --yes
# git 層：
git revert 3dd1eea 2b11bd9  # 回兩筆
git push origin HEAD:main   # 觸發 Vercel git build（但有 Sharp/Node 坑，建議改 vercel redeploy）
```
