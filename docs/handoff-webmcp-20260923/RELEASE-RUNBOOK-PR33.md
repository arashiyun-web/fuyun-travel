# PR #33 正式發版清單（準備完成，尚未套用）

適用：feat/ops-worker-integration-20260927 通過有效審查之後。本文件只列順序、設定、驗收與回復；撰寫時沒有套用任何正式變更。
依據：checkpoint §13.3（升級演練）、§13.6（輪換）、§13.7（原始次序）、§14–§15（Preview 驗證）。

## 0. 前置條件（全部滿足才開始）
- PR #33 取得符合分支規則的 reviewer approval。不使用管理員例外、不改分支保護、不 force-push。
- 核准的完整 SHA 記為 `APPROVED_SHA`。之後若有新提交，本清單從頭重跑。
- 唯讀預檢：
  `powershell -NoProfile -File scripts\tools\vercel-ascii.ps1 --exec node scripts/ops/release-preflight-pr33.mjs --bucket fuyun-ops-production`
  - **全部項目 PASS 才可進入第 4 步（輪換）與第 5 步（合併），沒有可略過的項目。**
  - 「GX10／Hermes 呼叫端已確認」是阻擋項（BLOCKING）；未確認時 `rotate-admin-access-token.mjs apply` 也會拒絕（exit 3）。
- 發版窗口內不啟用 worker，真實發布維持關閉。

## 1. 正式 DB 備份（可恢復證據）
1. `node %USERPROFILE%\.fuyun-tools\neon-backup.cjs %USERPROFILE%\.fuyun-tools\pgsql-17\pgsql\bin <FuyunBackups\YYYYMMDD-neon-prod>`
2. 在同一目錄產生 SHA256SUMS（`Get-FileHash -Algorithm SHA256`，格式 `<hash>  <file>`）；目錄 ACL 限 SYSTEM＋Administrator。
3. 可恢復證據：`pg_restore --list <dump>` 成功，且表數與 §11.5 一致。完整還原演練沿用 §11.5／§13.3 方法（暫時 PG 17，完成後停止並限縮 ACL）。
4. 預檢的「backup newer than 24 h」與「matches SHA256SUMS」轉為 PASS。

## 2. Additive migrations（正式 owner 身份、LF checkout）
- 只會套用 202609280001_add_operations_tables、202609280002_add_line_webhook_events、202609290001_line_webhook_event_delivery，三者都只新增表或欄位（最後一個在 line_webhook_events 新增 status、reply_text、claimed_at，既有列預設 replied）。舊版 ceee1b5 與新表相容，可先於程式部署。
- LF checkout（不要用 Windows worktree）：
  ```
  git -c core.autocrlf=false clone https://github.com/arashiyun-web/fuyun-travel.git C:\fuyun-release\src
  cd C:\fuyun-release\src; git checkout <APPROVED_SHA>; npm ci
  node scripts/ops/migrate-production-pr33.mjs --sha <APPROVED_SHA>          # 守門＋status
  node scripts/ops/migrate-production-pr33.mjs --sha <APPROVED_SHA> --apply  # 發版窗口
  ```
- 腳本拒絕以下情況：HEAD≠核准 SHA、工作樹不乾淨、autocrlf=true、任何 migration 含 CRLF、角色不是 neondb_owner、不是正式直連 endpoint。
- 身份說明：正式 DATABASE_URL 與 UNPOOLED 目前都是 neondb_owner，也就是 runtime 與 owner 同一角色。DDL 只經這支腳本、走直連 endpoint 執行。拆分 runtime 角色列為後續強化，不在本次發版。
- 驗收：`_prisma_migrations` 13 筆 finished、0 筆 unfinished；`pg_dump -s` 與演練結果比對，既有物件不變。

## 3. 正式 R2 與 Production env
- 正式 bucket：fuyun-ops-production，私有、Public Development URL Disabled、Custom Domains 無。
  - 由持有人在 R2 控制台建立；wrangler OAuth 沒有 R2 寫入範圍。
  - 2026-09-28 15:03Z 已建立（Automatic location、Standard、私有；r2.dev Disabled、無 Custom Domain）。
