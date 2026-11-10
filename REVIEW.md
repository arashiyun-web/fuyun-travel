# 浮雲網站 Step 2 — 本地實作完成

狀態：**PASS（本地離線驗證）**。正式套用、部署與真實通知均未執行。

分支：`cursor/step2-charter-migration-inquiry-notify`，從 `f9806b6e03a8350e00b5dfa826a4c1aeb44a9c0c` 建立。啟動參數採操作端已核實的 SessionConfiguredEvent，完整欄位及本輪 session id 見 START-RECEIPT.json。上一輪誤判 FAIL 的七份交付檔完整旁置在 codex-attempt1-false-fail/，原提交仍保留於舊分支。

## 實作

- charter_orders 正式 migration：`prisma/migrations/202611080002_charter_orders/migration.sql`。CREATE TABLE / UNIQUE INDEX 均 IF NOT EXISTS；主鍵隨 CREATE TABLE 條件建立。只有新增，不修改其他表、欄位型別或資料。舊 pending SQL 留為純註解指標，沒有第二份可執行 SQL。
- F2：移除自由文本的路線及時數推測。必須由人員明選 `taipei-day-10h` 或 `taipei-jiufen-10h`，並輸入通過驗證的正整數時數；只有已核對的 10 小時、車型與可載人數才給基本車資。否定句、多點敘述及「10小時」文字本身不授權金額。沒有結構化核對資料的舊詢價維持 unknown/null，待人員補問或核對。
- F3：沿用 CharterQuote.quoteOptions，保存 `fleetFare: { version, rateId, hours, source }`；舊 object 的其他 key 保留，舊 array 保存為 legacyOptions。草稿產生、重讀、轉單及內部核價共用保存輸入；金額不從可編輯草稿文字讀取。pickup/destination/remark 快照改變會使保存核對失效，rate/hours 也納入訂單 fingerprint。後台報價頁提供無預選值的路線與時數控制項。
- 詢價通知：`INQUIRY_NOTIFY_ENABLED` 透過既有 exactTrue，只有精確 `true` 開啟，預設關閉。寫入前 fallback LINE、寫入後確認 LINE 與 Email 全部受控。Email 與 LINE 清單逗號分隔、去空白與重複值，每位收件人獨立 catch。LINE_ADMIN_USER_ID 缺少時保留 ADMIN_LINE_USER_ID 後備。缺通道設定或寄送失敗不影響詢價保存及成功回應；無 import-time throw。
- 保留原有兩階段 LINE 語意：成功詢價時，每位 LINE 收件人在「寫入前備援」及「已保存確認」各一次；每位 Email 收件人一次。測試逐階段核對每位收件人，沒有合併成一個逗號字串交給 LINE。
- 後台詢價沿用現有 status 欄位與 PATCH：新詢價／已報價／已確認／已取消。verifyAdminMutation 透過既有登入驗證及同源檢查保護寫入；測試覆蓋有效 bearer、有效同源 cookie、匿名及有效跨來源 cookie。
- 詢價通知日誌只含設定存在的布林，移除通知及此路由其他 catch 的原始例外內容，避免秘密隨例外寫入日誌。

沒有 Inquiry/CharterQuote schema 變更；未修改公開頁、CSS、LineButton、Footer、表單外觀、OPERATIONS_LIVE_PUBLISH_ENABLED 邏輯或 yun_erp。

## 驗證

- Node v22.22.3：`node scripts/test-step2-offline.mjs` → **141 tests，140 pass，0 fail，0 cancelled，1 skip**。完整 TAP：evidence/step2/offline-suite.txt。
- 唯一 skip 是原有 Instagram 選用資料庫測試，未提供其資料庫設定。
- 七個需 PostgreSQL／sudo／破壞式重建測試庫或 Windows PowerShell 的 integration/platform 檔案未執行；完整檔名與理由在 runner 及 TAP 首行。沒有宣稱它們通過。
- 新增 13 項業務／migration 測試。保留 RED 證據；mock nodemailer、pushLineText、Prisma persistence，實際執行 route、fare builder、轉單及登入驗證。未使用真實 SMTP、LINE API 或資料庫連線。
- Migration 在 PGlite 內嵌 PostgreSQL 執行兩次，確認既有資料、11 個欄位、主鍵與唯一索引保留；pending 指標為空操作。@electric-sql/pglite 0.5.16 僅 devDependency，不影響正式 runtime。
- Runner 僅傳遞允許的非秘密環境項目，封鎖 .env/.env.*/auth.json 讀取與外部 socket。測試中的通道／身分設定均為記憶體內的 synthetic fixtures。
- Prisma Client 用 /tmp 的 schema 副本產生，不載入專案秘密檔。`tsc --noEmit --incremental false` 通過。
- 變更範圍 ESLint：0 errors，1 項既有報價頁 useEffect dependencies warning；該 hook 在起始 HEAD 已存在，未擴大重構。
- `git diff --check` 通過（.gitattributes 僅將原始測試輸出的空白格式排除；原始日誌逐位元保留，程式與文件仍檢查）。未執行 Next build 或真人瀏覽器流程，不把型別／route 測試宣稱為瀏覽器端到端測試。
- 修正兩個既有離線測試問題：過時的 live-switch 原始字串斷言改由既有行為測試覆蓋；R2 hung-call 測試維持 caller 存活，避免 unref timer 造成測試取消。沒有更改 publishing 或 R2 正式程式。

## 獨立審查

requesting-code-review 的獨立 reviewer 已讀取原始檔與差異。發現有效 cookie 測試常數錯誤及既有 catch 洩漏原始錯誤日誌；前者補有效同源／跨來源對照，後者新增會失敗的資料庫例外測試後修正，整套重新通過。完整紀錄見 evidence/step2/independent-review.md。

## 正式套用（planned；本輪禁止執行）

經老闆批准正式操作後，建議由操作端對正式庫執行 `prisma migrate deploy`。本 SQL 是 IF NOT EXISTS，既有一致結構上重跑為空操作，然後 Prisma 寫入 _prisma_migrations。IF NOT EXISTS 不會自動校驗或修復不同的既有結構；本輪沒有連線確認正式 schema 或其他待套用歷史。

備用：若決定不重跑 SQL，必須先確認正式表的欄位、型別、null/default、主鍵與唯一索引已與本 migration 一致，再使用 `prisma migrate resolve --applied 202611080002_charter_orders` 只登記歷史。

還原不使用 DROP：此 migration 僅建表，回退應用程式碼至本次前版本；保留既有表與資料。指定備份分支：`backup-before-step2-20261111`（`br-winter-thunder-ao8y5adv`），這是任務提供資訊，本輪未連線重驗。

舊訂單若使用之前的 fingerprint 或沒有結構化核對資料，需要人員重新核對；本輪不自動重寫舊訂單或金額。

正式啟用通知仍屬 planned：由獲授權操作端確認兩位實際收件人與 SMTP/LINE 通道，再決定是否設定 INQUIRY_NOTIFY_ENABLED=true。本輪沒有讀取或更改正式變數，也沒有自行配置任何通道。

## 交付

本地 commit 完成後，根目錄 step2.patch 為起始 HEAD 至交付 commit 的 binary diff，git-log-1.txt 與 git-status.txt 為實際最終快照。這三個 commit 後產生的交付檔保留為 untracked，程式與證據已提交。未 merge、push、部署、連正式 Neon、送測試詢價、寄信或推播；未操作受保護程序。
