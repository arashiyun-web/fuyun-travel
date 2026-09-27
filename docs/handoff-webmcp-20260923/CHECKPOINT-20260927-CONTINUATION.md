# CHECKPOINT（接續）— 2026-09-27 六步續跑

> 前段（2026-09-23）見本目錄原 CHECKPOINT／CHANGE_MANIFEST／VALIDATION_REPORT。
> 本檔為 2026-09-27 串行執行的 Sharp 根因、build 重驗、IG 收斂、B/C 成果與 Vercel 狀態。

## 1) Sharp 根因（已定案，附證據）

### 失敗事實
- 本輪首次 build 嘗試：`next build` 於 `Collecting page data ... /api/social/generate` 階段
  拋 `SyntaxError: Unexpected token 'with'`（collect page data 階段載入 sharp dist ESM）。
- 元兇語法（grep 實證）：`sharp/dist/sharp.mjs:12  import pkg from '../package.json' with \{ type: 'json' \};`
  同含於 `sharp/dist/utility.mjs`、`sharp/dist/libvips.mjs`。
- 載入對照實驗（同 sharp 0.35.2 + @img/sharp-linux-arm64，僅換 Node）：
  - **Node 18.19.1（/usr/bin/node，本輪首次 build 實際使用）**：`LOAD FAIL: Unexpected token 'with'` → import 屬性（`with`）在 18.19 不支援。
  - **Node 24.5.0 arm64（/home/arashiyun/builddir/node24arm/）**：sharp 成功載入，versions 完整（vips 8.18.3、sharp 0.35.2、heif 1.23.0、webp 1.6.0）。

### 真實圖片轉檔驗證（Node 24.5.0）
- 64×64 raw → resize 32×32 → jpeg q80 → 回讀 metadata
- 結果：`REAL_RECODE_OK jpeg 32x32 269B`（產物：`/tmp/sharp-node24-out.jpg`，269 bytes）

### 上輪成功 vs 本輪重跑
| 項 | 上輪（VALIDATION_REPORT L79） | 本輪首次 | 本輪重跑 |
|---|---|---|---|
| Node | 24.5.0 arm64 isolated | **18.19.1**（PATH 指向不存在目錄→未生效） | 24.5.0 arm64 |
| build | EXIT=0 (knj9iozvL7mgN8Gbqs29S) | EXIT=1 `Unexpected token 'with'` | **EXIT=0 (Camy5ynQJ_1kJe71-KV69)** |

- 【實際】sharp 0.35.2 + Node ≥20.10 可正常載入與轉檔；Node 18.19.1 對 ES2025 import 屬性語法不支援是失敗的唯一差異變量（唯一變量法：同 lockfile、同 node_modules、同 Sharp 版本、僅 Node 主版本不同，結果不同）。
- 結論：**本地 build 必須用 Node ≥20.10**（align Vercel 雲上 runtime 或 24）；不改 Sharp 版本、不關圖——圖片功能本輪保持開啟且實測轉檔成功。

## 2) 建置結果（本輪）
- Node：24.5.0 arm64；工作樹：`fix/i18n-html-lang-20260926` @ `097f4eb`
- typecheck（tsc --noEmit）：**PASS**（补 `allowImportingTsExtensions` 後）
- `npx next build`：**EXIT=0**；BUILD_ID `Camy5ynQJ_1kJe71-KV69`
- 已編譯 route：`/api/social/instagram/oauth/{start,callback,revoke}`、`/api/social/publish`、`/api/social/generate` + 14 業務路由
- build 期間 `insta-diag` 自診輸出（預期 MISSING，非缺陷）：
  `INSTAGRAM_LOGIN_APP_ID/APP_SECRET/REDIRECT_URI/STATE_SECRET/TOKEN_ENCRYPTION_KEY=MISSING`、`TOKEN_STORE=PASS`
- tsconfig 修正 commit：`097f4eb`（+1L `allowImportingTsExtensions`，與候選分支 489372a 同因）

## 3) IG（D）收斂與測試
- 回收本輪平行實作（insta/、lib/instagram/、insta-endpoint-test.sh，與候選重疊且較薄）。
- cherry-pick 候選 `bf1b49c` → 本樹 `6c234d6`（9 檔 +1018L）：
  - 路由 `app/api/social/instagram/oauth/{start,callback,revoke}`
  - `lib/social/instagram-login-v2.ts`(182L)、`insta-diag.ts`(174L)、token-flow lib(307L)
  - `lib/adminAuth.ts` +54L（cookie 路徑：verifyAdminRequest/verifyAdminMutationRequest/adminCookieOptions）
  - 離線測試 2 檔（178L）+ `.env.social.example`
- 候選離線測試（Node 24.5.0，--experimental-strip-types，2026-09-27）：
  - login-v2：**10/10 PASS**（含「invalid/expired credentials never expose provider error text」「container PUBLISHED does not itself verify a public post」）
  - flow：**4/4 PASS**（state 綁 HttpOnly cookie 防篡改、authorization URL 只含公開參數、server-side 交換、token store 靜態加密/過期不返回）
- 負面案例（access_denied／400）：候選以 `InstagramV2Error` kind 分類 + `mayHaveSucceeded` + `automaticRetryAllowed=false` 處理；離線測試覆蓋。
- 【實際】本輪未向任何 env 檔寫入 IG token/密鑰；5 個 LOGIN_* MISSING 為預期。
- 尚缺（持有人）：Meta App 5 登入鍵 + App Review + Business 帳號；token store 跨 deployment 持久化（Vercel /tmp 易失→需 KV/Neon/S3，候選原狀未改）。

