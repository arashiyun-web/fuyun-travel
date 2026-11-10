# 浮雲網站 Step 3 — 本地離線實作與驗證

狀態：completed（本地程式、離線驗證）；正式部署、供應商連線與 Telegram 啟用均為 planned，未執行。

分支：`cursor/step3-one-click-drafts-friday-remind`。起始 HEAD：`93867fa7fbbbabc920b69974dfc1f85641da836b`，與任務指定一致。啟動收據留在工作根 `START-RECEIPT.json`，本輪不檢查 sqlite／/proc 模型身分；啟動模型與 high 參數由操作端依 SessionConfiguredEvent 核對。這不是正式站／正式資料庫驗收。

## 一鍵草稿

在 `/admin/content-factory` 選擇一篇已發布的「這裡真好玩」，可預覽標題、說明及既有公開圖片，再點「一鍵生成各平台草稿」。新 GET `/api/content-factory/sources` 需既有 admin bearer 驗證，只查 `featured_spots.status=published`。選擇框列出全部已發布素材；沒有素材或載入失敗會顯示狀態，仍可使用既有行程簡述。

POST `/api/content-factory/generate` 接受 `featured_spot_id`；伺服器重新以 id＋published 查原資料，忽略客戶端夾帶的標題／說明／圖片。被撤下、未發布或不存在的素材為 404；格式錯誤／空素材為 400；讀取失敗為 503。來源 id 與實際素材快照存於現有 input_json，無新增欄位。

供應商優先序維持 Gemini → Anthropic → OpenAI（各自完整名稱對）；缺少設定由既有 CopywriterUnavailableError 回 503，沒有原文假生成或寫入。上游錯誤為 502；模型 JSON 經 nested validation／預設值正規化，缺主要平台內容或不合法集合型別一律 502、零寫入。不回傳／記錄原始供應商或資料庫例外。無價格時沿用既有 JSON-LD offers 移除邏輯。

保存使用現有 Prisma `contentDraft.create`，status 固定 draft；只有成功寫入後回傳 success 與非空 draftId。資料庫寫入失敗回 503。後台顯示該 id；既有 `/api/content-factory/save` GET 可讀回。output_json 保存 Facebook、Instagram、SEO／website 與其他既有渠道；X 沿用舊 operations 轉換的 Facebook 短文衍生方式（最多 280 字元），現在保存在 output_json.x 並提供後台分頁。

生成的終點統一為 content_drafts，包括手動簡述模式。原先的選用 operations 草稿轉換已移除，因此不會下載封面圖、不建立 operations job、核准或發布；這是本輪實作選擇，符合任務允許只存 content_drafts 的範圍。後續若要送 operations，仍需另外的人工核對流程。`OPERATIONS_LIVE_PUBLISH_ENABLED` 與發布引擎完全未修改。

編輯分頁只修改主文；儲存前將編輯值合併回結構化 output，FAQ、資訊表、hashtags、信件主旨及其他欄位保留；複製可含這些原有資訊。編輯會清除已保存提示，再另存一份 draft；沒有宣稱未保存編輯已落地。這裡仍沿用既有另存草稿 API，不做發布。

## 圖片

已發布素材沿用既有 HTTPS 圖片（含 Blob 網址），以及 `/images/` 下的站內素材；去重並以第一張為封面。排除 HTTP、data、協定相對、帶帳密及不安全站內路徑。不抓取遠端圖片；素材無可用圖時清楚提示，但可先存文字草稿。測試只證明 URL 保存，未對真實圖源做網路可達性檢查。

新圖上傳維持既有 fail-closed 路徑：缺 R2_PUBLIC_URL 回 503，訊息明列公開儲存待核並請先沿用素材圖片；後台會顯示上傳失敗，不再靜默跳過。本輪沒有新增 Blob 上傳實作、申請網域／帳號、設定 R2_PUBLIC_URL 或變更任何 Vercel 變數。若需新圖上傳，公開儲存路徑是待核項，沒有回傳不可公開取得的假成功網址。

## 週五提醒與歷史

新增 `/api/ops/friday-highlights-reminder`，GET／POST 沿用 process-due 的 `verifyOperationsWorkerRequest`，接受既有 CRON_SECRET／OPERATIONS_CRON_TOKEN 模式（也保留該 helper 的 admin mutation 驗證）；未授權 401。vercel.json 僅新增 `0 1 * * 5` UTC＝週五 09:00 Asia/Taipei，原 `process-due: 0 6 * * 2,4` 與 `weekly-pull: 0 4 * * *` 均保留。

FRIDAY_TELEGRAM_REMIND_ENABLED 只有精確字串 true 才可能發送；預設關。關閉時不讀取提醒通道；缺 TELEGRAM_BOT_TOKEN 或 TELEGRAM_BOSS_CHAT_ID 時回 200 `{sent:false,reason}`。收件人只接受單一正整數私人 user/chat id，拒絕負數群組／channel、@名稱、清單與其他格式。不使用 Hermes／分身民 bot，也不掃描或修改既有 bot 設定。

開關與通道齊備時只送「該整理小羽旅遊趣新貼文、送待審」，不查新貼文、不讀 Facebook、不改官網、不發社群。單次 fetch、10 秒 timeout；傳輸失敗、非 2xx 或 Telegram ok 不為 true 回 502、reason=delivery_failed，便於 cron 監看；不回傳上游本文、token、收件人或原始例外。本輪所有發送測試皆 mock，零真訊息。