- 正式憑證：R2 → API Tokens → Create Account API token。
  - 權限 Object Read & Write；Specify bucket **只選 fuyun-ops-production**，不能選測試 bucket。
  - 保存：`powershell -File scripts\test-support\save-r2-credentials.ps1 -Target production`，寫入 production-release.env，與 Preview 分開；R2_ACCOUNT_ID、R2_BUCKET_NAME 已補入。
  - 2026-09-28 15:09Z 已建立 token「fuyun-ops-production」（id sha256 7873a5ba…）並保存到 production-release.env；`r2-precheck --target production` 全數 PASS（checkpoint §18）。
  - 先前誤存的金鑰（c2371e1a…，範圍為測試 bucket）已於 2026-09-28 撤銷（checkpoint §19）。
  - 範圍證據：與測試 token 同法，在 dashboard session 唯讀讀取 policy，比對 id sha256。
    - 存成 `%USERPROFILE%\.fuyun-tools\release\r2-token-policy-production.json`（只含 id_sha256）。
- 驗證：`node scripts/test-support/r2-precheck.mjs --target production`，以下各項都必須 PASS：
  - D：policy 只限正式 bucket，最先檢查；未通過就不寫入任何物件。
  - C：r2.dev Disabled、無 Custom Domains。
  - A：唯一合成物件寫入、讀回雜湊、簽名網址，最後在 finally 刪除。
  - B：匿名 S3 讀取被拒。
  - E：正式金鑰不能列出測試 bucket，必須是 403 AccessDenied。
- Production env 只新增下列名稱：
  - OPERATIONS_PERSISTENCE_MODE=database
  - OPERATIONS_LIVE_PUBLISH_ENABLED=false
  - OPERATIONS_CRON_TOKEN：正式新值，不沿用 Preview 值
  - R2_ACCOUNT_ID、R2_BUCKET_NAME（正式 bucket）、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY（正式 token）
  - ADMIN_ACCESS_TOKEN：見第 4 步
- 經 stdin 寫入（`vercel env add NAME production`，透過 vercel-ascii.ps1）。
- 禁止：
  - 整包複製 Preview 的 29 個 branch 變數。
  - 使用測試 Neon 分支 pr33-ops-e2e 或測試 bucket。
  - 改動 16 個 Neon 整合共用的 DB 名稱。
- 驗收：預檢「Production env has the … names」PASS；`vercel env ls production` 前後比對只多出上述名稱。

## 4. ADMIN_ACCESS_TOKEN 輪換
- 呼叫端：repo 內只有 lib/adminQuoteAuth.ts；8940 只有未部署的舊專案（§13.6）。
- **GX10／Hermes 是否依賴：未清點，這是阻擋條件，不能略過。**
  - 8940 無法讀取 GX10，需由實際查過的人（分身民）在 GX10 上查 `ADMIN_ACCESS_TOKEN`／`admin_token` 的使用處，並寫入紀錄 `%USERPROFILE%\.fuyun-tools\release\admin-token-callers.json`（格式見 scripts/ops/admin-token-callers.mjs）。
    - gx10 與 hermes 各一筆：checked、checkedBy、checkedAt、method、usesAdminAccessToken、usesQueryParam=false、readyForNewValue。
  - 紀錄不完整時：
    - 預檢 FAIL（BLOCKING）。
    - `rotate-admin-access-token.mjs apply` 拒絕（exit 3）。
    - 第 5 步不得進行。
  - 若有依賴：先把呼叫端改為 header，並準備好新值的注入方式（readyForNewValue=true），再切換。
  - 代理不得代填此紀錄。
- 新值已由 `rotate-admin-access-token.mjs prepare` 產生，只在 admin-access-token.env（fp d3c45fa759）。
- **env 變更只對之後建置的部署生效**；既有部署（含目前的正式部署）保留建置當時的值。因此輪換必須以「apply 之後才建置的新部署」驗收，不能在舊部署上判定。
- 順序：
  1. 呼叫端確認（上面的紀錄完整）。
  2. `apply`：與第 3 步同一窗口，單值替換、不雙收；記下 env 更新時間 T_env。
  3. 第 5 步合併，由 Git integration 產生新的 Production 部署 D_new。
  4. 驗收（必須全部成立）：
     - D_new 的 createdAt 晚於 T_env，且 D_new 的 sha＝合併 commit（GitHub deployments API／`vercel inspect`）。
     - 正式網域已指向 D_new（`vercel inspect <正式網域>` 的 deployment id＝D_new）。
     - `verify https://<正式網域>`：新值 header 404、新值 query 401。
     - 舊部署的 deployment URL（例如 ceee1b5 的 `*.vercel.app`）在沒有 bypass 時回 Vercel 驗證（401／302），舊值無法從外部使用。
  5. 通知已確認的呼叫端改用新值。

