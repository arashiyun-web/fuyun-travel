# PR #33 正式發版清單（準備完成，尚未套用）

適用：feat/ops-worker-integration-20260927 通過有效審查之後。本文件只列順序、設定、驗收與回復；撰寫時沒有套用任何正式變更。
依據：checkpoint §13.3（升級演練）、§13.6（輪換）、§13.7（原始次序）、§14–§15（Preview 驗證）、§22（本順序修正）。

**順序固定為第 1–8 步，前一步未完成不得進入下一步。** 兩種檢查要分清楚：
- **預檢**（第 2、6 步）：在合併前執行，對象是尚未部署的候選與正式資源。預檢不能證明正式部署可用。
- **部署後驗收**（第 7 步）：只能在合併後、由 Git integration 產生的新 Production 部署上執行。部署尚未存在時不得要求它通過驗收；Preview（例如 dpl_C7ySkX4r3qeZotMmJHTHwQRfBaMJ）的結果也不能當成正式驗收。
- 發版期間 worker 維持 Disabled，真實發布維持關閉（OPERATIONS_LIVE_PUBLISH_ENABLED=false）。
- 所有秘密（token、金鑰、DB URL）只經 stdin 或秘密檔傳遞，不得出現在指令輸出、日誌、checkpoint、PR 或提交中。

## 1. Reviewer 驗收與合併條件
- 分支規則（main）：2026-09-29 起必須核准數為 0。這是持有人決定自行審查，只改核准數，其餘規則不變（見 checkpoint §23）。
  - 仍須經 PR 合併；不要求對話全部 resolved。
  - 沒有指定必要 status checks，但 Vercel check 仍必須為成功。
  - 發版時紀錄持有人自行審查的決定。核准數改回 1 之後，本步驟恢復為「需要另一人的有效 approval」。
- Reviewer 逐則驗收 15 個 review threads 的修正。thread 是否 resolved 由 reviewer 依分支規則決定，作者不代為標記。
- 作者回覆、自我審查、自動化 bot 評論（例如 chatgpt-codex-connector 的 COMMENTED）與自動測試都**不是** approval。
- 取得 approval 的完整 SHA 記為 `APPROVED_SHA`，且必須等於 PR 目前的 head。approval 之後若有新提交，須對新 head 重新取得 approval，並從第 1 步重跑。
- 不使用管理員例外、不改分支保護、不 force-push。

## 2. 發版前預檢（`--phase pre-release`，唯讀）
- 在 LF checkout 的 `APPROVED_SHA` 上執行：
  `powershell -NoProfile -File scripts\tools\vercel-ascii.ps1 --exec node scripts/ops/release-preflight-pr33.mjs --phase pre-release --bucket fuyun-ops-production`
- 通過條件：exit 0。備份與 Production env 屬於第 3、5 步，此時回報 PENDING；其餘項目都必須 PASS。FAIL 或 UNVERIFIED 一律阻擋。
- 預檢涵蓋：
  - **候選 SHA**：工作樹乾淨，HEAD＝`APPROVED_SHA`，三個 migration 為 LF 且等於 git blob。
  - **原始呼叫端紀錄**：`%USERPROFILE%\.fuyun-tools\release\admin-token-callers.json` 的 validator 通過（BLOCKING）。另外手動確認 SHA-256＝`7c8c27c39af4b955d2b3451ebe1e4d110b66326b37a814d741d9821e5765a7cb`；若 GX10／Hermes 之後有變更，須重新取得紀錄。代理不得代填。
  - **正式資源**：R2 fuyun-ops-production 與正式 token（r2-precheck D、C、A、B、E 全部 PASS；A 會寫入唯一的合成物件，並在 finally 刪除）；正式部署仍為 ceee1b5；worker 排程為 Disabled；輪換新值已準備。
  - **migration 清單**：正式只有 10 個 baseline、0 個 unfinished，三個新 migration 尚未套用。