歷史已用 repo 唯讀核對：2026-08-20 的 `2213009` 移除 weekly-pull，原排程為 `0 1 * * 1`（週一台北 09:00），不是週五 Telegram。commit 說明記載 Meta App 簡訊驗證卡關、社團無法用 Graph API 讀，改由老闆觸發 computer-use，避免無人值守打 Facebook API；任務將此稱為 PR #16（PR 編號依操作端提供，本輪未連 GitHub 核對）。`52fc1e1`（#47）重新加入每日 04:00 UTC weekly-pull，`20e41a1`（#48）將 process-due 改為週二四；均與本次 Telegram 提醒不同。

主機 crontab 空白、systemd timers 無此提醒，以及 Vercel 缺 TELEGRAM_*、preview／development 缺文案供應商名稱，均為操作端已做的查證，本輪不再次讀取正式設定或主機服務。正式有 ANTHROPIC_API_KEY／AI_MODEL_NAME 的名稱不表示本輪已驗證其值或可用性。

## 驗證與審查

Node v22.22.3（主機預設 v18 不支援 strip-types，改用既有 v22，未修改系統設定）。`node scripts/test-step2-offline.mjs` 自動包含本次三個 step3 測試檔；最終 **160 tests / 159 pass / 0 fail / 0 cancelled / 1 skip**。新增 19 項，包含 PGlite 實際 INSERT 與依 draftId SELECT、各平台欄位及圖片、既有 save GET 讀回、缺供應商／錯誤模型／持久化失敗零假成功、主文編輯序列化、上傳待核、cron 授權與 mock 提醒。

唯一 skip 是原有 Instagram 選用資料庫測試。七個原有 integration/platform 檔因 PostgreSQL／sudo／破壞式測試庫重建／Windows PowerShell 依賴未跑：admin-session-flow、member-order-publish、line-group-relay、line-webhook-claim、line-webhook-offline、operations-intake-cleanup、tools/vercel-ascii；沒有宣稱通過。完整名稱／理由在 runner 與原始 TAP 首行。

Prisma persistence 邊界接至測試內 PGlite，表結構依現有 ContentDraft schema 建立；不宣稱此測試是 Prisma 到 Neon 的真連線或正式 migration 驗證。文案供應商與 Telegram 均 mock，guard 拒絕秘密檔讀取與外部 socket；runner 的子程序環境採非秘密 allowlist。Prisma Client 從 /tmp schema 副本產生，無連線、無環境秘密檔。首次依賴／cache 問題留原始紀錄，使用 /tmp cache 與 arm64 sharp 選用依賴解決；package.json／lock 未因此改動。

`tsc --noEmit --incremental false` 通過；變更 TS/TSX 範圍 ESLint 0 errors／0 warnings。git diff --check 與凍結範圍檢查通過。未執行 Next build、真人瀏覽器或正式 LLM／Telegram E2E；驗證範圍是後台程式的型別／lint、真實 route → mock provider → 內嵌 SQL → readback，及編輯 helper 行為。

使用 requesting-code-review 的獨立 reviewer 提出三項 Important：X 遺失、編輯結果未保存、模型巢狀型別會使畫面崩潰；皆先保留 RED、再修正 GREEN 並全套回歸。沒有 Critical 或待修 Minor。修後由作者以測試驗證，未宣稱 reviewer 再審。證據留在 evidence/step3/（不納入提交的大量日誌），test-summary.txt 與 review-result.json 列最終結果。

## Schema、邊界與回滾

新增 migration／CREATE TABLE／ADD COLUMN：**無**。未改 schema.prisma、yun_erp、正式 Neon 或任何資料庫分支；PGlite 建表只存在測試記憶體。未改公開頁 UI/CSS、highlights、LineButton、Footer、sitemap、layout/page/site SEO、hreflang／alternates、詢價通知、SMTP 或受保護程序；未改正式環境或發布開關。未 merge、push、部署。

Rollback 為回退本次應用程式 commit 或讓應用程式採起始 HEAD，保留 content_drafts 現有表與所有草稿；只撤新增 cron，不變更既有兩條排程。沒有 DROP、資料清除、Neon 分支刪除或秘密復原步驟。本輪不執行 rollback。

## 待核下一步（planned）

1. 由操作端審查本分支與 step3.patch；正式部署另經核准。
2. preview／本地沒有供應商名稱時預期 503；若要真生成，須另經核准配置供應商並做測試，本輪不設定或讀值。
3. 提醒預設維持關閉。老闆先向擬用 bot 私訊，再自行從 Telegram 介面／@userinfobot 確認本人的正整數 user id；僅把該值透過核准管道設為 TELEGRAM_BOSS_CHAT_ID，配合核准 bot 的 TELEGRAM_BOT_TOKEN。程式／報告不讀出、不打印正式值，也不把 Hermes bot 當此通道。確認本人收件人與明確批准後，才由操作端設定總開關。本輪不發測試訊。
4. 若要上傳新圖，另核准可公開的儲存路徑；目前可以既有公開素材完整走一鍵草稿流程，不因這個待核項停住。

本工作根保留，程式／測試／必要文件有本地 commit；START-RECEIPT、review-result、原始 Evidence 與 step3.patch 等過程／交付檔留本地，git-log-1.txt 與 git-status.txt 是提交後快照。舊 Step2 根目錄報告已旁置 evidence/step3/prior-step2/，歷史提交仍保留。
