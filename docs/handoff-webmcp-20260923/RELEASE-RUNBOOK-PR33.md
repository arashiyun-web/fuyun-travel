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
- **GX10／Hermes 呼叫端：這是阻擋條件，不能略過。** 2026-09-29 已取得分身民產出的原始紀錄：
  - 來源：`arashiyun@gx10-f6b2:/home/arashiyun/hermes-fenshenmin/.fuyun-tools/release/admin-token-callers.json`，SHA-256 來源端與本機一致（7c8c27c3…5765a7cb）。
  - validator 通過；兩端皆 usesAdminAccessToken=false、usesQueryParam=false。
  - 已原樣保存；版本校正另存 version-notes.md。
  - 發版當下預檢仍會重新驗證；若 GX10／Hermes 在此之後有變更，需重新取得紀錄。
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
- 程式基準 ceee1b5（部署 dpl_Fvr7b…）**不是**可用的回復目標：
  - 該部署保留建置當時的 env，會重新啟用舊的 ADMIN_ACCESS_TOKEN（§8.1 已確認舊值曾外洩於 Git 歷史）。
  - 它的程式接受 `?admin_token=`（8 處 URL 用法屬 main ceee1b5；PR #33 已移除）。
- 禁止事項：
  - 對任何發版前的部署做 Instant Rollback／Promote。
  - 整包回退 PR #33（例如 `git revert -m 1 <合併提交>`）：會一併撤掉拒絕 query token、session cookie 與登入登出的安全修正。
- **每個回復候選都必須同時滿足：**
  1. 保留安全修正，以下檔案維持 PR #33 版本：
     - lib/adminAuth.ts、lib/adminQuoteAuth.ts
     - app/api/auth/{login,logout,me}、app/admin/page.tsx
     - app/admin/{quotes,quotes/[id],analytics}/page.tsx、app/api/admin/quotes/[id]/{route,send/route}.ts
     - app/api/social/instagram/oauth/{callback,revoke}、app/api/social/instagram/status
  2. 與已套用的三個 additive migrations（202609280001、202609280002、202609290001）相容：不寫 down migration、不刪表或欄位；程式可以不使用新表，但不得假設它們不存在。
  3. 以當時有效的 Production env 產生新建置的部署：有新提交時由 Git integration 部署；沒有新提交（候選 B）時用 Vercel Redeploy，並取消 Use existing Build Cache。不 Promote 或 Instant Rollback 既有部署，是否生效以下面的驗收為準。
  4. 回復前先停用 worker（Disable-ScheduledTask）；回復驗收通過且重新評估後才可再啟用。
- 回復候選（依序採用）：
  - **A. 前滾修正**：新的修正提交，走一般 PR、審查與部署。
  - **B. 營運功能關閉**（不改程式）：
    - 移除 Production 的 OPERATIONS_PERSISTENCE_MODE（OPERATIONS_LIVE_PUBLISH_ENABLED 維持 false），再對目前的正式部署做 Redeploy（不使用 build cache），產生新建置。
    - 營運 API 會 fail closed（503），安全修正與 LINE／報價功能照常。
    - 適用於營運後台或 R2 的問題。
  - **C. 部分回退提交**：只回退出問題的非安全檔案（例如 LINE webhook 或營運模組），走 PR 審查。
    - PR 內附上一段的條件 1–4 核對結果。
    - `git diff <PR #33 合併提交> <回退提交> -- <條件 1 的檔案>` 必須為空。
- 回復後驗收（全部成立才算完成）：
  - 正式網域的 deployment id 為本次新建置；它的 createdAt 晚於回復決定；sha 為回復用的提交。
  - `rotate-admin-access-token.mjs verify`：新值 header 404、query 401、舊值 header 401。
  - `/api/auth/me`：帶 session cookie 200、不帶憑證 403；登出後 cookie 清除。
  - 報價 API 帶 `?admin_token=` 回 401。
  - `prisma migrate status` 為 up to date（13 筆），沒有失敗的 migration。
  - 候選 B：營運 API 回 503、公開頁與詢價正常。
- 程式回復不會回復資料庫；新增的 Production env 名稱也不會自動移除，移除同樣只在下一次新建置部署生效。
- 資料回復只在確認資料錯誤時進行：以第 1 步 dump 還原到新 Neon 分支比對，不直接覆蓋正式。