- **回復方案**：人工確認第 9 節的候選 A／B／C 與回復後驗收，確認發版當下可執行（誰有 Vercel、GitHub、Neon 權限）。

## 3. 正式 DB 備份（發版窗口內新建，可恢復證據）
1. `node %USERPROFILE%\.fuyun-tools\neon-backup.cjs %USERPROFILE%\.fuyun-tools\pgsql-17\pgsql\bin <FuyunBackups\YYYYMMDD-neon-prod>`
2. 在同一目錄產生 SHA256SUMS（`Get-FileHash -Algorithm SHA256`，格式 `<hash>  <file>`）；目錄 ACL 限 SYSTEM＋Administrator。
3. 可恢復證據：`pg_restore --list <dump>` 成功，且表數與 §11.5 一致。完整還原演練沿用 §11.5／§13.3 的方法（暫時 PG 17，完成後停止並限縮 ACL）。
4. 既有備份（例如 neon-prod-20260927T145911Z.dump）不算數，必須是本窗口新產生的；第 6 步會檢查「newer than 24 h」與「matches SHA256SUMS」。

## 4. Additive migrations（正式 owner 身份、LF checkout）
- 只會套用三個 migration，都只新增表或欄位：
  - 202609280001_add_operations_tables
  - 202609280002_add_line_webhook_events
  - 202609290001_line_webhook_event_delivery（在 line_webhook_events 新增 status、reply_text、claimed_at，既有列預設 replied）
- 舊版 ceee1b5 與新表相容，可先於程式部署。
- LF checkout（不要用 Windows worktree）：
  ```
  git -c core.autocrlf=false clone --no-checkout https://github.com/arashiyun-web/fuyun-travel.git C:\fuyun-release\src
  cd C:\fuyun-release\src; git config core.autocrlf false; git checkout <APPROVED_SHA>; npm ci
  node scripts/ops/migrate-production-pr33.mjs --sha <APPROVED_SHA>          # 守門＋status
  node scripts/ops/migrate-production-pr33.mjs --sha <APPROVED_SHA> --apply  # 發版窗口
  ```
- 只在 clone 指令加 `-c core.autocrlf=false` 不夠。之後的 `git checkout` 會改用全域 autocrlf=true，把檔案寫成 CRLF（2026-09-29 發版時由預檢攔下）。必須先 `--no-checkout`，設定 repo 的 core.autocrlf=false，然後才 checkout。
- 腳本在以下情況拒絕執行：HEAD≠核准 SHA、工作樹不乾淨、autocrlf=true、任何 migration 含 CRLF、角色不是 neondb_owner、不是正式直連 endpoint。
- 身份說明：正式 DATABASE_URL 與 UNPOOLED 目前都是 neondb_owner，也就是 runtime 與 owner 同一角色。DDL 只經這支腳本、走直連 endpoint 執行。拆分 runtime 角色列為後續強化，不在本次發版。
- 驗收：`_prisma_migrations` 13 筆 finished、0 筆 unfinished；`pg_dump -s` 與演練結果比對，既有物件不變。

## 5. Production env 與新的 ADMIN_ACCESS_TOKEN
### 5.1 正式 R2（已就緒）
- 正式 bucket：fuyun-ops-production，私有、Public Development URL Disabled、Custom Domains 無。2026-09-28 15:03Z 由持有人建立（wrangler OAuth 沒有 R2 寫入範圍）。
- 正式 token「fuyun-ops-production」：2026-09-28 15:09Z 建立（id sha256 7873a5ba…）。
  - 權限 Object Read & Write，只限 fuyun-ops-production。
  - 保存在 production-release.env（經 `scripts\test-support\save-r2-credentials.ps1 -Target production`），與 Preview 分開。
  - 先前誤存的測試範圍金鑰（c2371e1a…）已於 2026-09-28 撤銷（checkpoint §18–§19）。