## 5. 合併與部署
- 第 1–4 步完成、預檢全數 PASS（含 GX10／Hermes 呼叫端）後，才在 GitHub 正常合併到 main，由 Git integration 部署 Production。
- 不先合併觸發部署再補環境；env 變更只在下一次部署生效。

## 6. 正式驗證
- 部署：GitHub deployments API 的 Production sha＝合併 commit；記錄 deployment ID 與網域。
- 公開頁：首頁與主要頁面 200。
- 登入：Cookie HttpOnly／Secure／SameSite=Lax；同源可操作；跨來源與無 Origin 回 401。
- 七頁詢價表單（`/charter-bus/{taipei,new-taipei,taoyuan,hsinchu,taichung,tainan,kaohsiung}` 的 WebMCPQuoteTool）：依實際程式，只在瀏覽器端校驗並產生 LINE `oaMessage` 深連結，**不呼叫伺服器、不寫入 DB、不推播**。
  - 驗收：7 頁皆 200 且表單欄位完整；空白送出列出錯誤；合成資料送出後產生的連結以 `https://line.me/R/oaMessage/` 開頭、指向官方帳號，特殊字元已編碼、各欄位值完整；瀏覽器 Network 面板沒有對本站 API 的請求。不需要清理 DB。
- `/contact/inquiry`（InquiryForm_v2 → `POST /api/inquiry`）才會寫入 `inquiries`，並寄信、推播管理員 LINE。
  - 只在已核准的測試收件者與測試 LINE 帳號下以合成資料送出一次；確認寫入一筆後由 admin 刪除或標記合成。沒有核准的測試對象時不送出，只驗證頁面與前端校驗。
- 報價授權：header 通過；`?admin_token=` 與錯誤 token 回 401；rotate verify。
- 營運持久化：合成 intake → R2 物件 hash、未簽名 GET 拒絕、60 秒簽名 URL；dry-run process-due 每個 job 只 claim 一次；OPERATIONS_LIVE_PUBLISH_ENABLED=false。完成後清理合成內容。

## 7. worker
- 第 6 步全數通過後，才更新 worker.env 指向正式網址與正式 cron token，啟用 Fuyun-Operations-Worker。保持 dry-run。
- 真實對外發布需要內容核准，以及各平台以測試帳號實測，另案進行。

## 8. 回復
- 程式回復基準：ceee1b5（部署 dpl_Fvr7b…）。
- **不使用 Instant Rollback／Promote 回到 ceee1b5 的既有部署**：部署保留建置當時的 env，回到那個部署等於把舊的 ADMIN_ACCESS_TOKEN（§8.1 已確認曾外洩於 Git 歷史）重新啟用。
  - ceee1b5 的程式也仍接受 `?admin_token=`（8 處用法屬 main ceee1b5；PR #33 已移除），回退後以 query 傳值的風險同時回來。
- 不恢復舊憑證的回復方式（擇一，以新建置部署完成）：
  1. 首選：修正後前滾（新的修正提交，走一般 PR 與部署）。
  2. 需要回到舊程式時：在 main 以 `git revert -m 1 <PR #33 合併提交>` 建立回退提交，走一般 PR 合併，由 Git integration 以「目前的」Production env 建置新部署。
     - 新增的 OPERATIONS_*／R2_* 名稱舊程式不讀取，可保留；ADMIN_ACCESS_TOKEN 維持新值。
     - 回退後以 `rotate-admin-access-token.mjs verify` 確認新值 header 可用；呼叫端只以 header 傳值，不以 query 傳值。
  3. 若回退的是整個 PR 而需要保留管理端安全修正（移除 `?admin_token=`），改為只回退營運相關檔案的部分回退提交，同樣走 PR 與新建置。
- 回復後驗收：正式網域的 deployment id 為新建置部署、其 sha 為回退提交；rotate verify 通過；舊值 header 回 401。
- 程式回復不會回復資料庫：三個新表／欄位（202609280001、202609280002、202609290001）保留，舊版不使用、不受影響。
- 程式回復不會移除新增的 Production env 名稱；若要移除需另行操作，並同樣只在下一次新建置部署生效。
- 資料回復只在確認資料錯誤時進行：以第 1 步 dump 還原到新 Neon 分支比對，不直接覆蓋正式。
- worker 先停用（Disable-ScheduledTask），再回復程式。
