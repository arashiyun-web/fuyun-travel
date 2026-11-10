# 浮雲旅行社網站 第 2 步（續作：立即實作＋本地測試）

上一輪 session `01a1c78e-2447-73b2-9a8b-495ee9dcb1be` 因在沙盒內找不到 model 中繼資料而誤判 FAIL、未改程式。那是檢核方式問題，不是模型不符。

## 啟動檢核已由操作端完成（不要再停工）

操作端從本機 `/tmp/fuyun-step2-codex-out/codex.err` 的 `SessionConfiguredEvent` 已核實上一輪與本輪啟動參數。本輪你必須：
1. 把下列已核實欄位原樣寫入工作根 `START-RECEIPT.json`（補上你本輪新的 session id）。
2. **立即開始實作**，不得再以「工作根／sqlite／/proc 看不到 model」為由 FAIL 停工。
3. 不得把上一輪誤判的 FAIL 檔當最終交付；將它們旁置到 `codex-attempt1-false-fail/`（不准刪檔）。

已核實（SessionConfiguredEvent，2026-11-11 06:22:24 Asia/Taipei / 2026-11-10T22:22:24.517358Z）：
- model: "gpt-6.1-sol"
- model_provider_id: "openai"
- reasoning_effort: High
- approval_policy: OnRequest
- approvals_reviewer: AutoReview
- sandbox: workspace-write
- ephemeral: true
- cwd / work_root: /home/arashiyun/codex-work/fuyun-step2-20261111-20261111-061920
- starting HEAD: f9806b6e03a8350e00b5dfa826a4c1aeb44a9c0c

本輪啟動必須同樣是 `codex exec -m gpt-6.1-sol -c model_reasoning_effort="high" --json --ephemeral -s workspace-write`。若你在本輪行程命令列能看到 `-m gpt-6.1-sol` 與 `model_reasoning_effort=high`，即可視為通過。

## 硬紅線（違反即 FAIL）
- 不准合併 main、不准 git push 到 main、不准操作正式站。
- 不准連線或寫入正式 Neon 分支 br-morning-sun-ao8kxf1n / 正式 neondb。不准 prisma migrate deploy 打到正式庫。
- 不准在 fuyuntravel.com 送測試詢價。
- 不准讀取、列印、寫入任何秘密：.env、.env.*、auth.json、token、密碼原文、SMTP_PASS、LINE token、DATABASE_URL 連線字串。測試用 mock。不准自己設定 SMTP_*、INQUIRY_TO/FROM_EMAIL、LINE_ADMIN_USER_ID。
- 不准改 Vercel 環境變數。不准刪檔（要改就新增或旁置）。不准刪 Neon 分支。
- 前台視覺凍結：不准改公開頁 UI/CSS/顏色/字體/排版/hero/LOGO、不准改 components/LineButton.tsx / Footer.tsx 的公開樣式與文案邏輯。詢價表單外觀不變。通知與狀態只走後端與 /admin。
- 不准碰 ollama、hermes、ChatGPT desktop、codex app-server PID 8848 / 119833。
- OPERATIONS_LIVE_PUBLISH_ENABLED 維持現況邏輯，不准改成預設開啟。不准真的對外發社群/LINE（測試必須 mock）。

## 背景
- origin/main HEAD：f9806b6e03a8350e00b5dfa826a4c1aeb44a9c0c。
- 正式 neondb 已有表 line_users、charter_orders、content_drafts。_prisma_migrations 只有 202611080001_add_line_users，沒有 202611080002。
- prisma/pending/202611080002_charter_orders.sql 仍在 main。
- 從此 main 開新分支：`cursor/step2-charter-migration-inquiry-notify`。

## 1) charter_orders 正式 migration（只新增、冪等）
把 prisma/pending/202611080002_charter_orders.sql 移成：
`prisma/migrations/202611080002_charter_orders/migration.sql`

正式庫已有該表，SQL 必須冪等：
- CREATE TABLE IF NOT EXISTS
- 索引/約束用 IF NOT EXISTS（或等效、可重跑不報錯）
- 只新增，不准 DROP、不准改既有欄位型別、不准改别的表

pending 目錄留下簡短說明，指出已正式化，不要讓人再跑一份不同內容的 SQL。

在 REVIEW.md 寫清正式套用方式（本輪不要套正式）：
- 建議：正式庫 `prisma migrate deploy`。SQL 是 IF NOT EXISTS，重跑只是空操作，然後寫入 _prisma_migrations。
- 備用：若選擇不重跑 SQL，可用 `prisma migrate resolve --applied 202611080002_charter_orders` 只登記歷史；必須先確認正式表結構已與 migration 一致。
- 還原：此 migration 只建表，還原不是 DROP；回退應用程式碼。備份分支 backup-before-step2-20261111（id br-winter-thunder-ao8y5adv）。