- 範圍證據：policy 唯讀讀取後只存 id_sha256 到 `%USERPROFILE%\.fuyun-tools\release\r2-token-policy-production.json`。
- `node scripts/test-support/r2-precheck.mjs --target production` 的 D、C、A、B、E 每一項都必須 PASS：
  - D：policy 只限正式 bucket，最先檢查；未通過就不寫入任何物件。
  - C：r2.dev Disabled、無 Custom Domains。
  - A：唯一合成物件寫入、讀回雜湊、簽名網址，最後在 finally 刪除。
  - B：匿名 S3 讀取被拒。
  - E：正式金鑰不能列出測試 bucket（403 AccessDenied）。

### 5.2 Production env（只新增下列名稱）
- OPERATIONS_PERSISTENCE_MODE=database
- OPERATIONS_LIVE_PUBLISH_ENABLED=false
- OPERATIONS_CRON_TOKEN：正式新值，不沿用 Preview 值
- R2_ACCOUNT_ID、R2_BUCKET_NAME（正式 bucket）、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY（正式 token）
- 經 stdin 寫入（`vercel env add NAME production`，透過 vercel-ascii.ps1）。
- 禁止：
  - 整包複製 Preview 的 29 個 branch 變數。
  - 使用測試 Neon 分支 pr33-ops-e2e 或測試 bucket。
  - 改動 16 個 Neon 整合共用的 DB 名稱。
- 驗收：`vercel env ls production` 前後比對，只多出上述名稱。

### 5.3 ADMIN_ACCESS_TOKEN 輪換（apply）
- 呼叫端：repo 內只有 lib/adminQuoteAuth.ts；8940 只有未部署的舊專案（§13.6）。
- GX10／Hermes 呼叫端（阻擋條件）：
  - 2026-09-29 已取得分身民產出的原始紀錄，來源為 `arashiyun@gx10-f6b2:/home/arashiyun/hermes-fenshenmin/.fuyun-tools/release/admin-token-callers.json`，來源端與本機 SHA-256 一致。
  - validator 通過；兩端皆 usesAdminAccessToken=false、usesQueryParam=false。原樣保存，版本校正另存 version-notes.md。
  - 紀錄不完整時，預檢 FAIL，且 `rotate-admin-access-token.mjs apply` 拒絕（exit 3）。
  - 若有依賴：先把呼叫端改為 header，並準備好新值的注入方式（readyForNewValue=true），再切換。
- 新值由 `rotate-admin-access-token.mjs prepare` 產生，只存在 admin-access-token.env（fp d3c45fa759）。
- 舊值無法取回：Production 的 ADMIN_ACCESS_TOKEN 是 Vercel sensitive 變數，`vercel env pull` 只回傳佔位字串，不是實際值。
  - 不要把 pull 的結果記成 PREVIOUS，否則 verify 的「舊值 401」會是假 PASS。
  - 舊值被拒改以下列證據判定：Production 只剩一筆且更新時間為 T_env；D_new 晚於 T_env 建置；程式以常數時間比對唯一設定值；錯誤 token 回 401。
- `apply`：與 5.2 同一窗口，單值替換、不雙收；記下 env 更新時間 T_env（第 7 步用來判定部署是否為新建置）。
- **env 變更只對之後建置的部署生效**；既有部署（含目前的正式部署）保留建置當時的值，所以本步驟無法驗收輪換。輪換要到第 7 步，在新部署上驗收。

## 6. 部署前預檢（`--phase pre-deploy`）→ 正常合併
- 在同一 LF checkout（HEAD＝`APPROVED_SHA`）執行：
  `powershell -NoProfile -File scripts\tools\vercel-ascii.ps1 --exec node scripts/ops/release-preflight-pr33.mjs --phase pre-deploy --bucket fuyun-ops-production`
- 通過條件：exit 0，**所有項目都是 PASS，不得有 PENDING**。項目如下：
  - 13 個 migration finished、0 個 unfinished，且新增的恰好是那三個。
  - 第 3 步的新備份在 24 h 內，且與 SHA256SUMS 相符。
  - Production env 名稱齊全、R2 全數 PASS、呼叫端紀錄通過。
  - worker 仍為 Disabled；正式部署仍為 ceee1b5。
