# CHECKPOINT.md

> 持久化交接紀錄：fuyuntravel.com 本輪網站／IG 施工／驗收／部署
> 更新時間：2026-09-23 06:15 CST

## 版本固定

| 欄位 | 值 |
|---|---|
| HOST | GX10-f6b2 (aarch64) |
| MODEL | qwen3.8:27b (custom provider, 262144 ctx) |
| REPO | /home/arashiyun/fuyun-travel |
| BRANCH | deploy/coach-42-20260915 |
| BASE (c0c4398) | 42人座大巴+FAQ + webmcp component + clean eslint fix |
| COMMIT_A (2b11bd9) | baseline repair (touristTripSchema/charterFaqPageSchema) + webmcp lib + 3 test scripts |
| **COMMIT_B (3dd1eea)** | **最終候選 = 頁面接線 WebMCP + TouristTrip JSON-LD** |
| CLEAN_BUILD_ID | knj9iozvL7mgN8Gbqs29S |
| LOCAL_PREVIEW_BUILD_ID | K1q4FT1LGpED7lj6NkKQT (worktree build, same source) |
| PROD_DEPLOY_ID | fuyun-travel-iklolu4l1 (Ready 1m, 2026-09-23) |
| ROLLBACK_TARGET | fuyun-travel-6clm0uij2 (previous Ready, 17h before this commit) |

## 完成項目

### /highlights 500 根因
- **根因**：缺有效 DATABASE_URL（Prisma featuredSpot.findMany 無連線目標，500）
- **修復**：local .env.local → 127.0.0.1:5433/db fuyun_ai_platform（0 筆 empty-state）；Neon 透過 process.env 注入
- **不涉 DB 目標變更**；只補 env，不改 schema 或資料

### Neon 真實內容驗證
- Neon 連線：ep-proud-wildflower-ao4d38ll-pooler.c-2.ap-southeast-1.aws.neon.tech（neondb）
- 10 筆 published 全讀到（Prisma findMany）
- 6 篇含 photoUrls（2-5 張）+ sourceUrl，4 篇無照片
- /highlights 頁面：10 h3、5 photo blocks、12 來源連結、0 簡體字、無 empty-state、inquiry entry ✓
- **PAGE_INTEGRATION = PASS**（非僅 DB 有數據，頁面實渲染 Neon 內容）

### WebMCP 執行驗證
- Node harness（scripts/harness-webmcp.mjs）：**23/23 PASS**（registerTool→getTools→execute→StrictMode 雙掛→缺欄→不存在日期→party 越界→未註冊 tool）
- Built page tokens：WebMCPQuoteTool / webmcp-quote-tool / get_quote 均存在於 charter-bus/[city]/page.js
- **Browser runtime**：NOT_TESTED（本 host 無 Chromium；prod 端可透過 Chromium 149 + flag `enable-webmcp-testing` 實測，見 scripts/browser-webmcp-verify.py）
- 安全特性：零金流、human-in-the-loop、draft-only LINE 深連結

### 功能回歸（local 3211 + prod 雙端）
| 項目 | Local 3211 | Prod (iklolu4l1) |
|---|---|---|
| / (home) | 200 | 200 |
| /services 42人座大巴 | ×1 | ×1 |
| /services FAQPage schema | ×1 | ×1 |
| /services Vehicle schema | ×1 | ×1 |
| /charter-bus/taipei WebMCP | ✓ | ✓ |
| /charter-bus/{all 6 cities} | 6×200 | 6×200 |
| /itineraries/1 TouristTrip | ×1 | ×1 |
| /itineraries/6 | 200 | 200 |
| /highlights 10 Neon articles | ✓ | ✓ |
| /highlights 5 photo blocks | ✓ | ✓ |
| /contact + /contact/inquiry | 200 | 200 |
| 簡體字檢查 (预/团/费/东) | 0 | — |
| Build fingerprint (2117-05a434b55f5c9945.js) | — | **MATCH** |