## 4) 4 篇標題對照（B）— 原文/來源/建議
來源＝production `https://fuyuntravel.com/highlights`（307→200，2026-09-27 實抓，h3 順序）
| # | 原文（production 實抓） | 異常點 | 來源 | 建議【推測，待 Owner 確認】 |
|---|---|---|---|---|
| 1 | 北埔冷泉·冷**気**泡腿放鬆行 | 「気」為日文漢字形，疑「氣」誤 | Neon DB（repo 無此字串，docs 僅上輪記錄） | 北埔冷泉·冷氣泡腿放鬆行 |
| 2 | 東山新**庐帅**布·宜蘇羅東一日 | 「庐」「帅」簡體 | 同上 | 東山新厝帅布？／新埔布？待 Owner 定 |
| 3 | 羅東林場·**辛巴**和服體驗 | 「辛巴」非標準地名 | 同上 | 疑「新巴」「辛姆」或店名，待 Owner 定 |
| 4 | **新竰换村博物館** | 「竰」「换村」亂碼 | 同上 | 疑「新港村博物館」／「換村」，待 Owner 定 |
5. 內洞、蝴蝶谷步道（正常）
6. 太平山晴懷古道健行（正常）
7. 內洞、蝴蝶谷步道出遊心得（正常）
8. 太平山見晴步道賞楓出遊心得（正常）
9. 太平山見晴懷古步道健行心得（正常）
10. 慈湖步道賞景（正常）
- 改動位置＝Neon `fuyun_platform.featured_spots`（/highlights 資料源 `getPublishedFeaturedSpots()`）；本輪未改 DB。
- 執行條件：Owner 給出 4 個正確標題（或逐條確認上列建議）→ 我改 DB + 重驗 production 頁面。

## 5) 密碼/密鑰輪換（C）— 已準備未執行
### 需輪換
1. 管理員（`lib/adminAuth.ts:3-4` 硬編碼）：ADMIN_USERNAME/ADMIN_PASSWORD（username=arashiyun6866；密碼 9 字元明碼，值見該檔，不列於本文）→ 影響 9 條 admin/social API 的登入與 Bearer token 簽發
2. `JWT_SECRET` fallback（15 字元明碼，值見 `lib/adminAuth.ts:8`，.env.local 未設→用 fallback）→ 所有 admin JWT 簽名
3. Neon DB 密碼（.env.local DATABASE_URL，fuyun_platform/****）
4. Vercel 帳號 session（`auth.json` token 已 invalidToken）
### 已準備的切換面
- 影響端點盤點完成（9 條 API + IG 登入三路由）
- 切換順序：改 username/password（fallback 保留可回滾）→ 驗證登入 → 再改 JWT_SECRET（先 Vercel env 新值部署、確認後撤舊）→ DB/Vercel 密鑰
- .env.example 補 ADMIN_USERNAME/ADMIN_PASSWORD 鍵
- 【實際】本輪未執行任何輪換（避免服務中斷），Owner 給新密碼/確認時我執行
## 6) Vercel（A）實測
- `~/.local/share/com.vercel.cli/auth.json`：token(vca_)/refreshToken(vcr_)/expiresAt=1790117496（2026-09-23，已過期 4 天）
- `vercel whoami`（CLI 60.1.3）→ Logged out
- 直接 API：`v2/user` → 空（session 失效）；`v6/deployments` → `invalidToken:true` 403
- 網路正常（api.vercel.com 0.45s 308）；`.vercel/repo.json` 僅本地綁定元資料
- 【實際】本地無可重放授權 → 正式部署需 Owner：`vercel logout`→`vercel login`（入口 https://vercel.com/login 或 vercel.com/oauth/device）
- Owner 登入後我接手：whoami 驗證 → env 補齊（5 LOGIN_* + 發布用 2 鍵）→ clean build（Node≥20.10）→ deploy prod → smoke 驗證 → 核對 deployment ID/網域
## 7) WebMCP（沿用 2026-09-23 證據，本輪未動該碼）
- Node harness 23/23；Chromium 149 真瀏覽器：getTools()=['get_quote']（/services）、首頁 tools=0；執行端在 LLM client（web 端不暴露 executeTool，架構正確）
- 手機 390×844 載入 OK；截圖：/tmp/webmcp-mobile-390.png（89KB）、/tmp/webmcp-browser-verify.png（161KB）
- 【實際】Android 實機 NOT_TESTED（需實體裝置）
## 8) 本輪 commit 堆疊（fix/i18n-html-lang-20260926）
- 097f4eb tsconfig allowImportingTsExtensions
- 6c234d6 IG 登入候選（cherry-pick bf1b49c）
- c42de2f i18n html lang
- 4f073a6 docs
- 上輪成功 build 基線：3dd1eea @ knj9iozvL7mgN8Gbqs29S
# 9) OVERALL
**PARTIAL**：Sharp 根因+build+typecheck+WebMCP 已驗；IG 程式+離線測試通過（14/14）；
未過：Vercel 授權（需 Owner 登入）、IG 真實鏈（需 Meta App/Review）、4 篇標題改 DB（需 Owner 定對）、密碼輪換（已準備未執行）、Android 實機。
正式站（iklolu4l1）保留未動；未用 dev/200 冒充 production build 通過。