- 預檢只看 env 名稱，無法得知 ADMIN_ACCESS_TOKEN 的值是否已替換。需另外確認第 5.3 步 `apply` 的紀錄與 T_env 已保存。
- 確認 PR head 仍等於 `APPROVED_SHA`，而且 approval 仍有效。
- 以上都成立後，才在 GitHub 正常合併到 main，由 Git integration 產生新的 Production 部署 D_new。
  - 不先合併觸發部署再補 env。
  - 不使用管理員例外。

## 7. 部署後驗收（只在 D_new 上）
D_new 建置完成（Ready）後才開始。任何一項失敗都轉第 9 節回復，worker 不啟用。
- **部署身分**：記錄 D_new 的 deployment ID、建置時間 createdAt、網域。
  - D_new 的 sha＝合併 commit（GitHub deployments API／`vercel inspect`）。
  - createdAt 晚於 T_env。
  - 正式網域已指向 D_new（`vercel inspect <正式網域>` 的 deployment id＝D_new）。
- **Token**（`rotate-admin-access-token.mjs verify https://<正式網域>`）：
  - 新值 header 可用（404）。
  - 舊值 header 被拒（401）。
  - 新值放在 query（`?admin_token=`）被拒（401）；錯誤 token 被拒（401）。
  - 舊部署的 deployment URL（例如 ceee1b5 的 `*.vercel.app`）在沒有 bypass 時回 Vercel 驗證（401／302），外部無法用舊值呼叫。
- **公開頁**：首頁與主要頁面 200。
- **登入／me／登出**：
  - Cookie 為 HttpOnly／Secure／SameSite=Lax；同源可操作；跨來源與無 Origin 回 401。
  - `/api/auth/me` 帶 session cookie 200、不帶憑證 403。
  - 登出後 cookie 清除。
- **詢價**：
  - 七頁表單（`/charter-bus/{taipei,new-taipei,taoyuan,hsinchu,taichung,tainan,kaohsiung}` 的 WebMCPQuoteTool）只在瀏覽器端校驗並產生 LINE `oaMessage` 深連結，不呼叫伺服器、不寫 DB、不推播。驗收項目：
    - 7 頁皆 200，表單欄位完整。
    - 空白送出會列出錯誤。
    - 合成資料送出後的連結以 `https://line.me/R/oaMessage/` 開頭、指向官方帳號，特殊字元已編碼、各欄位值完整。
    - Network 面板沒有對本站 API 的請求。
  - `/contact/inquiry`（InquiryForm_v2 → `POST /api/inquiry`）會寫入 `inquiries`，並寄信、推播管理員 LINE。
    - 只在已核准的測試收件者與測試 LINE 帳號下，以合成資料送出一次；確認寫入一筆後，由 admin 刪除或標記為合成。
    - 沒有核准的測試對象時不送出，只驗證頁面與前端校驗。
- **營運持久化**：
  - 合成 intake 寫入 R2 後物件 hash 相符；未簽名 GET 被拒；60 秒簽名 URL 可讀。
  - dry-run process-due 每個 job 只 claim 一次；OPERATIONS_LIVE_PUBLISH_ENABLED=false。
  - 完成後清理合成內容。
- 全部通過後，才通知已確認的呼叫端改用新值。

## 8. worker（dry-run）
- 第 7 步全數通過後，才更新 worker.env 指向正式網址與正式 cron token，再啟用 Fuyun-Operations-Worker。保持 dry-run。
- 真實對外發布另案進行，需要：
  - 內容核准。
  - 各平台以測試帳號實測並驗收。

## 9. 回復
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
- 資料回復只在確認資料錯誤時進行：以第 3 步的 dump 還原到新 Neon 分支比對，不直接覆蓋正式。