不要連正式庫。不必在本機硬連 Neon。

## 2) 修後台草稿 F2、F3

F2（lib/fleetQuoteDraft.ts）：
matchedRoute / statedHours 仍會從自由文本「推測」路線與時數。例如「先到市區再去機場、不是 10 小時」這類多點或否定句，仍可能排出 amountTwd=7000，與「只套用已核對的路線與 10 小時」不一致。
修法：自由文本不足以唯一對到已核對價目時，amountTwd 必須維持 unknown / null，待補問。不要用否定詞黑名單或 includes 猜測當權威。需要明確的已核對路線（或明確選到的 rate id）以及已核對/已輸入且通過驗證的時數，才能給金額。
回歸測試至少兩筆會失敗的否定案例，外加一筆正常 10 小時單點案例仍應給出正確金額。

F3（app/api/admin/quotes/[id]/draft/route.ts 與後續轉單）：
POST /api/admin/quotes/:id/draft 接受 `{ hours: 10 }`，但這份時數沒有寫回已存草稿/報價欄位。之後 convertConfirmedQuote 會從報價重算，可能得到 409「沒有可沿用的基本車資」。小時覆寫必須經既有欄位保存，或拿掉這個 API 參數，讓 draft → 重讀 → 轉訂單用同一組輸入。
不要把可編輯的草稿說明文字當金額權威。
補測試：draft → reread → convertConfirmedQuote 金額一致。

最小修正、加測試。不要重寫整個報價引擎。不要改前台公開頁。

## 3) 詢價通知 + 後台清單狀態

現況：
- app/api/inquiry/route.ts：POST 會先 notifyInquiryFallback（LINE），再 prisma.inquiry.create，再 LINE + sendNotificationEmail。缺變數時已有 skipped log，不可改成丟例外。
- Inquiry.status 已是 String @default("New")，API 已有 New | Quoted | Confirmed | Cancelled。優先沿用現有欄位，後台顯示中文「新詢價 / 已報價 / 已確認 / 已取消」。盡量不要 ALTER inquiries。若必須加欄位，只能 ADD COLUMN 且帶預設值，寫成 prisma migration 並標明；本輪不要對正式庫執行。
- app/admin/inquiries/page.tsx 已有清單，但沒顯示/切換四種狀態。請補上（僅後台）。切換必須驗證登入（verifyAdminRequest），不准在程式裡讀密碼原文。

通知需求：
- 新增總開關 `INQUIRY_NOTIFY_ENABLED`，語意與 lib/liveSwitch.ts 的 exactTrue 相同：只有 exactTrue 允許的唯一真值才開啟。預設關。
- **所有**詢價通知都必須受此開關約束：create 前 fallback LINE、create 後 LINE、Email。開關關閉時即使 SMTP_* / LINE_* 都在，也不得發送。
- 開關關閉或缺變數：不報錯、HTTP 成功、詢價照存。通知失敗也不得讓表單失敗。
- 收件人是老闆與小羽兩人。`INQUIRY_TO_EMAIL` 與 `LINE_ADMIN_USER_ID`（及後備 `ADMIN_LINE_USER_ID`）支援逗號分隔多位。不要新增必填的新秘密變數。
- 缺 SMTP 或 LINE 通道時 skip、不丟例外。不准在 import 時因缺變數 throw。
- 測試必須 mock nodemailer / pushLineText。禁止真實 SMTP、禁止打 LINE API、禁止真實 token。案例至少：
  1. 開關關閉 + 變數齊全 → 0 次寄信、0 次 LINE，詢價仍成功。
  2. 開關開啟 + 變數全缺 → 不丟例外，詢價仍成功。
  3. 開關開啟 + mock 通道 + 兩個 email、兩個 LINE id → 每位收件都被呼叫一次。
  4. 後台狀態更新：New→Quoted→Confirmed 與 Cancelled。
- 日誌只記錄布林「有沒有設」，不准記錄秘密值。

不要動 yun_erp。不要改公開視覺。

## 4) 測試與交付
- 跑既有離線測試並補上本次測試，全部要過。不要連正式 DB。
- 把結果寫入 test-summary.txt。另交 REVIEW.md、review-result.json。
- git commit 在本工作根（不要 push main）。留下 `step2.patch` 與 `git log -1`、`git status`。