### 安全提交
- Commit A (2b11bd9)：8 files, +717 行（lib 5 + scripts 3）
- Commit B (3dd1eea)：2 files, +19 行（charter page +4, itineraries page +15）
- **COMMIT_SECRET_CHECK = PASS**
  - .env.local → gitignored (line 15 `.env*`)，未入 git
  - .bak 3 檔 → 未 commit（untracked，local 備份保留）
  - 5 個 webmcp 檔 secret scan → 全部 clean
  - .codex/、.loopx/ → 未 commit（tool 目錄）
  - .env（tracked）→ 只含 LINE_CHANNEL_ID/SECRET/TOKEN（已有，非本輪）

### 可重現乾淨建置
```
isolated clone → 3dd1eea
npm ci --no-audit --no-fund → 548 packages / 21s / EXIT=0
npx next build (Node 24.5.0 arm64) → EXIT=0
BUILD_ID = knj9iozvL7mgN8Gbqs29S
/highlights, /charter-bus/[city], /itineraries/[id] 全部 pre-render ✓
```

### 部署
- 路徑：`npx vercel deploy --prod --yes`（local build + Vercel upload，繞過 git-trigger build 0ms Sharp/Node 坑）
- 結果：**Ready in 1m**
- 別名：fuyuntravel.com + yunsun.com.tw
- **fingerprint MATCH**：prod 頁引用的 chunk `2117-05a434b55f5c9945.js` 存在於本輪 clean build → 確認線上跑的就是 3dd1eea 的 build

## 剩餘項目

### IG 串接
- 本候選 repo 含：app/api/social/{generate,publish}/route.ts + lib/social/{captionGenerator,imageResize,publishers}.ts
- Vercel env：INSTAGRAM_LOGIN_{APP_ID,APP_SECRET,STATE_SECRET,TOKEN_ENCRYPTION_KEY,REDIRECT_URI} 5 個 secret 已設定（17h ago）
- **缺口**：本候選 repo 無 IG OAuth 路徑（`/api/social/*/oauth/start` 等）→ 該功能來自上一輪 Windows dirty tree，未隨本輪 commit 進 repo
- **影響**：本輪部署不含 IG OAuth；IG publish 功能狀態待單獨驗收（需 platform credential + endpoint 對接）
- **標記**：IG = PARTIAL（infra 存在但本輪未完整驗證 end-to-end）

### Neon 內容品質
- 4 篇新文（新竰换村博物館 / 北埔冷泉·冷気泡腿放鬆行 / 東山新庐帅布·宜蘇羅東一日 / 羅東林場·辛巴和服體驗）標題含非標準字元
- **本輪範圍**：頁面渲染忠實反映 DB 內容，非渲染層錯誤
- **後續**：Owner 決定是否更新 Neon DB 標題（走 fuyun-site-publishing §4 DB 後路）

### BLOCKERS
| ID | 項目 | 阻擋誰 | 解除方式 |
|---|---|---|---|
| B1 | IG OAuth routes 不在本候選 commit | IG publish 完整功能 | 需要 Windows dirty tree 或重新開發（超出本輪範圍） |
| B2 | Neon 4 篇標題字元異常 | 內容品質 | Owner 確認 + DB 更新 |

## OWNER_ACTION
1. **Neon 標題確認**：4 篇含異常字元的標題是否正確？是→無動作；否→告知正確標題，分身民用 DB 後路更新
2. **IG 平台**：本輪未涉及 IG OAuth 開發；如要補，需另外開工單（涉及新 credential + 端點）
3. **無其他必做事項**：網站 14/14 routes 全 200，Neon 內容上線，WebMCP 已打包進 prod

## 檔案位置
```
CHECKPOINT.md          docs/handoff-webmcp-20260923/CHECKPOINT.md
CHANGE_MANIFEST.md     docs/handoff-webmcp-20260923/CHANGE_MANIFEST.md
VALIDATION_REPORT.md   docs/handoff-webmcp-20260923/VALIDATION_REPORT.md
```
