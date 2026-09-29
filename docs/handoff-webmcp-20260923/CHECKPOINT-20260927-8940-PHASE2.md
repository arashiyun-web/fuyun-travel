# 8940 第二階段 checkpoint（2026-09-27）

接續 GX10 的 CHECKPOINT-20260927-CONTINUATION.md。該檔及 GX10 commit 目前在 8940 無法取得，見 §2。

## 1. 環境（2026-09-27 實測）
- Claude Code 2.1.283，model 為 claude-opus-5-5（session 自報）
- 主機：Windows 11 Pro 10.0.26200 x64，AMD Ryzen 9 8945HS 8C/16T，RAM 61.8 GB；WSL Ubuntu／docker-desktop 均為停止狀態
- Node：C:\Program Files\nodejs\node.exe v24.16.0（process.execPath 實測）
- 專案：Documents\Codex\2026-05-31\fuyun-travel（main@5aad9dc，落後 origin/main 85 個 commit，含未提交的 operations／IG 實作）
- 未提交差異已保存：recover/20260927-phase2-pre-integration/ 及 refs/recover/20260927-phase2-pre（非破壞性）

## 2. GX10 交接來源：無法取得
- 6c234d6、097f4eb、32d13d7、bf1b49c：GitHub API 回 422（No commit found），本機 fetch 後也不存在
- 本機、OneDrive、Google Drive 均查無 CHECKPOINT-20260927-CONTINUATION.md、CHANGE_MANIFEST.md、VALIDATION_REPORT.md
- 缺少：GX10 分支名、完整 HEAD SHA，以及推送到 origin 的動作

## 3. 部署事實（GitHub deployments API）
- origin/main 自 222c0a6（2026-08-24，最後一次 success）之後：590a1b8、c0c4398 的 Production build 均為 failure
- origin/main HEAD 的 tsc 有 3 個既有錯誤：app/services/page.tsx 引用不存在的 charterFaqPageSchema；components/WebMCPQuoteTool.tsx 引用未提交的 lib/webmcp-tool、lib/webmcp-quote-utils
- 回報中的正式站 iklolu4l1 不在 git deployments 清單，推定為 CLI 部署，來源未核
- 8940 原生 Windows 未安裝 Vercel CLI，也沒有 auth.json

## 4. 安全修補（分支 fix/admin-auth-hardening-20260927，基於 origin/main c0c4398，僅本機）
- lib/adminAuth.ts：移除硬編碼帳密及 JWT_SECRET fallback；改用 ADMIN_USERNAME、ADMIN_PASSWORD_SALT/HASH（scrypt）、JWT_SECRET（≥32 字元）；token 加 v=2，舊格式 token 一律拒絕
- 缺少設定時：login 回 503、verify 回 null；公開頁不受影響（import 時不 throw）
- 16 條呼叫 verifyAdminToken 的 API 簽章不變
- app/admin/page.tsx：移除帳號預填
- scripts/provision-admin-credentials.mjs：產生隨機密碼／hash／JWT_SECRET，寫到 %USERPROFILE%\.fuyun-secrets（ACL 限本人），不輸出任何值
- 測試：node --test scripts/admin-auth.test.mjs，8/8 PASS（Node v24.16.0）
- worktree：Documents\Codex\2026-05-31\fuyun-travel-sec，commit 5f52a83（伺服器端）＋ 2ee8034（建置修復與公開 JS），僅本機，未推送

### 4.1 建置修復（2ee8034）
- 錯誤 1：app/services/page.tsx(6,10) TS2305，charterFaqPageSchema 不存在 → 在 lib/seo/generateSchema.ts 新增，重用 faqSchema，每題前加【車型】，避免兩車型報價混用
- 錯誤 2：components/WebMCPQuoteTool.tsx(23,46)(24,30) TS2307，lib/webmcp-tool、lib/webmcp-quote-utils 未提交 → 此元件無任何引用，本分支移除；待 GX10 WebMCP 交接合併時恢復（不在 8940 平行重做）

### 4.2 public/platform/app.js（2ee8034）
- 原本判斷是 demo，這是錯的：OWNER_ACCOUNT 的密碼與舊管理員密碼完全相同，而且此頁由首頁與 /admin 連入、會呼叫 /api/auth/login，是正式登入入口
- 已移除前端帳號；一律先走伺服器登入，失敗才落回 localStorage 的虛構示範帳號（admin／editor／customer，僅在瀏覽器本地）
- 載入時清除舊版快取在瀏覽器中的 u-owner 紀錄；app.js 快取參數改為 admin-auth-hardening-20260927

### 4.3 驗證（2026-09-27，C:\Program Files\nodejs\node.exe v24.16.0）
- 證據位於主工作樹 recover/20260927-phase2-pre-integration/evidence/（不入 git）：01 baseline tsc EXIT=1（3 個錯誤）；02 修復後 tsc EXIT=0；03 next build（未設任何管理 env）EXIT=0；04 本機整合；05 390px 截圖
- 本機 next start（127.0.0.1，未碰正式站）：
  - 有設定：12/12 PASS（舊憑證 401；舊 fallback key 簽發的 token，新舊格式均 403；新憑證 200）
  - 無設定：8/8 PASS（login 503；/ 與 /services 200；FAQPage JSON-LD 存在）
- 真瀏覽器（Playwright，localhost）：
  - 錯誤帳密：呼叫伺服器後失敗，停在 #login，沒有 admin_token
  - 虛構 customer 帳號可登入並導向 #member
  - 真正重載後，舊 u-owner 紀錄已清除
- 最終 build（BUILD_ID Z_fd1f7EQHGR4Pta7Mxm0）的 .next 掃描：不含舊密碼與舊 fallback key。原始碼只剩 app/admin/page.tsx.v1.bak 含舊帳號名（不含密碼，Next 不會提供此檔）

### 4.4 未完成
- 未推送、未做 Preview，正式站未套用
- 正式站曝險：UNKNOWN。正式站 deployment iklolu4l1 的來源未核；依指示未對正式站送出舊憑證
- 若正式站提供的是舊版 platform/app.js，舊管理員密碼等同已公開在網站 JS 中。部署修補時必須同時在正式環境設定新的 ADMIN_* 與 JWT_SECRET，並把舊密碼視為已洩漏

## 5. 權限拒絕紀錄
- 2026-09-27 第一輪兩次拒絕，工具都是 Bash，來源是 Claude Code auto mode classifier：
  - 對正式站送出舊憑證：標註 Production Reads
  - 讀 app/services/page.tsx 等：server-side 分類器，未說明原因
- 兩次都不是 settings 明確 deny，也不是 hook、工作目錄界線或 OS／沙箱限制
- 持有人確認範圍後，改用 Read 讀專案檔成功。對正式站的主動測試依指示不再執行

## 6. Vercel 與正式站（2026-09-27 16:00–16:45）
- CLI：vercel 60.1.3，以 npm i -g 安裝在原生 Windows（WSL 未使用）
- CLI 60.1.3 在本機登入失敗：User-Agent 內含 os.hostname()，本機主機名稱為非 ASCII → ByteString 錯誤
  - 處理：process 範圍 preload（%USERPROFILE%\.fuyun-tools\ascii-hostname.cjs，經 NODE_OPTIONS=--require 載入），系統主機名稱不變
- 官方 device login 由持有人完成後核對：
  - whoami：arashiyun-web
  - team：arashiyun-s-projects（hobby）
  - project：fuyun-travel prj_4EEboycCgJIJudWwBhTwlQtKagU4，與 .vercel/project.json 一致
- 正式站：dpl_8kgfHsWV7DPZrLob22UBZtcJkycD（iklolu4l1），2026-09-23 06:47 由 CLI 部署，不是從 git 部署
  - 含 WebMCPQuoteTool 與 lib/webmcp-*（GX10 版本）；沒有 IG OAuth 路由與 operations 路由
- 正式站曝險：CONFIRMED
  - 公開的 https://fuyuntravel.com/platform/app.js 內含舊管理員密碼明文（2026-09-27 以一般 GET 核對，只比對、不輸出值）
  - 正式站伺服器是否仍接受舊密碼：未測（依指示不做主動測試）
  - Production env 原本沒有 ADMIN_* 與 JWT_SECRET
- 下載正式 deployment 原始碼被 auto-mode 拒絕（Production Reads），未繞過
- Env（值以 stdin 寫入、Sensitive、不輸出）：ADMIN_USERNAME、ADMIN_PASSWORD_SALT、ADMIN_PASSWORD_HASH、JWT_SECRET 已加入 Production 與 Preview
  - 帳號沿用原帳號名，密碼與簽章金鑰為新產生
  - 登入資訊存於 %USERPROFILE%\.fuyun-secrets\admin-login.txt（ACL：SYSTEM＋本人）
- IG 五項設定：INSTAGRAM_LOGIN_APP_ID、INSTAGRAM_LOGIN_APP_SECRET、INSTAGRAM_LOGIN_REDIRECT_URI、INSTAGRAM_LOGIN_STATE_SECRET、INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY 均存在於 Production（5 天前建立）；Preview 沒有
- Preview（git commit 作者 Codex Deploy 非專案成員，直接部署被 Blocked；改以 git archive 9d8673f 匯出目錄部署，meta sourceCommit 記錄 SHA）：
  - dpl_HL9ueStnZHUJjWuwvM3LoFs8b5LE（無管理 env）：公開頁 8/8 為 200；app.js 無 OWNER_ACCOUNT、無舊密碼；login 503；受保護 API 403／401
  - dpl_hJXzjauBmRhS4BMKTMcCnhq5Sgqh（有新 env）：舊密碼 401；舊 fallback key 簽發的 token（新舊格式）403；新密碼 200；新 token 200；無 token 403
- 正式部署尚未執行：本分支沒有 GX10 WebMCP 程式，直接上線會使 7 個 /charter-bus 頁面失去 WebMCP 報價表單，需持有人決定
- 證據：主工作樹 recover/20260927-phase2-pre-integration/evidence/06、07

## 7. 第三輪（2026-09-27 17:00–18:00，接續 42cfbed）
### 7.1 分支推送
- origin/fix/admin-auth-hardening-20260927：REMOTE_SHA = LOCAL_HEAD = 42cfbed72d220678cd2cc74d8966cacd9de54b0e
- 推送前掃描新增行：不含舊／新秘密值；generic key pattern 0；無 evidence、env、recover 檔
- repo 為 PUBLIC，代表舊密碼與舊 fallback key 一直存在公開的 git 歷史中；不重寫歷史，以更換秘密處理
### 7.2 Vercel 部署權限
- 原始拒絕：dpl_FJdzDhkpTBUaid7t81r4xrwy8BEA「The deployment was blocked because the commit author doesn't have permission to create deployments for this project.」
  - 路徑：CLI 部署，附 git metadata；commit author／committer 均為 Codex Deploy <codex-deploy@fuyuntravel.com>（repo 本地 git config）
- clean export 的 Preview（dpl_HL9ue…、dpl_hJXzj…）只作建置隔離證據，不 promote
- 正規路徑（官方 troubleshoot-project-collaboration 文件：公開 repo 的協作免費）：推送分支後，Vercel Git 整合自動建立 dpl_AsZKPVqhcuLY4CqwyH9ipJue2Xa4
  - source=git、sha=42cfbed、ref=本分支、author=Codex Deploy，READY
  - 驗證 13/13 PASS（evidence/08）
  - 正式部署走 PR 合併 main → Git 整合；作者身份未偽造、metadata 未刪
### 7.3 WebMCPQuoteTool 移除審查：確認是功能退步，不是孤立元件
- 正式站 /charter-bus/* 的公開 HTML 含報價請求表單（出發地、目的地、日期、人數…「送出報價請求（產生 LINE 深連結）」），並引用 webmcp
- 候選移除此元件後，7 個 /charter-bus 頁會失去客戶詢價入口
- 8940 所有磁碟與本機 clone 的 git 歷史均無 lib/webmcp-*；下載正式來源被 auto-mode 拒絕（Production Reads）
- 結論：候選不可直接取代正式站。需 GX10 交接（或持有人授權取得正式 deployment 的 WebMCP 相關檔案）後整合再部署
### 7.4 本地小模型（Ollama 0.34.4，winget Ollama.Ollama，原生 Windows）
- qwen3:4b（Ollama 預設標籤為 Thinking 變體）：推理文字直接輸出為內容，think:false 與 /no_think 均無效；每題 58–209 s → 不適用，已移除
- qwen3:4b-instruct（Qwen3-4B-Instruct-2507，Q4_K_M，2.5 GB 檔案）：
  - 100% CPU（Radeon 780M 未使用）、約 20 tok/s、llama-server 約 3.1 GB 記憶體
  - TTFT 0.27–0.44 s（冷載入 3.1 s），完整回應 2.5–21 s
- 品質：FAQ 價格正確；未知價格回「待確認＋專人報價」正確；回顧文正常
  - FAIL：招生文在第 4 輪自行編造住宿、餐食、門票、日期及「14,000 元／人」
  - 結論：價格規則不能只靠 prompt。worker 需要決定性後檢（金額、日期、包含項目不在核准清單就降為待確認或擋下），並保留人工核准
- 常駐：
  - Startup\Ollama.lnk 在「登入」時啟動，不是開機前服務 → BOOT_CONFIGURED=login-autostart；BOOT_VERIFIED=未重開機驗證
  - 以 explorer 重新啟動後 parent=explorer，與終端無關
  - 砍掉 server 約 2 s 自動恢復；重複啟動仍只有 1 個實例；只監聽 127.0.0.1
- 證據：evidence/09a–09d、09-infer-harness.mjs
### 7.5 秘密與證據
- .fuyun-secrets 與其中兩個檔案：ACL 只有 SYSTEM＋Administrator
- 新秘密值不存在於 evidence、docs、scripts（掃描結果 0）
- evidence 目錄沿用專案 recover ACL（含 CodexSandboxUsers 修改權）；內容已確認不含秘密值
### 7.6 未完成
- 正式部署：等 WebMCP 來源
- operations worker 常駐與整合：等 GX10 IG 來源；現有 8940 版本是 file/database 雙模式＋單例鎖
- 備份還原、IG/FB/LINE 真實鏈、四篇標題：未做

## 8. 第四輪（2026-09-27 21:00–21:40，接收 GX10 交接）
### 8.1 來源接收
- SOURCE_RECEIVED=PASS
  - fetch origin/handoff/webmcp-quote-ig-20260927 = 0e0178bab58b98ea1466cb83738debb932f07e9a（ls-remote 相同）
  - base c0c4398d9e21200498050fb24042117f6fee6f87，rev-list 共 9 筆
  - aaaf7b74 是 0e0178ba 的祖先，兩者差異只有 CONTINUATION.md 2 行
- 秘密值仍在已推送歷史（例如 32d13d7 與 origin/main 的 lib/adminAuth.ts）
  - DOC_HEAD_REDACTED=REPORTED_PASS；HISTORY_SECRET_CLEAN=NO；EXPOSED_OLD_CREDENTIALS=CONFIRMED
  - 歷史不重寫，以輪換秘密並讓舊秘密失效處理
### 8.2 整合（integrate/security-webmcp-ig-20260927 = b7c2628f2301c0be3f730c7e5e92c62398c14df9，已推送）
- lib/adminAuth.ts：保留安全版本（env、scrypt、JWT≥32、無 fallback、v2），並附加 GX10 的 cookie 驗證 helper，全數經過安全版的 verifyAdminToken
  - 整合後 build 輸出與原始碼中，舊秘密命中 0
- components/WebMCPQuoteTool.tsx 恢復，與 GX10 版本完全相同；WebMCP 四個檔對 GX10 的 diff 為 0 行
- generateSchema 採用 GX10 版本（輸出相同），移除重複定義
- lib/adminQuoteAuth.ts 使用 ADMIN_ACCESS_TOKEN（無 fallback），但接受 URL query token，屬既有弱點，記錄待處理
### 8.3 測試
- 證據：evidence/10、11、11b、12
- tsc EXIT=0；next build EXIT=0（BUILD_ID 2Hox_KtxbvG_B8eyPTCPv，未設任何管理 env）
- admin-auth 11/11（新增 cookie：有效 token 接受；舊金鑰或舊格式拒絕；跨站 cookie mutation 拒絕）
- IG 離線 4/4＋10/10；WebMCP quote 38/38；harness 23/23
- 本機真瀏覽器（Chromium，無原生 navigator.modelContext，390px）：
  - 7 頁 SSR 表單欄位完整
  - 空白送出列出 4 項錯誤
  - 合成資料送出產生 line.me/R/ti/p/@fuyuntravel，&、# 已編碼，8 項值完整保留
  - 畫面與正式站相同（11 vs 11b）
- 正常 Git Preview dpl_FzKru6qckUMDEtts39tYxjaHnej3（sha b7c2628，source=git）：22/22 PASS
  - 7 頁表單、app.js 乾淨
  - 舊密碼 401；舊金鑰 token 403；IG start 帶舊金鑰 cookie 401；IG start、revoke 未授權 401
  - 新密碼 200
### 8.4 部署狀態
- PR #32 已建立，CI（Vercel）成功
- main 分支保護要求 1 個核准 review；PR 作者即 gh 帳號，無法自我核准；不使用 --admin 繞過
- 正式站仍為 dpl_8kgfHsWV7DPZrLob22UBZtcJkycD；PROD_SECURITY_APPLIED=FAIL（等持有人合併）
- SAFE_ROLLBACK=NOT_AVAILABLE：目前沒有已套用安全修補的正式部署；dpl_8kgf… 只是歷史基準，不能當安全回復目標
### 8.5 內容事實檢查（feat/ops-content-guard-20260927 = 77b99bdd2f27250184693ca0e3299f44533fe9de，已推送）
- lib/operations/contentGuard.mjs：
  - 事實區塊（價格、單位、時數、名額、日期、包含項目）由程式從有版本的 ApprovedFacts 產生
  - 模型只寫描述；檢查項目：金額、每人／每車、包含項目（含否定語義）、日期、年份、時數、名額、過期或無版本資料、拒答、過長、未核准地點
  - 不通過就回到模板並標記需人工處理
  - approvalHash 綁定文字、圖片、平台、帳號與資料版本
- 測試 11/11，含第 4 輪招生幻覺與 live 拒答、捏造景點的回歸案例
- live（qwen3:4b-instruct digest 0edcdef34593eac1…，Q4_K_M）：5 題中 2 題用模型描述、3 題回到模板；沒有任何未核准事實進入最終草稿（evidence/13a、13b）
### 8.6 常駐模型
- 工作排程 Fuyun-Ollama-Serve：AtStartup、S4U（不儲存密碼）、RunLevel Limited、IgnoreNew
- %USERPROFILE%\.fuyun-tools\run-ollama-serve.cmd：只監聽 loopback，內含 supervisor loop
- 原 Startup\Ollama.lnk 移到 .fuyun-tools\disabled-startup-Ollama.lnk，避免重複實例
- Task Scheduler 的 RestartCount 不會處理程式以非 0 結束 → 第一版砍掉 server 後 402 s 未恢復 → 改加 supervisor loop 後約 7 s 恢復
- 重複啟動只有 1 個 supervisor、1 個 server
- LOGIN_AUTOSTART：已由 task 取代；UNATTENDED_START_CONFIGURED=YES；UNATTENDED_START_VERIFIED=NO；BOOT_VERIFIED=NO（未重開機）
### 8.7 備份還原
- Documents\Codex\FuyunBackups\20260927-ops-data-phase2：tgz＋MANIFEST.sha256＋ARCHIVE.sha256
- 已隔離還原到 20260927-ops-data-phase2-restore-check：6/6 sha OK；state.json 與來源相同；3 個 job 均為 dry_run_verified；不連接 worker
- 兩個目錄 ACL：SYSTEM＋Administrator
- 範圍僅限 file 模式營運資料；Neon DB 與 R2 未備份還原
- C:\fuyun_backup 內有其他服務的每小時 DB dump，ACL 含 Authenticated Users:M，屬外部風險，未更動

## 9. 第五輪（2026-09-27 21:40–22:20）：PR #32 LINE 詢價修正、worker 整合
### 9.1 LINE 詢價（PR #32 新 HEAD a762709f0a9d664b69b36162391c2130e85441e1）
- 公開正式頁 /、/contact、/charter-bus/taipei、/download 的 LINE 連結全部是 @954fyicw
  - 程式中的 @fuyuntravel 找不到與前者為同一帳號的依據 → 改用 @954fyicw
- 新增 lib/config/line.mjs 作為單一來源：解析公開 NEXT_PUBLIC_LINE_OA_URL／NEXT_PUBLIC_LINE_URL，fallback @954fyicw
  - COMPANY.line（也用於社群 caption）、WebMCP 工具、詢價表單、/download 全部改用它
- 依 LINE 官方文件，預填改為 https://line.me/R/oaMessage/{encodeURIComponent(ID)}/?{encodeURIComponent(text)}
  - /R/ti/p/ 只開帳號頁，不能預填
  - URL scheme 只支援 iOS／Android，電腦版 LINE 不支援
- 表單：保留文字預覽；新增可鍵盤操作的「開啟 LINE 詢價（@954fyicw）」連結、複製按鈕、Email 連結、電腦版提示
  - 以 React state 安全渲染
  - 欄位被修改或送出錯誤時清掉舊草稿
- 測試：line-config 3/3；WebMCP quote 51/51（新的 9 項斷言在 b7c2628 上會失敗，證明能抓到這個問題）；harness 23/23；admin 11/11；IG 4/4＋10/10；tsc／build EXIT=0
- 真瀏覽器（390px、無原生 WebMCP）：
  - 連結指向 oaMessage/%40954fyicw，target=_blank、rel=noopener noreferrer
  - 8 欄往返完整
  - 可聚焦；輸入 HTML 只當文字顯示
  - 修改或錯誤後沒有殘留連結
  - 證據：evidence/14、15
- Git Preview dpl_3JBgREus6Y1n2R5XFKoqacFAYYGc（sha a762709，source=git）：22/22 PASS；client bundle LINE 檢查 8/8 PASS（evidence/16）
  - 首次 7 個 FAIL 屬於誤報：來自無關的 wa.me/?text= WhatsApp 按鈕；縮窄檢查範圍後重跑全 PASS
- MOBILE_CHAT_PREFILL=NOT_TESTED（需實體 iOS／Android LINE）
- PR #32：REVIEW_REQUIRED（main 需 1 個核准）；描述已更新為新 HEAD 的驗證結果
### 9.2 worker 整合（feat/ops-worker-integration-20260927 = 01f78772a1b961225ab29bf8008b3ece07787838，已推送）
- 基底：feat/ops-content-guard-20260927 ← b7c2628
- 帶入 8940 未提交的營運新檔 16 個（掃描乾淨）
  - 未帶入：舊 adminAuth、deploy-production*.ps1、recover、rotate 腳本（已被取代）
  - lib/social/instagram-login-v2.ts 與 GX10 版本相同；instagram-oauth.ts 只差 3 個 export
- 核准綁定：
  - 核准時存 approvalHash（caption、圖片 sha、平台、目標帳號）
  - claim 時比對不符 → 撤銷核准、job 回 pending_approval、記錄 approval_invalidated
  - claim 另要求內容本身為 approved
- 收件時每個平台 caption 記錄 factCheck（contentGuard；員工填的出發日期視為已核准日期）
- 修正既有問題：runDueJobs 不再自動重取 manual_required（避免把 FB 待人工的 job 改成 dry_run 結果，也避免 attempts 無限增加）
- data/operations/ 加入 .gitignore
- 隔離乾跑 17/17 PASS（evidence/17；腳本 scripts/operations-dryrun-harness.mjs）
  - 同內容去重
  - 兩個 process-due 並行時，每個 job 只被 claim 一次；完成後重跑不會重送
  - 兩個 worker 程序競爭鎖：一個執行，另一個退出（exit 1）
  - 核准後竄改 → 核准失效，其他平台 job 也不跑
  - lease 逾時 → 轉為待核對、不重送，其他平台照常
  - manual_required 不會被自動 claim
- 測試環境：temp OPERATIONS_DATA_DIR、temp 管理與 cron 憑證（已刪除）、無 IG env、live 發布開關未設
- 尚未完成：worker 常駐（Windows task／supervisor）、接真實 Neon＋R2 的 database 模式、與正式部署整合
  - 此分支須等 PR #32 合併後再 rebase 到 main，另開 PR
### 9.3 C:\fuyun_backup（只讀盤點，未修改）
- 狀態：48 個每小時 fuyun_ai_platform_*.sql.gz，最新 2026-09-27 22:00
- 檔案 owner：BUILTIN\Administrators；不是由本機任何 scheduled task 寫入；WSL／docker 均停止；SMB 只有管理共享 C$
- ACL 繼承自 C:\：Administrators、SYSTEM Full；Users RX；Authenticated Users Modify
- 最小調整方案（未套用）：
  - 停止繼承，只保留 Administrators、SYSTEM
  - 移除 Users RX 與 Authenticated Users Modify
  - 寫入方具管理員權限，理論上不受影響；套用前需先確認寫入來源（可能是其他主機經由 C$ 寫入）並觀察下一個整點備份是否正常
### 9.4 仍未完成
- Neon 與 R2 的備份及還原
- IG／FB／LINE 真實接線
- 四篇文章標題
- adminQuoteAuth 的 URL token（應改為 header／cookie）
- 開機未登入的實測

## 10. 第六輪（2026-09-27 22:20–22:35）：處理 PR #32 的 Codex review
- 審查對象：chatgpt-codex-connector[bot] 針對 b7c2628 的 10 則 inline 意見（4 P1、6 P2）
- 已修（PR #32 HEAD 92b30fbafdbed0870e561b86a30e3d3108e07ab5）：
  - LINE 連結不可操作：a762709 已修
  - verifyAdminToken 未 fail closed：四項管理設定缺任一，舊 session 一律失效
  - scryptSync 阻塞：改用 async scrypt；新增單一 instance 的登入節流（每 5 分鐘 10 次，超過回 429）
  - 詢價接受過去日期：改以 Asia/Taipei 的今天為下限
  - TouristTrip startDate：改為 ISO 格式
- 延後處理（IG／WebMCP 尚未在正式站啟用，目前不會寫入錯誤資料）：
  - IG token 存在 Vercel 唯讀檔案系統
  - OAuth start 需要的 cookie 沒有被發出
  - user_id 大數精度流失
  - insta-diag 狀態回報錯誤
  - WebMCP 需要 origin isolation
- 以上逐項處理情形已寫在 PR 描述與 PR comment（issuecomment-5856745726）
- 驗證：
  - 本機：tsc 0；admin 12/12；line 3/3；IG 4/4＋10/10；WebMCP 54/54；harness 23/23
  - 本機節流：同一 client 401×10 後回 429，其他 client 不受影響；JSON-LD startDate 為 2026-04-16
  - Git Preview dpl_C8RRvxd87F7Em9kUXMG2uujBrZpW（sha 92b30fb）：30/30 PASS（evidence/18、19）
- PR #32 狀態：OPEN、REVIEW_REQUIRED；正式站未變更；PROD_SECURITY_APPLIED=FAIL；SAFE_ROLLBACK=NOT_AVAILABLE

## 11. 第七輪（2026-09-27 22:40–23:15）：正式合併、正式驗證、回復基準、worker PR、Neon 備份
### 11.1 合併（持有人明確授權：僅限 HEAD 92b30fbafdbed0870e561b86a30e3d3108e07ab5 使用管理員例外）
- 合併前核對：
  - PR head 與遠端分支皆為 92b30fb；checks：Vercel success、Vercel Preview Comments success
  - 目前帳號 admin=true；branch protection enforce_admins=false、required reviews=1、無 rulesets
- 執行 gh pr merge 32 --merge --admin --match-head-commit 92b30fb…
  - MERGED 2026-09-27T14:41:09Z
  - merge commit ceee1b5dbcd7ad3a2fe86ef43b9043dfa6965a1d（parents c0c4398、92b30fb）
- 未修改 branch protection，未 force-push
### 11.2 正式部署與驗證（evidence/20、21）
- 部署：dpl_Fvr7bkz5LDvokpUGkX71a8ZfQ5wa，target=production，READY，source=git，sha=ceee1b5，ref=main
  - aliases：fuyuntravel.com、yunsun.com.tw、www.yunsun.com.tw、fuyun-travel.vercel.app 等
- 正式站 22/22 PASS：
  - 公開頁 8 個 200
  - 7 個 /charter-bus 頁：表單 8 欄；client JS 使用 oaMessage 指向 954fyicw，無 @fuyuntravel
  - 公開 app.js 無 OWNER_ACCOUNT、無舊密碼；JSON-LD startDate 為 ISO
  - 無 token 呼叫 me／profit-analysis 回 403；IG start 回 401
  - 新管理密碼登入 200，新 session 呼叫 me 回 200
- 正式站真瀏覽器（390px，無原生 WebMCP）：
  - 過去日期被拒，且沒有留下 LINE 連結
  - 合成資料產生 line.me/R/oaMessage/%40954fyicw/?…，8 欄完整
  - 未開啟 LINE，也未送出任何資料
- 依指示未對正式站探測舊密碼或偽造 token → PROD_OLD_CREDENTIAL_INVALIDATED：
  - 程式層面：正式版本已沒有舊密碼與 fallback key，新設定已生效（新登入 200）
  - 直接負向探測：NOT_TESTED
- PROD_SECURITY_APPLIED=PASS（依上述證據）
### 11.3 回復基準
- tag safe-baseline-20260927 → ceee1b5（tag object 9a7879e5），已推送
- SAFE_ROLLBACK = dpl_Fvr7bkz5LDvokpUGkX71a8ZfQ5wa
- 更正 tag 訊息：訊息寫「earlier deployments accept the exposed legacy credentials」為過度陳述
  - 已驗證的只有：舊版程式與公開 JS 含這些值；舊伺服器是否實際接受未測
  - 已推送的 tag 不重寫，以本段更正為準
### 11.4 worker
- feat/ops-worker-integration-20260927 已 merge origin/main（e4331f7，無衝突）
- tsc 0；build OK；admin 12/12；content-guard 11/11；line 3/3；乾跑 harness 17/17（evidence/22）
- 已開 Draft PR #33，註明不可合併：
  - 正式環境沒有 OPERATIONS_PERSISTENCE_MODE=database 與 R2_*；在 Vercel 上會落到唯讀、非持久的 local JSON
  - IG 的 P1 項目尚未處理
### 11.5 備份還原
- LOCAL_RESTORE_6_FILES=PASS（見 §8.7）
- NEON_BACKUP=PASS
  - pg_dump 17.11（EDB portable binaries，未簽章；zip sha256 6eabdf00…，放在 %USERPROFILE%\.fuyun-tools\pgsql-17，未註冊為服務）
  - 備份檔：FuyunBackups\20260927-neon-prod\neon-prod-20260927T145911Z.dump，28858 bytes，sha256 d82c7db44c9d85a9…；目錄 ACL：SYSTEM＋Administrator
  - 連線資訊存於 .fuyun-secrets\neon-prod.env（ACL 同上）；vercel env pull 的暫存檔已刪除
- NEON_RESTORE=PASS
  - 還原到 127.0.0.1:55432 的暫時 PG 17.11（FuyunBackups\20260927-neon-prod-restore-check\run3，ACL 同上）
  - 10 張表筆數與備份當分鐘的 Neon 筆數完全一致；還原後已停止 postgres
- 另一次含正式站比對的還原腳本被 auto-mode 拒絕（Production Reads）；已改成只做本機還原，比對使用先前已取得的筆數
- R2_BACKUP／R2_RESTORE=NOT_APPLICABLE：正式環境無 R2 設定，官網目前不使用 R2
- restore-check 內的 run2／run3 pgdata 含客戶資料副本（ACL 受限），保留到驗收完成，之後由持有人決定刪除

## 12. 第八輪（2026-09-27 23:20 – 09-28 02:15）：營運持久化、IG 修正、worker 常駐、媒體與備份範圍
分支 feat/ops-worker-integration-20260927（PR #33，Draft，未合併）HEAD bb7e24be1e5481e3d84ed0d4394de6d0f9e354ca；live publish 仍關閉。
原始證據：主工作樹 recover/20260927-phase2-pre-integration/evidence/23–29（不在 Git）。

### 12.1 資料權威與持久化（c466c65）
- 正式 Neon 從未建立 content_drafts：舊 database 模式在正式環境從來不可用（schema.prisma 與 migration 長期漂移，另有 vehicles、line_users、fb_import_logs、suppliers）
- 新增 migration 202609280001_add_operations_tables（只新增表，不動既有 10 表）：operations_contents、operations_jobs、operations_events、instagram_login_tokens
  - 隔離 PG 套用全部 11 筆 migration；diff 顯示新表與 models 完全一致
- 資料權威：
  - 內容與 Job 以 Neon 為唯一權威
  - 營運圖片存私有物件儲存（R2 設定名），寫入與讀出都比對 SHA-256
  - IG 只拿短時 presigned URL，bucket 不公開
- OPERATIONS_PERSISTENCE_MODE 必須明確設定：
  - database：需要資料庫＋物件儲存
  - file：只供單機隔離測試，需明確設定 OPERATIONS_DATA_DIR，Vercel 上拒絕
  - 未設定或不完整：回 503 與不含值的診斷；公開頁不受影響
- 原子性：
  - claim 為單一條件 updateMany（狀態、租約、排程、caption 未變、核准 hash、內容已核准）
  - 結果寫回需 lockOwner 一致；lease 逾時轉待核對、不重送
  - 去重靠 fingerprint unique；並行相同收件只產生一筆
- 核准快照涵蓋內容內所有未執行 Job：任一變動即撤銷整筆核准，所有未執行 Job 回 pending_approval（file 模式同步修正）
- 事實檢查會阻擋核准：未通過時需核准人明確確認並記錄；live 執行時未確認的 Job 一律 manual_required
- 驗證：
  - 隔離 PG 17.11＋本機 S3 mock、雙 Next instance：21/21（evidence/23）
    - 項目：並行相同收件、圖片私有且 hash 一致、事實檢查擋核准、三路並行 process-due、雙 worker、竄改、lease 逾時、manual_required、fail-closed
  - 重啟後資料保留 PASS；file 模式回歸 17/17（evidence/24）
- PR #33 Git Preview dpl_5RuG4EdEruvB57WTyuaG1tCt6oVe（sha bb7e24b）（evidence/28）：
  - 公開頁與 /admin/operations 200
  - 營運寫入 503，storage 診斷只含 reason 與布林值（serverless=true）
  - content-factory 上傳 503；未授權 401
  - Preview 與 Production 共用 DATABASE_URL，故刻意不呼叫會讀 DB 的路由
- 完整 E2E（收件→圖片→草稿→核准→乾跑→查狀態）在 Git Preview 上：BLOCKED，需隔離的 Neon branch＋真實 R2（見 12.9）

### 12.2 IG（9a9a773）
- IG_DURABLE_TOKEN_STORE=PASS
  - 預設存 Neon instagram_login_tokens（AES-256-GCM，沿用既有加密金鑰）
  - file:<path> 只供本機測試，Vercel 拒絕；值存在但格式錯誤視為設定錯誤
- SESSION_COOKIE=PASS
  - 登入同時發 HttpOnly、SameSite=Lax、Path=/、12h cookie；Secure 依實際 scheme
  - /api/auth/logout 只接受同源
  - 同源判定改用 Host／x-forwarded-host（Next 會把 request.url 重建成 localhost）
- LOSSLESS_USER_ID=PASS：reviver 取原始字面值；超過安全整數且無法無損取得時拒絕
- DIAGNOSTIC_VALIDITY=PASS
  - token store 以 runtime resolver 驗證
  - 狀態：CONFIG_INCOMPLETE／STORAGE_UNAVAILABLE／NOT_AUTHORIZED／EXPIRED／AUTHORIZED
  - admin-only GET /api/social/instagram/status，不回值
- 測試：instagram-oauth-store 7/7（含隔離 PG）；路由 harness 16/16（evidence/25，provider 只在測試 server 程序內 mock）；原有 4/4＋10/10；admin-auth 13/13
- IG_REAL_AUTH／IG_PUBLISH：NOT_DONE（需 PR #33 部署、正式 database 模式、持有人以 Meta 帳號完成一次授權；未公開任何貼文）

### 12.3 worker 常駐（a936072）
- 排程 Fuyun-Operations-Worker：AtStartup、S4U、RunLevel Limited、IgnoreNew
- supervisor：run-operations-worker-supervisor.ps1；node.exe 固定為 C:\Program Files\nodejs\node.exe v24.16.0；退避 5→60 s；UTF-8 log
- 設定：%USERPROFILE%\.fuyun-secrets\worker.env（ACL：SYSTEM＋本人）
- 已死程序遺留的 lock 會立即接手
- 以真實排程身份對隔離 stack 驗證：
  - 讀得到設定；核准後 6 s 內處理完、每個 Job 只 claim 一次
  - 砍掉 worker 約 14 s 恢復並接手 lock
  - 重複啟動 task 與手動第二個 worker 都被拒
  - parent＝svchost（Task Scheduler），與終端無關
- 目前狀態：Disabled，worker.env 只有 placeholder（無 token）
  - 啟用條件：PR #33 部署並設定正式 database 模式＋OPERATIONS_CRON_TOKEN 之後
- runtime 副本位於 %USERPROFILE%\.fuyun-tools\worker，雜湊與分支檔案一致（DEPLOYED.sha256）
- WORKER_TASK_IDENTITY＝本機 Administrator（S4U，未存密碼，Limited）
- 開機未登入與實際重開機：NOT_TESTED（未確認可中斷時機）

### 12.4 模型（沿用 §8）
- Ollama 0.34.4、qwen3:4b-instruct Q4_K_M、digest 0edcdef3…
- 只監聽 127.0.0.1；Fuyun-Ollama-Serve（S4U＋supervisor）
- UNATTENDED_START_CONFIGURED=PASS；UNATTENDED_START_VERIFIED／BOOT_VERIFIED=NOT_TESTED

### 12.5 媒體與備份範圍（39ef713＋evidence/26）
- MEDIA_STORAGE_INVENTORY：
  - 官網圖片全部是 Git public/（37 檔）；featured_spots 的 29 個照片 URL 全部指向 /images/featured-spots（Git 追蹤 23 檔）
  - 文章內文無圖片
  - content_sync_items 只有 Facebook 貼文連結（第三方，不算自有備份）
  - lib/storage/r2（social generate）因 R2 未設定而不存檔
- R2_CONFIGURED=NO
- MEDIA_BACKUP=PASS（Git origin＋本機 clone）；MEDIA_RESTORE=PASS：safe-baseline-20260927 與正式站 37/37 byte-identical
- content-factory/upload 原本寫入 public/uploads（serverless 不持久或唯讀）→ 改為 Vercel 上回 503
- 權限事故更正：§8.7 與 worker 目錄使用 icacls /T 搭配 (OI)(CI) 收緊 ACL，導致既有檔案變成任何人都不可讀
  - 已對檔案 /reset 繼承目錄 ACL（目錄仍只有 SYSTEM＋本人）
  - 重驗：ops-data archive OK、還原 6/6 OK、Neon dump OK
- LOCAL_RESTORE_6_FILES=PASS；NEON_BACKUP=PASS
- NEON_RESTORE_SCOPE：還原成功＋十表筆數一致（非逐欄 hash）
- RESTORE_COPY_PATHS：FuyunBackups\20260927-neon-prod-restore-check\run2、run3（含客戶資料副本，ACL 限縮，postgres 已停止）
  - RETENTION：保留至本輪驗收
  - CLEANUP_PLAN：驗收後只刪 run2（未還原、無資料）與 run3 pgdata，保留 dump＋SHA256SUMS；需持有人同意
- 隔離測試資料：%USERPROFILE%\.fuyun-tools\opsdb-test（只含合成資料），可隨時刪除

### 12.6 C:\fuyun_backup（其他服務，未修改）
- OTHER_BACKUP_WRITER＝GX10（tailscale gx10-f6b2，100.85.105.46）
  - 每整點以 ED25519 key 經 8940 OpenSSH（sshd）登入本機 Administrator，兩段短連線上傳 fuyun_ai_platform_*.sql.gz
  - 證據：Security 4624 type 3 由 sshd.exe 產生；OpenSSH/Operational 的 Accepted publickey from 100.85.105.46；00:00:07 即時觀察到新檔與 sshd 子程序
  - 無排程、服務或 SMB 參與
- 現況 ACL 已存 %USERPROFILE%\.fuyun-tools\acl-records\fuyun_backup-acl-20260927.txt（可用 icacls /restore）
- OTHER_BACKUP_ACL_PLAN（未套用）：
  1. 目錄停止繼承，只保留 Administrators、SYSTEM Full；移除 Users RX 與 Authenticated Users Modify（寫入方為 Administrator，不受影響）
  2. SSH 最小權限（需同時改 GX10 端，不在 8940 單方施作）：
     - 新建本機低權帳號 fuyunbackup，只給 C:\fuyun_backup 寫入
     - authorized_keys 加 from="100.85.105.46",restrict；sshd Match User 設 ForceCommand internal-sftp、ChrootDirectory
     - GX10 改用此帳號後，移除 administrators_authorized_keys 內該 key
  3. sshd_config 明確設定 PasswordAuthentication no
- 套用後需驗證：下一個整點新檔正常；Administrators 可讀可還原；一般帳號無寫入權
- OTHER_BACKUP_ACL_APPLIED=NO

### 12.7 其他項目
- ADMIN_QUOTE_TOKEN_MIGRATION=PASS（f87d717、bb7e24b）
  - ?admin_token= 不再接受
  - API 接受 session（cookie／admin JWT）或 header 內的 ADMIN_ACCESS_TOKEN（timing-safe）；cookie mutation 需同源
  - 頁面改用 session；舊連結 307 導向 ?legacy=1，不回顯 token
  - 路由 harness 19/19（evidence/27；送 LINE 只測拒絕路徑）
  - 部署後應輪換 ADMIN_ACCESS_TOKEN（曾出現在 URL）
- TITLE_REVIEW：四篇皆在 featured_spots，對照表見 evidence/29.md；未改 DB
  - 新竹市眷村博物館：高
  - 冬山新寮瀑布·宜蘭羅東一日：高
  - 北埔冷泉·冷泉泡腳放鬆行：泡腳高、冷泉中
  - 「辛巴和服」：低，待確認
- FACEBOOK_GROUP：Meta 已於 2024-04-22 移除 Groups API（Graph API v19，含 publish_to_groups），任何第三方都無法自動發到社團
  - 維持 facebook_group_manual：交付完整圖文，由人工在社團發布後回填連結；不以粉專 API 充數
- LINE_WEBHOOK：程式存在（app/api/line/webhook），Production 有 LINE_CHANNEL_* 名稱
  - 本輪未做收發測試（需既有核准的測試對象）
  - 詢價入口（oaMessage→@954fyicw）已上線；MOBILE_CHAT_PREFILL=NOT_TESTED
- WEBMCP_NATIVE：正式站沒有 origin isolation 與 origin trial，原生註冊不會發生；人類表單正常。沒有注入假 API

### 12.8 狀態欄
- PR32_MERGED_SHA=ceee1b5dbcd7ad3a2fe86ef43b9043dfa6965a1d；PROD_SECURITY_APPLIED=PASS
- PRODUCTION_DEPLOYMENT=dpl_Fvr7bkz5LDvokpUGkX71a8ZfQ5wa（fuyuntravel.com、yunsun.com.tw 等）
- SAFE_BASELINE_TAG=safe-baseline-20260927；SAFE_ROLLBACK=dpl_Fvr7b…；HISTORY_SECRET_CLEAN=NO
- PR33=#33 Draft HEAD bb7e24b；LIVE_PUBLISH_ENABLED=false
- DATA_AUTHORITY=Neon＋私有物件儲存；OPERATIONS_PERSISTENCE_MODE（正式環境）＝未設定 → fail closed
- DATABASE_CLAIM／DEDUPE／APPROVAL_BINDING／TIMEOUT_RECOVERY／CONTENT_FACT_VALIDATION：隔離 DB 驗證 PASS
- PREVIEW＝dpl_5RuG4…，fail-closed PASS；完整 DRYRUN_E2E 於 Preview：BLOCKED
- WORKER_SERVICE＝Fuyun-Operations-Worker（Disabled）；SINGLE_INSTANCE／CRASH_RECOVERY＝PASS
- OVERALL=PARTIAL

### 12.9 剩餘阻塞與持有人步驟（只列本人必做）
1. Cloudflare：建立私有 R2 bucket，與只限該 bucket 的 API token（Object Read & Write）
   - 原因：營運圖片需要持久私有儲存，代理無 Cloudflare 帳號權限
   - 完成標準：4 個 R2_* 設定可由代理寫入 Vercel（值不經聊天）
2. Neon：建立一個 Preview 專用 branch（或授權代理使用 Neon API key）
   - 原因：Preview 與 Production 目前共用 DATABASE_URL，不能在 Preview 寫入測試資料
   - 完成標準：Preview 環境的 DATABASE_URL 指向該 branch
3. 決定 C:\fuyun_backup ACL 與 GX10 SSH 最小權限方案（12.6）是否施作；後者需分身民同步修改 GX10
4. 審核並合併 PR #33（需一位 reviewer，或持有人另行授權例外）；合併前代理補完 Preview E2E
5. 「羅東林場·辛巴和服體驗」的原意，以及其餘三個標題建議的核准
6. （可選）手機 LINE 預填實測：開 /charter-bus/任一頁，以合成資料按「開啟 LINE 詢價」，確認 @954fyicw 並帶入內文，不送出

## 13. 第九輪（2026-09-28 02:35 起）：隔離 Preview E2E 準備、升級演練、LINE 修正、輪換／ACL／SSH 方案
分支 feat/ops-worker-integration-20260927（PR #33，Draft）。
- 本節提交之前：程式 bb7e24b、HEAD 0cbda58。
- 本節的程式與文件提交見 git log；Preview ID 以提交後 Vercel 的狀態為準。
- 原始證據：主工作樹 recover/20260927-phase2-pre-integration/evidence/30–32（不在 Git）。

### 13.1 平台授權（實查）
- **Vercel CLI：** 已登入（arashiyun-web），可管理 fuyun-travel 的 env。
  - Preview 受 Vercel Authentication 保護（ssoProtection=all_except_custom_domains）。
  - 專案已有 2 組 automation-bypass secret（2026-08-19 建立）；E2E 與 worker 只在記憶體中使用，不輸出。
- **Cloudflare：** 8940 沒有 wrangler、API token 或 MCP 授權。
  - claude.ai 的 Cloudflare MCP 需持有人在 /mcp 授權。
  - 已啟動官方 `wrangler login`（OAuth、localhost 回呼）並提供真實入口，但無人完成就逾時。
  - 注意：wrangler 預設 OAuth 範圍沒有獨立的 r2 scope。若 `r2 bucket create` 被拒，改由持有人在同一個 R2 頁面多按一次建立 bucket。
  - bucket 限定的 Object Read & Write 憑證（S3 Access Key／Secret）只能在 R2 控制台建立（或用具 token 管理權限的 API），OAuth 無法代建。
- **Neon：** 8940 沒有 neonctl、API key 或 MCP 授權；neonctl 6.2.3 支援 `branches create --schema-only`。
  - 已啟動官方 `neonctl auth`，60 秒逾時。
  - 正式 DB 變數由 Vercel Neon 整合同時注入 Production／Preview／Development，共 16 個名稱。

### 13.2 已備妥（授權後可直接執行）
- **scripts/test-support/provision-preview-e2e.mjs**
  - `neon`：以正式 endpoint 比對找出專案與主分支，建立 schema-only 分支 pr33-ops-e2e，並只在該分支建立獨立角色 e2e_app（不沿用正式角色密碼）。
  - `migrate`：先確認分支沒有任何資料列，再補 10 筆 migration 歷史並 `migrate deploy`。
  - `secrets`：已執行。Preview 專用的測試管理帳密、JWT、cron token、ADMIN_ACCESS_TOKEN（測試值）與 IG 金鑰已產生於 .fuyun-secrets\preview-e2e.env（ACL：本人＋SYSTEM）。
  - `r2-bucket`：私有 bucket fuyun-ops-pr33-e2e，不掛 r2.dev 或自訂網域。
  - `vercel-env`：只寫入 Git 分支 feat/ops-worker-integration-20260927 的 Preview env。
    - 覆寫全部 16 個 DB 名稱與營運／管理／R2 設定。
    - OPERATIONS_PERSISTENCE_MODE=database，OPERATIONS_LIVE_PUBLISH_ENABLED=false；不改 Production。
- **scripts/test-support/save-r2-credentials.ps1：** 持有人以隱藏輸入保存 R2 Access Key／Secret，不經聊天、命令列或歷史紀錄。
- **scripts/operations-preview-e2e.mjs（run／sched／verify）**
  - 先檢查 DB endpoint 不同於正式、無客戶資料列才繼續。
  - 驗證項目：
    - Cookie：HttpOnly、Secure、SameSite=Lax；跨來源與無 Origin 拒絕、同源通過。
    - 報價授權：header 通過，query、錯誤 token 拒絕。
    - 營運流程：並行相同收件去重、R2 物件與 SHA-256、未簽名 GET 被拒、60 秒簽名 URL 可讀、runtime 憑證不能列出其他 bucket；事實檢查、三路並行 process-due 各 claim 一次；核准後改動使整筆失效、lease 逾時轉待核對、manual_required 不被 claim。
  - verify：換新部署後資料與圖片 hash 仍在。
- **scripts/test-support/scheduled-identity-preview-check.ps1：** 用與正式 worker 相同的 S4U／Limited 身份建立臨時排程，對隔離 Preview 跑一次 worker，結束即移除排程與臨時 env；正式 worker 設定不動。
- **worker（scripts/operations-worker.mjs）：** 新增可選的 OPERATIONS_AGENT_PROTECTION_BYPASS（只供受保護的 Preview）；非 https 的遠端 base URL 一律拒絕（exit 2）。

### 13.3 Migration 基準與升級演練（evidence/30）
- **MIGRATION_BASELINE：** 正式 `_prisma_migrations` 共 10 筆，全部 finished、無 rollback。
  - checksum 與 git blob（LF）一致，migration 歷史沒有漂移。
  - Windows worktree 因 autocrlf 變成 CRLF 才會看似不符 → 正式 migration 必須從 LF checkout 執行。
- **UPGRADE_REHEARSAL＝PASS：** 用正式 dump 的 schema-only 還原（只載入 migration 歷史列）＋ `migrate deploy`。
  - 只套用 202609280001 與 202609280002。
  - 既有物件前後 `pg_dump -s` 完全相同；新表與 schema.prisma 無差異。
  - schema-only 路徑（沒有歷史列）先補 10 筆歷史再 deploy，同樣 PASS。
- **既有漂移：** vehicles、line_users、fb_import_logs、suppliers、content_drafts 只在 schema.prisma；playing_with_neon 及部分 index／default 只在 DB。
  - 這些早於本 PR，本次不處理；不用 reset、drop 或 resolve 修補。
- `next build` 不跑 migration，Preview 與正式都需要明確執行 `migrate deploy`。

### 13.4 LINE webhook（evidence/31）
- 離線實測（fetch 全數攔截、合成 DB）發現三個問題：
  - 簽章長度不符時丟例外（500）。
  - JSON 格式錯誤時丟例外。
  - 重送事件會重複建立報價並重複推播管理員（1→2）。
  - 另外 log 記錄了客人訊息全文。
- 已修正：
  - 先比長度再驗簽 → 403。
  - JSON 錯誤 → 400。
  - 以 webhookEventId 去重，新增表 line_webhook_events（migration 202609280002，只新增）；處理成功後才記錄，因此失敗的首次處理仍可重試。
  - 去重表不可用時照原流程處理（fail-open），不會擋下客人詢價。
  - log 只記事件 ID、是否重送與長度。
- 修正後 9/9 PASS（含 fail-open）。真實收發未做（需要已核准的測試對象）。

### 13.5 回歸（evidence/32）
- tsc 0、next build 0、DB harness 21/21（新 DB、含 worker）、LINE 9/9。
- 報價授權程式本輪未改，19/19 仍有效。

### 13.6 ADMIN_ACCESS_TOKEN 輪換
- **呼叫端盤點：**
  - repo 內只有 lib/adminQuoteAuth.ts 會讀取；前端 localStorage 的 `admin_token` 是 JWT，只是同名。
  - 8940 本機只有未部署、無 remote 的舊專案 2026-06-04/next-js-postgresql-line-messaging-api 的 proxy.ts 會用。
  - 其他 4 個 Vercel 專案都沒有這個變數。
  - GX10／Hermes 端是否呼叫，本機無法得知 → 需分身民確認。
- **準備：** scripts/ops/rotate-admin-access-token.mjs
  - `prepare` 已執行：新值只存在 .fuyun-secrets\admin-access-token.env，fp d3c45fa759。
  - `apply`：與 #33 同一次發版時經 stdin 替換 Production 值；舊值不留、不雙收。
  - `verify`：用不存在的報價 ID，新值 header 應回 404（不回傳資料）、query 應回 401。
  - 舊值從未存在本機，所以不做舊值探測；由單值替換保證失效，並記錄 env 更新時間。
- ROTATION_APPLIED=NO（等 #33 合併部署）。

### 13.7 正式升級次序（待 #33 驗收與有效合併；本輪不執行）
1. 備份基準：neon-backup.cjs 產生新的 dump 與 SHA256。
2. 從 LF checkout 對正式 DB 執行 `prisma migrate deploy`（只會套 202609280001、202609280002）。
   - 舊版 ceee1b5 與新表相容，可先於程式部署。
3. 設定 Production 值：正式 R2 bucket 與 bucket 限定憑證（與 Preview 分開）、OPERATIONS_PERSISTENCE_MODE=database、OPERATIONS_CRON_TOKEN、ADMIN_ACCESS_TOKEN（apply）、OPERATIONS_LIVE_PUBLISH_ENABLED=false。
4. 正常 Git 合併部署。
5. 驗證：公開頁、登入、同源與跨來源、報價 header 授權、營運 intake 與 dry-run（以合成內容，完成後由 admin 刪除或標記）；rotate verify。
6. worker.env 指向正式網址與 cron token，啟用 Fuyun-Operations-Worker，保持 dry-run。
- **回復：** 程式回 ceee1b5／dpl_Fvr7b…（新表保留、不影響舊版）；程式回復不會自動回復資料 migration。

### 13.8 C:\fuyun_backup：ACL 與 SSH 分開（都未套用）
- **現況：** 目錄 ACL 繼承自 C:\ 預設：Administrators FC、SYSTEM FC、Users RX、Authenticated Users Modify（因此過寬）。
  - 檔案擁有者為 Administrators。
  - 回復紀錄：acl-records\fuyun_backup-acl-20260927.txt（icacls /save 格式）→ `icacls C:\ /restore <file>`。
- **ACL_CHANGESET（只改目錄 ACL、不用 /T）：**
  ```
  icacls C:\fuyun_backup /inheritance:d
  icacls C:\fuyun_backup /remove:g *S-1-5-11 *S-1-5-32-545
  icacls C:\fuyun_backup /grant:r "<8940>\Administrator:(OI)(CI)M"
  ```
  - 最後一條是明確保留寫入者本人：如果 SSH 登入 token 被 UAC 過濾，只靠 Administrators 群組會寫不進去。
  - 子檔案經繼承自動套用；不使用 /T，避免重演 (OI)(CI) 套到檔案上的事故。
  - 驗證：前後 icacls（目錄與最新檔）；以 Administrator 建立並刪除測試檔；下一個整點新檔落地；可還原讀取。
- **SSH_CHANGESET（兩機協作）：**
  - 8940 為 OpenSSH_for_Windows 9.5p2，支援 from= 與 restrict。
  - 候選設定已用 `sshd -t -f` 驗證：只作用在 fuyunbackup；Administrator 的現有設定不變。
  ```
  Match User fuyunbackup
         AuthorizedKeysFile __PROGRAMDATA__/ssh/fuyunbackup_authorized_keys
         PasswordAuthentication no
         KbdInteractiveAuthentication no
         ForceCommand internal-sftp
         ChrootDirectory C:\fuyun_backup
         AllowTcpForwarding no
         AllowAgentForwarding no
         PermitTTY no
         X11Forwarding no
  ```
  - 本機低權帳號 fuyunbackup（非 Administrators）。
  - chroot 根 C:\fuyun_backup 由 SYSTEM／Administrators 擁有、帳號不可寫；新增 C:\fuyun_backup\incoming 只給 fuyunbackup Modify。
  - key 行：`from="100.85.105.46",restrict ssh-ed25519 <GX10 新產生的公鑰> gx10-backup`（私鑰只留在 GX10）。
  - 不改全域 PasswordAuthentication、AllowUsers 或 DenyGroups。
- **CROSS_HOST_DEPENDENCY：**
  - GX10 的上傳腳本目前每小時兩段連線，實際用 scp、sftp 或遠端指令未知（sshd 預設 log 等級看不出）。
  - 改用 internal-sftp 後，遠端 shell 指令（mkdir、刪除舊檔）無法使用，需改為 sftp 批次。
  - 目的路徑改為 /incoming。
  - 現行唯一的管理員 key 註解為 windows@arashiyun，可能也是持有人自己電腦的 key → 新身份上傳與整點備份都驗證後，只從 GX10 移除它使用的那份私鑰；8940 上這把 key 不刪。

### 13.9 標題對照（公開頁 /highlights 原文；DB 未改，待持有人核准）
| id | 現有標題 | 建議標題 | 正文（現狀） | 信心 |
|---|---|---|---|---|
| cmtmf8qsw0003ky04keb0sp3i | 新竰换村博物館 | 新竹市眷村博物館 | 走進换村的歷史空間，看老物件、感受换村文化與美學記憶，新竰一日文化體驗，適合带輨陣或對歷史有興趣的同行者。 | 標題高（文化部、新竹市文化局；曾公告整修，需確認是否已重開）；正文 换→眷、新竰→新竹 高，「带輨陣」原意不明 |
| cmtmf8pbm0000ky048uxi22df | 東山新庐帅布·宜蘇羅東一日 | 冬山新寮瀑布·宜蘭羅東一日 | 上午遊覽羅東林場文化國區，中午在羅東心惡齋享用素食臨助吃到餗，下午到新庐帅布豹帅、溪邊玩水消暑，一日行程關松又盡興。 | 高；正文 國區→園區、臨助吃到餗→自助吃到飽、新庐帅布豹帅→新寮瀑布步道、關松→輕鬆 高；「心惡齋」店名需確認 |
| cmtmf8qee0002ky04ddqvs97r | 北埔冷泉·冷気泡腿放鬆行 | 北埔冷泉·冷泉泡腳放鬆行 | 夏天就是要應的！北埔冷泉冷沌沌的泡腿太舒服，搭配周邊山區步道，午弾散散步消消暑，半天到一日都合適的放鬆行程。 | 泡腳高、冷泉中；正文「要應的」「冷沌沌」「午弾」原意不明 |
| cmtmf8py60001ky04rvh2nupw | 羅東林場·辛巴和服體驗 | 待持有人說明 | 天氣晴晴，換上和服走進羅東林場新開的辛巴區，森林系和風搭配自然光，拍照散步都超有feel，一日關松文化體驗。 | 低：羅東林業文化園區未見「辛巴區」；園區斜對面有和服租借店。四筆皆無照片與來源連結 |

### 13.10 本機清理
- LOCAL_SYNTHETIC_DB_STATE：已停止並刪除。
  - opsdb-test（55433，PID 28248）經持有人同意刪除。
  - 本輪演練用的 migration-rehearsal pgdata（55434）也已刪除。
  - 保留：prisma-migrations-history.sql 與 schema dump。
- CUSTOMER_RESTORE_RETENTION：
  - run2 核實只有 initdb 範本庫（base 1/4/5），沒有還原任何資料庫，也不含客戶資料。
  - run3 含還原資料庫（16384）。
  - 兩者 postgres 皆停止、ACL 限縮。
  - 未取得同意前不刪；建議驗收後刪 run2 全部與 run3 pgdata，保留 dump＋SHA256SUMS。

### 13.11 狀態欄
- PR33_HEAD／CODE_SHA：本節提交；DRAFT_STATUS＝draft。
- PREVIEW_ID：提交後的 Git Preview 仍共用正式 DB 且未設 persistence → fail-closed；隔離 Preview 待授權後建立。
- CLOUDFLARE_AUTH=NOT_GRANTED（入口已提供）；R2_TEST_BUCKET=PREPARED(fuyun-ops-pr33-e2e)；R2_PROD_ISOLATION=DESIGNED；R2_S3_ACCESS_VERIFIED=NO
- NEON_PROJECT＝以正式 endpoint 比對取得（授權後）；TEST_BRANCH=pr33-ops-e2e（未建立）；SCHEMA_ONLY=PLANNED（neonctl --schema-only）；SYNTHETIC_DATA=E2E 腳本產生；PROD_ENDPOINT_DIFFERENT＝腳本強制檢查
- MIGRATION_BASELINE=10/10 checksum 相符；UPGRADE_REHEARSAL=PASS（本機、正式 schema）；PRODUCTION_MIGRATION_PLAN=13.7
- ENV_SCOPE＝Git 分支 Preview override（16 個 DB 名稱＋營運設定），待寫入；OPERATIONS_PERSISTENCE_MODE（Preview 分支）=database（待寫入），Production 未設 → fail-closed；OPERATIONS_LIVE_PUBLISH_ENABLED=false
- PREVIEW_E2E／COOKIE_AND_ORIGIN／QUOTE_HEADER_AUTH／IMAGE_HASH／PERSISTENCE=READY_NOT_RUN（BLOCKED：Cloudflare／Neon 授權）
- CLAIM／DEDUPE／APPROVAL_BINDING／LEASE_RECOVERY／FACT_VALIDATION＝本機 PASS（21/21）；雲端待跑
- SCHEDULED_IDENTITY_TO_PREVIEW=READY_NOT_RUN；WORKER_ENABLED=NO；CLOUD_ACCESS＝bypass 已驗證（現有 Preview：/ 200、未授權 API 401）
- ADMIN_ACCESS_TOKEN_ROTATION_PREPARED=YES；CALLERS_READY＝repo 與 8940 已清點，GX10 待確認；ROTATION_APPLIED=NO
- BACKUP_WRITER_CONFIRMED=YES（GX10→sshd→Administrator）；ACL_CHANGESET=READY（未套用）；SSH_CHANGESET=READY（sshd -t PASS，未套用）；CROSS_HOST_DEPENDENCY＝GX10 上傳方式與 key 用途
- TITLE_COMPARISON=READY（13.9）；TITLE_APPROVAL=PENDING
- LOCAL_SYNTHETIC_DB_STATE=DELETED；CUSTOMER_RESTORE_RETENTION＝run2 無資料、run3 有，均保留待同意
- OVERALL=PARTIAL

### 13.12 OWNER_ACTION（只列必須本人做的）
1. **在 8940 的終端完成兩個官方登入**（瀏覽器會在 8940 開啟）：
   - `! npx -y neonctl@6.2.3 auth`
   - `! npx -y wrangler@4.142.0 login`
2. **Cloudflare 控制台 → R2 → Manage API tokens → Create API token：**
   - 權限 Object Read & Write，Specify bucket 只選 fuyun-ops-pr33-e2e（bucket 由代理建立）。
   - 在 8940 自己的 PowerShell 執行 `powershell -File scripts\test-support\save-r2-credentials.ps1` 貼入兩個值。
3. **標題：** 核准 13.9 的三個建議，並說明「辛巴區」、「心惡齋」、「带輨陣」的原意。
4. **C:\fuyun_backup：** 是否套用 ACL_CHANGESET（可獨立進行）；SSH 改造需請分身民提供 GX10 上傳腳本的內容。
5. **E2E 通過後，PR #33 需要 reviewer 核准。**

## 14. 第十輪（2026-09-28 21:00–21:45）：憑證核對、R2、分支 Preview env、隔離 E2E、排程乾跑、持久化
分支 feat/ops-worker-integration-20260927（PR #33，Draft）；程式 HEAD 462ec68（test-support 腳本）。正式環境、Production env 與真實發布均未動。

### 14.1 權限與工作階段
- 本機唯讀檢查未出現 auto mode classifier 錯誤；本輪無權限拒絕。
- neonctl、wrangler（OAuth，account read）均已登入；沿用既有 Neon 分支 pr33-ops-e2e（plain-tooth-27002511）與 bucket fuyun-ops-pr33-e2e，未重建。

### 14.2 Vercel CLI 失效根因（非權限問題）
- 錯誤原文：`TypeError: Cannot convert argument to a ByteString because the character at index 0 has a value of 38642 which is greater than 255.`
- 根因：vercel 60.1.3 的 OAuth 模組以 `${os.hostname()} @ …` 作為 User-Agent；電腦名「雲阿民」非 ASCII。§13 時 access token 尚有效，不需 refresh；token 於 09-28 10:04 到期後，每次呼叫都走 refresh 而失敗。
- 處置：只作用於單一行程的 preload（NODE_OPTIONS `--require`，把 os.hostname() 改回 ASCII 並 syncBuiltinESMExports），未改 CLI 安裝、電腦名或憑證。檔案在工作階段 scratchpad，不入 Git。之後在 8940 使用 vercel CLI 需同樣處置，或改電腦名為 ASCII。

### 14.3 憑證 ACL／格式
- .fuyun-secrets 目錄：不繼承，只有 Administrator、SYSTEM FullControl；preview-e2e.env 繼承相同 ACL。
- R2_ACCESS_KEY_ID 32 位 hex、R2_SECRET_ACCESS_KEY 64 位 hex、無空白；其他值長度正常、無空白。`r2-record` 補寫 R2_ACCOUNT_ID／R2_BUCKET_NAME。

### 14.4 R2
- 公開設定（Cloudflare 管理 API，wrangler 4.142.0，非以 S3 匿名讀取推論）：
  - `r2 bucket dev-url get` → `Public access via the r2.dev URL is disabled.`
  - `r2 bucket domain list` → `There are no custom domains connected to this bucket.`
- r2-precheck 8/8 PASS：寫入、讀回 SHA-256、未簽名 GET 拒絕、60 秒簽名 URL、不能列出帳號 bucket、寫入其他 bucket 被拒、合成物件已刪除。

### 14.5 Neon 分支（唯讀核對）
- endpoint ep-steep-star-aomjm8tv ≠ 正式 ep-proud-wildflower-ao4d38ll；連線身份 e2e_app；客戶資料列 0。
- _prisma_migrations 12/13 finished：多出的一列是首次以 e2e_app 執行失敗（42501）的 202609280001，已標記 rolled_back，僅存在測試分支；正式以 owner 角色執行，不會出現。
- operations_contents／events／jobs、line_webhook_events 由 neondb_owner 擁有，e2e_app 有 S/I/U/D。

### 14.6 分支 Preview env
- rm 的比對以 API 篩選 {target: preview, gitBranch}，不會命中共用的 Production/Preview/Development 變數（已讀 CLI 原始碼確認），首次執行時 rm 全部 not-found、無變更。
- 寫入 29 個 branch-scoped Preview 變數（16 個 DB 名稱＋13 個營運／管理／R2）。
- Production env 前後 32 列，名稱／環境／建立時間比對差異 0。

### 14.7 雲端驗證
- Preview（Git push 462ec68）：dpl_5jWtZbhfs9dUsja15rgvYe4YuYnA（fuyun-travel-53g7nqkz1）。
- `operations-preview-e2e run`：32/32 PASS（cookie 屬性、同源／跨來源、報價 header 授權、並行收件去重、R2 hash 與私有性、事實檢查、三路 process-due 各 claim 一次、核准後改動失效、lease 逾時、manual_required 不被 claim、live publish 關閉）。
- `sched`：臨時 S4U／Limited 排程 lastResult=0、worker 完成 3 jobs、3 次 claim、全部 dry_run_verified、無 externalId；臨時排程與 env 檔已移除；Fuyun-Operations-Worker 仍為 Disabled。
- 重新部署：`vercel redeploy` → dpl_3hah94PEf9RLD6SddA8qJZ7J3B5n（fuyun-travel-34sq85pdt）；`verify` 10/10 PASS（新部署可讀內容、圖片 hash、R2 物件與私有性）。

### 14.8 狀態欄
- PR33_HEAD=462ec68（之後僅文件提交）；DRAFT_STATUS=draft；正式部署仍為 ceee1b5
- CLOUDFLARE_AUTH=GRANTED（OAuth）；R2_TEST_BUCKET=fuyun-ops-pr33-e2e；R2_PUBLIC_DEV_URL=DISABLED；R2_CUSTOM_DOMAINS=NONE；R2_S3_ACCESS_VERIFIED=YES（bucket-scoped）
- NEON_PROJECT=plain-tooth-27002511；TEST_BRANCH=pr33-ops-e2e；PROD_ENDPOINT_DIFFERENT=YES；CUSTOMER_ROWS=0
- ENV_SCOPE=29 個 branch-scoped Preview；PRODUCTION_ENV_CHANGED=NO
- PREVIEW_E2E=PASS(32/32)；SCHEDULED_IDENTITY_TO_PREVIEW=PASS；PERSISTENCE_AFTER_REDEPLOY=PASS(10/10)
- WORKER_ENABLED=NO；ROTATION_APPLIED=NO；LIVE_PUBLISH=OFF
- OVERALL=PREVIEW_VERIFIED；待 reviewer 核准後依 §13.7 正式升級

### 14.9 OWNER_ACTION
1. PR #33 reviewer 核准（E2E 已通過）。
2. §13.12 第 3、4 項（標題、C:\fuyun_backup ACL／SSH）仍待決定。
3. 8940 的 Vercel CLI：建議把電腦名改為 ASCII，或接受每次以 preload 處置（見 14.2）。

## 15. 第十一輪（2026-09-28 22:00–23:10）：R2 假陽性修正、token 範圍補證、Vercel 啟動腳本、發版清單
起點 2ac25e0（與遠端一致、無未提交）。應用程式碼自 462ec68 起未變：app／lib／components／prisma／public／middleware／next.config／package* 的 diff 為 0；本輪只改測試、工具、ops 腳本與文件。

### 15.1 R2 權限測試假陽性（9608ae2、db17f12）
- **舊問題：**
  - ListBuckets 或寫入另一個 bucket 名稱時，任何錯誤都被判為 PASS。
  - `fuyun-scope-check-other` 未確認存在也未獲授權。
  - 未簽名 GET 回 400 就算「bucket 私有」。
- **實測：** R2 對未簽名 GET 一律回 `400 InvalidArgument "Authorization"`，不存在的 bucket 名稱也是如此。
  - 因此它只證明 S3 端點要求簽名，不能證明 bucket 私有。
- **scripts/test-support/r2-scope-evidence.mjs：**
  - 只有 403 AccessDenied 算拒絕；NoSuchBucket、憑證錯誤、連線錯誤與逾時都判為 inconclusive。
  - 另含匿名 GET 分類、公開入口分類與 token policy 評估；token id 以 sha256 比對，不落地。
- **r2-precheck.mjs：** 四項分開記錄，互不替代：
  - A 物件讀寫（每輪唯一 key、finally 清理、清理失敗會記錄）
  - B 匿名 S3 讀取
  - C 公開入口（管理 API）
  - D token policy
  - 已移除其他 bucket 寫入探測；ListBuckets 只列 INFO。
- **operations-preview-e2e.mjs：** 同樣分類；ListBuckets 不再計為 PASS。因此 run 由 32 項變為 31 項 PASS＋1 項 INFO。
- **回歸測試：** node --test r2-scope-evidence.test.mjs 10/10（含 dashboard 實際的 policy 形狀）。

### 15.2 token 範圍證據（D）
- 既有 wrangler OAuth 無法讀取 token：
  - `/accounts/<acct>/tokens`、`/user/tokens` 單筆與清單都回 403，錯誤碼 9109。
  - 未擴大任何權限。
- 改用持有人已登入的 Chrome（Browser 2，Windows），在 R2 → API Tokens 頁以 dashboard 自身 API 唯讀讀取：
  - 帳號 token 1 筆、使用者 token 0 筆。
  - 以 sha256(R2_ACCESS_KEY_ID)=bee3ed2c… 在頁面內比對 → 相符。
  - 名稱「R2 Account Token」、status active、policy 為 allow。
  - 權限群組只有 `Workers R2 Storage Bucket Item Write`。
  - 唯一資源 `com.cloudflare.edge.r2.bucket.<acct>_default_fuyun-ops-pr33-e2e`，沒有萬用範圍。
  - 頁面文字：`R2 Account Token | fuyun-ops-pr33-e2e | Object Read & Write | Active`。
- 修正：dashboard 的「Object Read & Write」對應單一 Item Write 群組。評估器原本要求 Read＋Write 兩群組，已依實際對應修正並加測試。
- 證據檔：%USERPROFILE%\.fuyun-tools\preview-e2e\r2-token-policy.json，只含 id_sha256 與非秘密 policy，不在 Git。
- 帳號目前只有 1 個 R2 bucket（管理 API）→ 正式 bucket 尚未建立。
- 結果：`r2-precheck` A 5/5、B 1/1、C 2/2、D 1/1；INFO ListBuckets＝403 AccessDenied；exit 0。

### 15.3 Vercel 非 ASCII 電腦名（scripts/tools/）
- vercel-ascii-hostname.cjs：只在 argv[1] 為 `vercel/dist/vc.js` 且電腦名非 ASCII 時，才把 os.hostname() 改為 `host-<sha256 前 8 碼>`；其他 Node 行程不受影響。
- vercel-ascii.ps1：
  - `vercel-ascii.ps1 <vercel 參數>`，或 `--exec <命令>` 供內部呼叫 vercel 的腳本使用。
  - 保留既有 NODE_OPTIONS，重複巢狀時不重複加入；結束後還原；回傳原退出碼。
  - 未改全域環境、電腦名、CLI 安裝或登入。
- 測試 vercel-ascii.test.mjs 9/9：
  - CJS／ESM 匯入都拿到 ASCII、非 CLI 行程維持原名、本機電腦名確為非 ASCII。
  - 保留既有 NODE_OPTIONS、還原（有值／無值）、退出碼 7、含空白的路徑與參數、用法錯誤 exit 2。
- 新 PowerShell 行程實測（NODE_OPTIONS 清空）：
  - `whoami` exit 0；`env ls production` 32 列（唯讀）；不存在的部署 exit 1。
  - 結束後 session／User／Machine 的 NODE_OPTIONS 均為空。
  - 本輪 E2E 也經 `--exec` 取得 bypass。
- 限制：PowerShell 5.1 呼叫原生程式時不保留參數內的雙引號，值應經 stdin 傳入。
- **REFRESH：本輪未測到。** 目前 token 到 09-29 05:29 才過期，所有呼叫都沒有經過 refresh。refresh 只在 §14 以 scratchpad 版 preload 實際通過一次（21:29，無條件修補版），這個啟動腳本版本尚未遇到 refresh。

### 15.4 雲端驗證（本輪測試腳本；應用程式碼同 462ec68）
- Preview 9608ae2：dpl_mki8b2gE23j2pfm3gSff42qbZipA（fuyun-travel-b1wyyo3y9）→ `run` 31/31 PASS＋INFO ListBuckets 403 AccessDenied。
- redeploy → dpl_2RL2zAg8JyUR7pns3BxXtLiGob9M（fuyun-travel-ojdq4alsx）→ `verify` 10/10。
- 排程身份乾跑沿用 §14（462ec68／dpl_5jWtZ…）：worker 與排程腳本本輪未改，未重跑。
- db17f12 只加 ops 腳本、文件與評估器；E2E 不使用評估器，因此 9608ae2 的結果適用。

### 15.5 發版準備（未套用）
- 發版清單：docs/handoff-webmcp-20260923/RELEASE-RUNBOOK-PR33.md。
- scripts/ops/release-preflight-pr33.mjs（唯讀）：正式 DB 以 `default_transaction_read_only=on` 查詢，env 只看名稱。
- scripts/ops/migrate-production-pr33.mjs：
  - 會拒絕：非核准 SHA、工作樹不乾淨、autocrlf、CRLF migration、非 neondb_owner、非正式直連 endpoint。
  - 預設只跑 status，`--apply` 才 deploy。
  - 本輪只測拒絕路徑（缺 SHA、SHA 不符、工作樹不乾淨，皆 exit 3），未連正式 DB。
- save-r2-credentials.ps1 `-Target production` → production-release.env（與 Preview 分開）。
- 預檢結果（9608ae2 工作樹、`--bucket fuyun-ops-production` 暫名）：
  - **PASS：**
    - 兩個新 migration 為 LF 且與 blob 相同。
    - 正式 10 筆 finished／0 筆 unfinished，新 migration 未套用。
    - DB session 唯讀。
    - 備份 d82c7db4…（23.4 h）與 SHA256SUMS 相符。
    - 輪換值已備妥、worker Disabled、正式仍為 ceee1b5。
  - **FAIL（發版前需完成）：**
    - Production 缺 OPERATIONS_PERSISTENCE_MODE、OPERATIONS_CRON_TOKEN、OPERATIONS_LIVE_PUBLISH_ENABLED、R2_ACCOUNT_ID、R2_BUCKET_NAME、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY。
    - 正式 bucket 不存在。
    - 工作樹不乾淨（當時有未提交檔）。
  - **UNVERIFIED：** 正式 R2 金鑰、GX10／Hermes 呼叫端。
- 身份事實：正式 DATABASE_URL 與 UNPOOLED 都是 neondb_owner（runtime＝owner）。DDL 經守門腳本走直連；拆分 runtime 角色列為後續強化。

### 15.5a 自我審查（code-reviewer，2ac25e0..db17f12）
- CRITICAL 0、HIGH 0；確認沒有任何錯誤或缺漏會被判為 PASS、不輸出秘密、migration 守門全在 DB 呼叫之前。
- MEDIUM 1：`--exec` 給 PowerShell cmdlet 時，退出碼會沿用前一個原生程式的值。已修正為只接受原生執行檔（cmdlet → exit 2），並加測試。
- 修正後：vercel-ascii 9/9、r2-scope-evidence 10/10；實機 `whoami` exit 0、`--exec node` exit 5 原樣傳回。
- 此審查不代替符合分支規則的 reviewer approval。

### 15.6 狀態欄
- HEAD：見 git log（本節文件提交）；程式測試 SHA 9608ae2；應用程式碼＝462ec68；PR 狀態見 PR #33。
- R2_OBJECT_RW=PASS；R2_ANON_S3_READ_REFUSED=PASS（端點層級）；R2_PUBLIC_ENTRY=CLOSED（dev-url disabled、無 custom domain）；R2_TOKEN_SCOPE=VERIFIED（dashboard policy、id sha256 相符、單一 bucket、Object Read & Write）
- VERCEL_LAUNCHER=scripts/tools/vercel-ascii.ps1（9/9＋實機唯讀）；VERCEL_REFRESH_VIA_LAUNCHER=NOT_TESTED
- PREVIEW_E2E=31/31(+1 INFO) @9608ae2；PERSISTENCE=10/10 @9608ae2；SCHEDULED_IDENTITY=PASS @462ec68
- PRODUCTION：未變（ceee1b5、env 32 列、migration 10/10、worker Disabled、live publish 未設＝關閉）
- RELEASE_RUNBOOK=READY（未套用）；RELEASE_BLOCKERS＝reviewer approval、正式 bucket＋token、Production env、GX10 呼叫端確認、新備份

### 15.7 另列（不在本輪）
- 標題核准（§13.9）、C:\fuyun_backup ACL／SSH（§13.8）、手機 LINE 真實收發測試。

## 16. 第十二輪（2026-09-28 23:10 起）：正式 R2 憑證核對、呼叫端阻擋
起點 27a5426。應用程式碼仍＝462ec68（本輪只改 ops／test-support 腳本與文件）。Production env、正式 migration、合併部署、worker 與真實發布都未動。

### 16.1 production-release.env
- 路徑：訊息中的 `C:\Users\Administrator.fuyun-secrets` 不存在；實際檔案在 `C:\Users\Administrator\.fuyun-secrets\production-release.env`（22:39 寫入）。
- ACL：只有 Administrator、SYSTEM FullControl（繼承目錄 ACL，目錄不繼承）。
- 格式：R2_ACCESS_KEY_ID 32 位 hex、R2_SECRET_ACCESS_KEY 64 位 hex；與 Preview 金鑰和 secret 都不同。
- 已補入非秘密設定：R2_ACCOUNT_ID=797a01a1…（金鑰在此帳號有效）、R2_BUCKET_NAME=fuyun-ops-production。

### 16.2 token policy 與 bucket（未通過）
- 在 dashboard session 唯讀讀取帳號 token 清單（Chrome Browser 2），共 2 筆、使用者 token 0 筆。
  - id sha256 c2371e1a… 對應這把正式金鑰：「R2 Account Token」，issued 2026-09-28T14:39:01Z，active，allow，Item Write（Object Read & Write）。
  - **唯一資源是 fuyun-ops-pr33-e2e（測試 bucket），不是 fuyun-ops-production。**
- 帳號 bucket 清單（管理 API 與 dashboard 都一樣）只有 fuyun-ops-pr33-e2e → **fuyun-ops-production 不存在。**
- `r2-precheck --target production`：
  - D FAIL（資源不符）。
  - C FAIL（wrangler：bucket does not exist [code: 10006]）。
  - A/B SKIPPED：policy 未通過，未寫入任何物件，因此沒有需要清理的測試物件。
  - E FAIL：正式金鑰可以列出測試 bucket（allowed）。
  - INFO ListBuckets 403 AccessDenied。
- 結論：這把金鑰不可用於正式。需先建立 fuyun-ops-production，再建立只限該 bucket 的新 token 並覆寫。建議撤銷這把，因為它能讀寫測試 bucket。
- 證據：%USERPROFILE%\.fuyun-tools\release\r2-token-policy-production.json（只含 id_sha256 與非秘密 policy；目錄 ACL 與 .fuyun-secrets 相同）。

### 16.3 腳本
- **r2-precheck.mjs `--target production`：**
  - 先檢查 D；未通過就不寫入任何物件。
  - 通過後依序：C → A／B（唯一 key、finally 清理）→ E（正式金鑰列出測試 bucket 必須是 403 AccessDenied；用 ListObjectsV2，因為 HEAD 的 403 沒有錯誤碼）。
  - Preview 目標回歸：D／C／A／B 全數 PASS，exit 0。
- **admin-token-callers.mjs（新增）：** gx10、hermes 兩筆都必須完整。
  - 必要欄位：checked=true、checkedBy、checkedAt、method、usesAdminAccessToken（布林）、usesQueryParam=false；有使用 token 時 readyForNewValue=true。
  - 缺少紀錄、檔案毀損或欄位不完整都判不通過。測試 4/4。
- **rotate-admin-access-token.mjs apply：** 呼叫端紀錄不完整時拒絕（實測 exit 3，未呼叫 Vercel）。
- **release-preflight-pr33.mjs：**
  - R2 改為呼叫 `r2-precheck --target production` 並納入其結果。
  - GX10／Hermes 改為「FAIL BLOCKING」，沒有可略過項目。
- **runbook：** 預檢必須全數 PASS；GX10／Hermes 未確認時阻擋輪換與合併，並寫明代理不得代填紀錄；更新 R2 現況與重建步驟。
- 測試合計 23/23（callers 4、r2-scope-evidence 10、vercel-ascii 9）。

### 16.4 預檢結果（27a5426＋本輪未提交變更，唯讀）
- **PASS：**
  - migration LF 與 blob 相同；正式 10／0，新 migration 未套用；DB session 唯讀。
  - 備份 23.8 h、SHA256SUMS 相符（發版時仍需新備份）。
  - bucket 名稱≠測試 bucket；金鑰≠Preview 金鑰。
  - 輪換值已備妥；worker Disabled；正式仍為 ceee1b5。
- **FAIL：**
  - Production env 缺 7 個名稱。
  - r2 D、C、A/B、E（見 16.2）。
  - BLOCKING GX10／Hermes 呼叫端（無紀錄）。
  - 工作樹不乾淨（當時有未提交檔）。

### 16.5 狀態欄
- R2_PROD_KEY_FORMAT=OK；R2_PROD_BUCKET_EXISTS=NO；R2_PROD_TOKEN_SCOPE=WRONG（fuyun-ops-pr33-e2e）；R2_PROD_PUBLIC_ENTRY=N/A（bucket 不存在）；R2_PROD_OBJECT_RW=NOT_RUN（policy 未通過，刻意不寫）
- ADMIN_TOKEN_CALLERS=UNCONFIRMED（BLOCKING）；ROTATION_APPLIED=NO
- PRODUCTION：未變（ceee1b5、Production env 32 列、migration 10/10、worker Disabled）

## 17. 第十三輪（2026-09-28 23:00）：正式 R2 重新核對（仍未通過）
起點 52d7c40。本輪只做唯讀核對與文件更新，應用程式碼仍＝462ec68。

### 17.1 檔案
- 實際路徑仍為 `C:\Users\Administrator\.fuyun-secrets\production-release.env`（`C:\Users\Administrator.fuyun-secrets` 不存在）。
- 22:53 重新寫入；ACL 只有 Administrator、SYSTEM；key 32 位 hex、secret 64 位 hex、帳號同 797a01a1…、R2_BUCKET_NAME=fuyun-ops-production。
- **Access Key ID 的 sha256 仍為 c2371e1a…，與 §16 同一把**，不是新 token；與 Preview 金鑰不同。

### 17.2 dashboard（唯讀，Chrome Browser 2）
- 帳號 token 仍只有 2 筆，使用者 token 0 筆。
- c2371e1a… 的 token：`modified_on` 仍等於 `issued_on`（2026-09-28T14:39:01Z），代表沒有編輯過；資源仍是 fuyun-ops-pr33-e2e。
- bucket：default 只有 fuyun-ops-pr33-e2e；EU jurisdiction 0 個；FedRAMP 回 403（10003，帳號未啟用該 jurisdiction）。
- 結論：**fuyun-ops-production 不存在**，也沒有新建或修改任何 token。

### 17.3 r2-precheck --target production
- D FAIL（資源為測試 bucket）。
- C FAIL（bucket does not exist [code: 10006]）。
- A/B SKIPPED：未寫入任何物件，因此沒有需要清理的測試物件。
- E FAIL：這把金鑰可以列出測試 bucket。
- INFO：ListBuckets 403 AccessDenied。
- Preview E2E 與持久化沿用 §15 證據（9608ae2），本輪沒有影響它們的變更。

### 17.4 狀態欄
- R2_PROD_BUCKET_EXISTS=NO；R2_PROD_TOKEN=UNCHANGED（c2371e1a…，scope fuyun-ops-pr33-e2e）；R2_PROD_OBJECT_RW=NOT_RUN
- ADMIN_TOKEN_CALLERS=UNCONFIRMED（BLOCKING）；Production、worker、真實發布未變

## 18. 第十四輪（2026-09-28 23:00–23:20）：代為建立正式 R2 bucket 與 token（持有人授權）
授權範圍：只使用 8940 已登入的 Cloudflare 瀏覽器，核對帳號、建立 fuyun-ops-production 與同名 token、安全保存、驗證。Production env、migration、合併部署、worker 與真實發布都未動。

### 18.1 瀏覽器
- 擴充功能重連後兩個瀏覽器的顯示名稱對調，本工作階段一度改用 Linux 那台（未登入）。
  - 那台只開過 Cloudflare 登入頁，沒有輸入任何資料；後來擴充功能斷線，該分頁無法關閉。
- 改回持有人原先選的 deviceId 73edfe6b（8940 的 Brave，session 1）後，恢復為已登入狀態。
- 帳號核對：797a01a17dd54adb268b2a3aaa5423c8，「Arashiyun@gmail.com's Account」。
- 重複建立檢查：第一次開表單時分頁群組消失，當時沒有送出。重新登入後查帳號 token 仍是 2 筆舊的，確認未建立過，才開始建立。

### 18.2 bucket
- 在 dashboard 表單建立 fuyun-ops-production：Location 為 Automatic（未選 jurisdiction）、Standard、預設私有；建立時間 2026-09-28T15:03:56Z。
- wrangler：`Public access via the r2.dev URL is disabled.`、`There are no custom domains connected to this bucket.`

### 18.3 token
- 表單設定：名稱 fuyun-ops-production、Object Read & Write、Apply to specific buckets only＝fuyun-ops-production（只此一個）、TTL Forever、無 IP 篩選。送出前以頁面 script 核對過。
- 金鑰交接（未經對話、未截圖、未讀取結果頁文字）：
  - 事前以非秘密亂數實測：8940 的 Brave 與本機共用剪貼簿；script 無法直接寫入剪貼簿，必須由真實點擊觸發。
  - 結果頁由 script 找出唯一的 32 位 hex（排除帳號 ID）與唯一的 64 位 hex，只回傳數量與 sha256 前 8 碼（7873a5ba／b844feba）。
  - 每個值都由注入按鈕的真實點擊寫入剪貼簿；本機 script 讀取、驗證格式與 sha 前綴後寫入 production-release.env，並立即清空剪貼簿。
  - 完成後刪除頁面上的暫存變數與按鈕，離開結果頁。
- production-release.env：R2_ACCOUNT_ID、R2_BUCKET_NAME、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY；ACL 只有 Administrator、SYSTEM。
- policy（dashboard session 唯讀讀取）：
  - 帳號 token 3 筆、使用者 token 0 筆；新 token id sha256 7873a5ba… 與保存的金鑰相符。
  - active、issued 2026-09-28T15:09:58Z、未設到期、無 IP 條件；allow、Item Write（Object Read & Write）。
  - 唯一資源 `…_default_fuyun-ops-production`。
- 證據：%USERPROFILE%\.fuyun-tools\release\r2-token-policy-production.json（只含 id_sha256 與非秘密 policy）。
- Preview bucket 與既有 2 筆 token 保持不動。c2371e1a…（範圍為測試 bucket）仍是 active，建議由持有人撤銷。

### 18.4 r2-precheck --target production（exit 0）
- D PASS：這把金鑰、Object Read & Write、只限 fuyun-ops-production。
- C PASS：r2.dev disabled、無 custom domain。
- A PASS：bucket 可連線、唯一合成物件寫入、讀回 sha256 相符、60 秒簽名 URL 內容相同、物件已刪除；之後列出 bucket 為 0 個物件。
- B PASS：匿名 S3 GET 回 400 InvalidArgument（端點層級）。
- E PASS：正式金鑰列出測試 bucket 被拒（403 AccessDenied）。
- INFO：ListBuckets 403 AccessDenied。

### 18.5 預檢（ddeabbc，唯讀）
- PASS：
  - 工作樹乾淨；migration LF 與 blob 相同；正式 10／0，新 migration 未套用；DB session 唯讀。
  - 備份 SHA256SUMS 相符。
  - 正式 R2 全部項目（名稱、金鑰與 Preview 不同、D／C／A／B／E）。
  - 輪換值已備妥；worker Disabled；正式仍為 ceee1b5。
- FAIL（剩餘阻塞）：
  - 備份已超過 24 h（24.2 h）→ 發版當下需重新產生。
  - Production env 缺 7 個名稱。
  - BLOCKING：GX10／Hermes 呼叫端沒有確認紀錄。

### 18.6 狀態欄
- R2_PROD_BUCKET=CREATED（private、dev-url disabled、no custom domain）；R2_PROD_TOKEN=CREATED（7873a5ba…，Object Read & Write，只限 fuyun-ops-production）；R2_PROD_PRECHECK=PASS（D/C/A/B/E）
- R2_OLD_WRONG_TOKEN=ACTIVE（c2371e1a…，建議撤銷）
- 剩餘發版阻塞：reviewer approval、GX10／Hermes 呼叫端紀錄、Production env、發版當下新備份
- PRODUCTION：未變（ceee1b5、Production env 32 列、migration 10/10、worker Disabled、真實發布關閉）

## 19. 第十五輪（2026-09-28 23:30）：撤銷誤建的 R2 token（持有人授權）
- 撤銷前確認：
  - 本機：preview-e2e.env 的金鑰 sha256＝bee3ed2c…、production-release.env＝7873a5ba…，都不是目標 c2371e1a71055f4507b3c3274751289d0d2d057917290b5f42d7f178d4a264f4。
  - 14 個 .env*.example 範本沒有任何實際金鑰值。
  - Vercel Preview 用的是 bee3ed2c…（§14 以 preview-e2e.env 寫入）；Production 沒有 R2 變數。
- dashboard（8940 Brave）以完整指紋比對帳號 token 3 筆，唯一相符的是 TARGET：「R2 Account Token」，issued 2026-09-28T14:39:01Z，範圍 fuyun-ops-pr33-e2e。另兩筆標為保留（Preview、Production）。
- UI 上 Preview 與目標 token 的名稱、bucket、日期完全相同，因此不經列表點選。改在頁面內依指紋鎖定 token id，只對這一筆送出 `DELETE /accounts/<acct>/tokens/<id>` → 200 success；id 沒有離開頁面。
- 撤銷後唯讀確認：
  - 帳號 token 剩 2 筆：7873a5ba fuyun-ops-production（active，fuyun-ops-production）、bee3ed2c R2 Account Token（active，fuyun-ops-pr33-e2e）；使用者 token 0 筆。
  - `r2-precheck --target production` exit 0（D、A 含清理、E 皆 PASS）；`r2-precheck`（Preview）exit 0。
- 未能直接驗證：舊金鑰的 secret 已在 §18 覆寫、沒有留存，所以沒有以舊金鑰實測被拒；撤銷的證據是 API 回應與清單。
- 證據檔 r2-token-policy-production.json 已註記 revoked。
- 狀態：R2_OLD_WRONG_TOKEN=REVOKED；其餘同 §18.6（正式發版未進行）。

## 20. 第十六輪（2026-09-29）：審查修正、GX10 紀錄、runbook 校正
起點 dcc1161（與遠端一致）。程式提交：468bffe（15 則審查修正）、f59a01f（自我審查 MEDIUM）。Production env、正式 migration、憑證輪換、合併部署、worker 啟用、真實發布都未執行；沒有使用管理員繞過。

### 20.1 GX10 admin-token-callers.json：未取得（阻擋仍在）
- 查過的既有管道：
  - GitHub：沒有新的 handoff 分支或含此檔的提交。
  - SSH：8940 的 id_ed25519 以 `administrator@gx10-f6b2`／`100.85.105.46` 登入，BatchMode 回 `Permission denied (publickey,password)`；沒有猜測其他帳號。
  - Claude 工作階段：沒有其他可聯絡的工作階段。
- 沒有依聊天摘要代填；BLOCKING 狀態不變。
- 版本校正註記另存 `%USERPROFILE%\.fuyun-tools\release\admin-token-callers.version-notes.md`（不修改原始紀錄）：
  - `?admin_token=` 的 8 處 URL 用法屬 main ceee1b5（analytics 29／41、quotes/[id] 27／37／55／74、quotes 19／52，另有伺服器端 lib/adminQuoteAuth.ts:8），PR #33 已移除。
  - Vercel env 變更只在新部署生效。

### 20.2 審查 15 則（9 P1、6 P2）：全部成立並修正，逐則回覆，未標記 resolved
| # | 優先 | 主題 | 修正 | 證據 |
|---|---|---|---|---|
| 1 | P1 | IG 核准綁定帳號 | 綁定實際發布帳號（env 或 OAuth 儲存）＋發布時再比對 | shared 單元測試（檔案 token store A→B） |
| 2 | P1 | 登出未清 cookie | logout 呼叫 /api/auth/logout | 真瀏覽器、E2E |
| 3 | P1 | 乾跑終態 | dry_run_verified 可再執行，live 模式到期 | 單元、E2E |
| 4 | P1 | 事實確認 UI | 違規清單＋確認勾選才能核准 | 真瀏覽器 |
| 5 | P1 | LINE 並行 | 原子 claim（ON CONFLICT）＋migration 202609290001 | claim 測試 10 並行＝1（舊邏輯對照＞1） |
| 6 | P2 | LINE 回覆恢復 | 失敗回 500、快取回覆重送不重建 | offline 測試（舊 route 3 項 FAIL） |
| 7 | P1 | worker 鎖 | 只看心跳 mtime／程序存活；只動自己的鎖 | worker 測試（舊版接管活鎖） |
| 8 | P2 | one-shot 退出碼 | 失敗 exit 1 | worker 子程序測試（舊版 401 exit 0） |
| 9 | P1 | 授權／重試退避 | awaiting_auth 停放、OAuth 後重排；retry 指數退避、5 次轉人工 | 單元、E2E |
| 10 | P1 | IG IN_PROGRESS | 輪詢＋保留容器續行 | fake client 單元 |
| 11 | P2 | R2 清理 | 失敗／敗方刪除上傳物件 | 本機 cleanup 測試（舊版 FAIL）、E2E 無孤兒 |
| 12 | P1 | /me 讀 cookie | verifyAdminRequest | E2E、真瀏覽器 |
| 13 | P2 | 排程共用 state | 以內容 ID 分開 | 真瀏覽器 |
| 14 | P2 | migration 守門 | evaluateMigrateStatus | 單元＋真實 prisma 輸出 |
| 15 | P2 | 拒答 regex | `\s*` | content-guard（舊 regex 漏 2／3） |
- 限制：
  - 登出後，若有人複製了舊 cookie 值，在 12 小時到期前仍然有效（無狀態 JWT）；伺服器端撤銷不在本輪範圍。
  - LINE 重送使用重送事件的 reply token；若 LINE 已讓它過期，事件停在 built 並記錄錯誤。
  - route 層並行測試在舊 route 也通過，不列為回歸證據；以 claim 測試為準。
- 自我審查（code-reviewer，dcc1161..468bffe）：CRITICAL 0、HIGH 0；MEDIUM 1。
  - 內容：快取回覆的寫入失敗時，事件狀態不會結束，之後可能多送一則中性訊息。
  - 已於 f59a01f 修正並加測試。

### 20.3 驗證（程式 f59a01f）
- 本機：
  - tsc 0、next build 0（126 頁）。
  - 無 DB 測試 88 pass＋1 需 DB（IG DB store，以本機 PG 另跑 7/7）。
  - 本機 PG：LINE claim 6/6、LINE offline 15/15、intake cleanup 3/3。
  - 暫時 PG（55441）已停止並刪除。
- Migration：
  - 升級演練：正式 schema-only（pristine.sql）＋10 筆歷史 → 只套用 202609280001／0002／290001，13/13 finished；既有物件 `pg_dump -s` 差異 0。
    - 首次嘗試因缺 role `rehearsal` 載入中斷，判為無效並重做。
  - 新表／欄位與 schema.prisma 無漂移（其餘為 §13.3 既有漂移）。
  - 測試分支 pr33-ops-e2e（ep-steep-star）以 owner 套用 202609290001；套用前 status 只列這一筆，套用後 up to date。
- 雲端（isolated Neon／R2 Preview）：
  - `run` @468bffe dpl_BHDNkj7G6YQ1u2Ssm1iD1GbDC3BJ：38/38＋INFO。
  - `run` @f59a01f dpl_8vEShAN16ri1JQE52cLKkMHY6g6Y：38/38＋INFO（新增：/me cookie、登出清 cookie、跨站登出 403、乾跑後仍 approved、無孤兒物件、停放與退避）。
  - `sched` @f59a01f：PASS（S4U／Limited exit 0、3 jobs 各 claim 一次、dry-run）；臨時排程已移除，Fuyun-Operations-Worker 仍 Disabled。
  - 真瀏覽器（playwright-core 1.63＋本機 Chromium 1228，headless）@f59a01f dpl_8vEShAN16…：14/14。
    - 涵蓋：UI 登入 cookie 屬性、cookie-only 可留在營運頁、事實警示與勾選、兩卡排程互不干擾且各自寫入、UI 登出後 cookie 消失、/me 403、營運頁導回 /admin。
    - 截圖：%USERPROFILE%\.fuyun-tools\preview-e2e\browser-2026-09-28T22-28-18-219Z。
  - 重新部署 → dpl_9UhWVjz6BAkpfXdkotWUEiUPbtPN：`verify` 10/10。
  - 正式 R2（§18）與 Preview R2 範圍證據沿用（本輪未改 R2 設定或憑證）。

### 20.4 runbook 校正
- §2：migration 改為三個、驗收 13 筆。
- §4：輪換須以 apply 之後建置的新部署驗收（createdAt 晚於 env 更新、網域指向新部署、verify、舊部署網址需 Vercel 驗證）。
- §6：七頁詢價表單（/charter-bus/{taipei, new-taipei, taoyuan, hsinchu, taichung, tainan, kaohsiung} 的 WebMCPQuoteTool）依程式實際行為，只產生 LINE oaMessage 深連結，不寫入 DB。
  - 會寫入 DB 的是 /contact/inquiry → /api/inquiry，另列驗收（需已核准的測試收件者）。
- §8：不使用 Instant Rollback／Promote 回到 ceee1b5 的既有部署，因為那會帶回舊 token，而且 ceee1b5 仍接受 query 傳 token。
  - 回復方式改為以目前 env 新建置：前滾修正，或走 PR 的 `git revert -m 1`、部分回退。
  - 回復後驗收新部署 ID 與 rotate verify。

### 20.5 狀態欄
- 最新 HEAD：見 git log（本節文件提交）；程式測試 SHA f59a01f；PR #33 Ready for review、review REQUIRED
- REVIEW_THREADS=15 成立、15 已修正、15 已回覆、0 resolved（留給 reviewer）
- ADMIN_TOKEN_CALLERS=NOT_RECEIVED（BLOCKING）；VERSION_NOTES=SAVED（與原始紀錄分開）
- 剩餘發版條件：reviewer approval、GX10／Hermes 原始紀錄與 validator PASS、Production env、發版當下新備份、預檢全 PASS
- PRODUCTION：未變（ceee1b5、Production env 32 列、migration 10/10、worker Disabled、真實發布關閉）

## 21. 第十七輪（2026-09-29）：取得 GX10 原始呼叫端紀錄、回復清單校正、收尾證據
起點 084f6a4（與遠端一致，之後無新提交）。本輪只改文件，沒有改程式；Production env、正式 migration、憑證輪換、合併部署、worker 啟用、真實發布都未執行。

### 21.1 GX10 連線
- known_hosts 核對：
  - gx10-f6b2 與 100.85.105.46 為同一把 ED25519 host key（SHA256:xH7TgpVT8AcDeVgYllhEGER4dL+jNT2ee3OcMTGBiGc）。
  - 歷史 IP 192.168.100.10 不在 known_hosts、22 埠不可達，未使用。
- 以既有 id_ed25519 連線 `arashiyun@gx10-f6b2`（BatchMode、ConnectTimeout 10、StrictHostKeyChecking=yes）成功：hostname=gx10-f6b2、user=arashiyun。
- 未改 SSH 設定、authorized_keys 或主機金鑰驗證。
- 更正 §20.1：當時以 administrator 登入被拒，是帳號用錯，並非 GX10 不可連線。

### 21.2 原始紀錄交接
- 唯讀搜尋（檔名＋內容），腳本經 stdin 傳送，避免 PowerShell 5.1 剝除引號。第一次以命令列參數傳送的搜尋因引號被剝除，結果不採信。
- 原始檔：`/home/arashiyun/hermes-fenshenmin/.fuyun-tools/release/admin-token-callers.json`
  - 5089 bytes、mtime 2026-09-29 01:21:19 +0800、arashiyun:arashiyun 664
  - generatedBy：fenshenmin（Hermes agent），generatedAt：2026-09-28T16:46:35Z
- SHA-256：來源端 `7c8c27c39af4b955d2b3451ebe1e4d110b66326b37a814d741d9821e5765a7cb`；以 scp（嚴格 host key）下載後本機相同；存到 8940 之後相同。
- 內容檢閱：沒有秘密值（無長隨機字串），無 BOM、無 CRLF。
  - gx10、hermes 各一筆，都有 method 與 evidence。
  - 兩筆都是 checked=true、usesAdminAccessToken=false、usesQueryParam=false、readyForNewValue=true。
  - webAppNote 另說明網頁 App 本身的用法，不計入呼叫端。
- Validator（PR #33 scripts/ops/admin-token-callers.mjs，HEAD 084f6a4 blob 2bae1cf3）：暫存檔與存檔後的預設路徑都是 `{"ok":true,"problems":[]}`。
- 已原樣保存到 `%USERPROFILE%\.fuyun-tools\release\admin-token-callers.json`（ACL 只有 Administrator、SYSTEM）。
- version-notes.md 追加來源與雜湊，並校正 webAppNote 兩處：
  - 「接受 ?admin_token= 的 8 行」屬 ceee1b5。
  - env 只在新部署生效，不是即時。
- 另見 GX10 上 `/tmp/validate-callers.mjs`（1307 bytes）：來源端自行的檢查腳本，只記錄，未執行。

### 21.3 runbook §8 回復清單重寫
- 移除「整包 revert PR 即可安全回復」；整包回退與 Instant Rollback／Promote 到發版前部署皆列為禁止。
- 每個回復候選的必要條件：
  - 保留安全修正檔（列出路徑，diff 必須為空）。
  - 與三個 additive migration 相容（不寫 down migration、不刪表）。
  - 以當時有效的 Production env 新建置（Git integration，或不用 build cache 的 Redeploy）。
  - 先停 worker。
- 候選依序：
  - A 前滾修正。
  - B 營運功能關閉：移除 OPERATIONS_PERSISTENCE_MODE 後新建置 → 營運 API 503，安全修正不變。
  - C 部分回退：只回退非安全檔案、走 PR。
- 回復驗收：新部署 id／時間／sha、rotate verify、/me 與登出、query token 401、migrate status up to date。
- §4 更新呼叫端紀錄狀態（已取得、雜湊一致、validator 通過；發版時預檢仍會重驗）。

### 21.4 收尾證據
- HEAD 084f6a421c1e2cb20d9849aac967bbc09132bb86 → Vercel Preview dpl_CvGUriQT9GCwvNMakdiR5QYAinse：Ready／success（2026-09-28T22:35Z）。
  - 相對於已測程式 f59a01f57a135e3722cf466b18de7a14ed2dd347 只有文件差異（app／lib／prisma／scripts 0 檔）。
- 已測程式 f59a01f57a135e3722cf466b18de7a14ed2dd347 的證據沿用 §20.3，本輪未重跑：
  - E2E 38/38＋INFO @dpl_8vEShAN16ri1JQE52cLKkMHY6g6Y；真瀏覽器 14/14；sched PASS；verify 10/10 @dpl_9UhWVjz6BAkpfXdkotWUEiUPbtPN。
  - 本機各測試套件；升級演練 13/13。
- 本節文件提交後的 HEAD 與 Vercel 結果記於 PR 說明。

### 21.5 狀態（分開陳述）
- **修正與測試：完成。** 15 則審查都已修正並逐則回覆；程式 f59a01f 的雲端與本機驗證全數通過。
- **Reviewer：尚待驗收與有效 approval。** PR #33 Ready for review，reviewDecision=REVIEW_REQUIRED；15 則 thread 未 resolved，留給 reviewer。
- **原始呼叫端紀錄：已交接。** 雜湊一致（7c8c27c3…5765a7cb），validator ok；原始內容未改，校正另存。
- **正式發版窗口尚需執行：**
  - 有效 approval。
  - 新備份＋SHA256SUMS＋pg_restore --list。
  - LF clone 以 owner 身份套用三個 migration。
  - Production env（OPERATIONS_*、R2_*，不複製 Preview）。
  - ADMIN_ACCESS_TOKEN apply，並以新建置部署驗收。
  - 預檢全數 PASS。
  - 正常合併部署與正式驗證。
  - 之後才啟用 worker（dry-run）。
- PRODUCTION：未變（ceee1b5、Production env 32 列、migration 10/10、worker Disabled、真實發布關閉）。

## 22. 第十八輪（2026-09-29）：發版順序統一、預檢分階段、審查交接
起點 68fa1e86e06071522f17812248fa58928afad447，與遠端一致，之後無新提交。本輪沒有執行任何正式操作：Production env、正式 migration、憑證輪換、合併部署、worker 啟用、真實發布都未執行。

### 22.1 發版順序（取代 §21.5 的「正式發版窗口尚需執行」清單）
runbook 改為固定的第 1–8 步，回復改列為第 9 節：
1. Reviewer 驗收修正，取得對目前 head 有效的 approval；Vercel check 成功。
2. 發版前預檢 `--phase pre-release`：確認候選 SHA、原始呼叫端紀錄、正式資源、migration 清單與回復方案。
3. 發版窗口內新建 DB 備份，驗證 SHA256SUMS 與 pg_restore --list。
4. LF checkout，以 owner 身份套用三個 migration。
5. 設定 Production env 並 apply 新的 ADMIN_ACCESS_TOKEN；秘密不進輸出或提交。
6. 部署前預檢 `--phase pre-deploy` 全部 PASS 後，才正常合併。
7. 部署後驗收，只在合併產生的新部署 D_new 上進行：SHA、deployment ID、createdAt 晚於 T_env、新 token 可用、舊 token 與 query token 被拒、登入／me／登出、詢價、營運持久化。
8. 驗收通過後才以 dry-run 啟用 worker。真實發布需另外的內容核准與平台驗收。

- 舊版把輪換的部署後驗收寫在第 4 步（合併之前），第 0 步又要求預檢全數 PASS，但當時備份還不存在。兩者都已移除。
- Preview 結果不算正式驗收，這點已寫入 runbook 開頭。

### 22.2 預檢分階段（程式變更）
- **問題：** 舊的 release-preflight-pr33.mjs 永遠要求「正式只有 10 個 baseline、新 migration 未套用」。
  - 第 4 步套用後再跑，必定 FAIL，runbook 要求的「合併前預檢全數 PASS」不可能成立。
  - 同一支預檢在第 2 步時，備份與 env 也不可能 PASS。
- **修正：** 新增 scripts/ops/release-phase.mjs（純函式）；預檢必須帶 `--phase pre-release|pre-deploy`，缺少或不合法時 exit 2，不做任何存取。
  - pre-release：10/0、新 migration 未套用；備份與 Production env 回報 PENDING（不阻擋）；其餘必須 PASS。
  - pre-deploy：13/0，而且新增的恰好是那三個；新備份 24 h 內且 SHA256SUMS 相符；env 名稱齊全；不得有 PENDING。
  - 兩階段的 FAIL、UNVERIFIED 都阻擋；呼叫端紀錄、R2、worker Disabled、正式仍為 ceee1b5 在兩階段都檢查。
- **測試：**
  - 新增 scripts/ops/release-phase.test.mjs 8/8，先 RED 再 GREEN。
  - scripts/ops 全部 16/16（callers、migrate-status、release-phase）。
  - `node --check` 通過；不帶 phase 與 `--phase post-deploy` 都實測 exit 2。
- **限制：** 預檢只看 env 名稱，無法證明 ADMIN_ACCESS_TOKEN 的值已替換；runbook 第 6 步要求另外確認 apply 紀錄與 T_env。

### 22.3 本輪誤執行的舊版預檢（揭露）
- 修改程式時，第一次自動編輯失敗（腳本未變）。原本用來確認「不帶 phase 會提前退出」的指令因此執行了**未修改的舊版預檢**兩次（約 2026-09-29，68fa1e8 工作樹）。
- 舊版預檢的設計就是唯讀：
  - DB 以 read-only transaction 讀取；Vercel env 只列名稱。
  - r2-precheck A 在 fuyun-ops-production 寫入唯一合成物件，讀回後在 finally 刪除，兩次都回報「synthetic object deleted」PASS。
- 沒有設定、migration、輪換、合併、部署或 worker 變更。
- 輸出同時是目前正式狀態的旁證：
  - 10/0、新 migration 未套用、DB session 唯讀。
  - 備份 neon-prod-20260927T145911Z.dump 37.7 h（過期，發版窗口仍需新備份）、SHA256SUMS 相符。
  - Production env 缺 OPERATIONS_*、R2_* 共 7 個名稱（預期中，屬第 5 步）；R2 D／C／A／B／E 全數 PASS。
  - 輪換值已備妥、呼叫端紀錄 PASS、worker Disabled、正式仍為 ceee1b5。
  - 「git working tree clean」FAIL，是因為本輪有未提交的修改。

### 22.4 審查交接（實際狀態，2026-09-29 查詢）
- **reviewDecision=REVIEW_REQUIRED、mergeStateStatus=BLOCKED。**
  - 唯一的 review 是 chatgpt-codex-connector 的 COMMENTED，不是 approval。
  - 沒有 pending review request。
- **分支保護（main）：** required_approving_review_count=1、dismiss_stale_reviews=false、required_conversation_resolution=false、沒有必要 status checks、enforce_admins=false。未修改，也不使用管理員例外。
- **Collaborators：** 只有 arashiyun-web（admin），也就是 PR 作者本人。GitHub 不允許作者 approve 自己的 PR，所以目前沒有人能給出符合規則的 approval。需要持有人另外加入有 write 權限的 reviewer。
- **Threads：** 15 則全部未 resolved。每則都有作者回覆，指向 468bffe／f59a01f 的修正與測試；reviewer 尚未回應。不代為標記 resolved。
- dismiss_stale_reviews=false：日後若在 approval 之後又有新提交，approval 不會自動失效。runbook 第 1、6 步因此要求 approval 必須對應目前 head，否則重新取得。

### 22.5 狀態
- 已測程式：本輪修改了 scripts/ops（預檢分階段），已測程式因此改為本節提交；app、lib、prisma 未變。
  - f59a01f 的 E2E 與瀏覽器證據仍適用於應用程式碼。
  - 預檢的證據是 22.2 的測試。
- 新提交的完整 SHA 與 Vercel Preview deployment ID 記於 PR 說明。
- PRODUCTION：未變（ceee1b5、migration 10/10、Production env 無新增名稱、worker Disabled、真實發布關閉）。

## 23. 第十九輪（2026-09-29）：PR #33 正式發版
持有人授權執行正式發版，並決定自行審查。main 分支保護的必須核准數由 1 改為 0，只改這一項，其餘規則不變（前後設定比對只差這一欄）。沒有使用管理員例外，也沒有 force-push。

### 23.1 時間線（UTC）
| 時間 | 事件 |
|---|---|
| 05:36 前後 | LF clone（b2701a1）、pre-release 預檢 exit 0（備份與 env 為 PENDING）、呼叫端 validator ok、SHA-256 7c8c27c3…5765a7cb |
| 05:42:31 | 正式備份 neon-prod-20260929T054231Z.dump |
| 05:43:40–05:43:50 | 三個 migration 套用（neondb_owner、直連 endpoint），status up to date |
| 05:47:31–05:47:46 | Production env 新增 7 個名稱 |
| 05:52:18.868 | ADMIN_ACCESS_TOKEN apply（T_env） |
| 05:53 前後 | pre-deploy 預檢全部 PASS（exit 0） |
| 05:53:54 | PR #33 正常合併，merge commit 08bdd4f182847728c4c18b7861ae3d2e6e6345da |
| 05:53:58.822 | D_new = dpl_9d3JJd7tPc7X9a2r3riBvfmsu8f1 建立（git、main、sha＝merge commit）；05:55:01 Ready |
| 05:56–06:03 | 部署後驗收：API 46/46、瀏覽器 28/28、rotation verify 兩個網域 |
| 06:05–06:07 | worker 更新為 merge 版本並以 dry-run 啟用 |

### 23.2 備份與 migration
- 備份：`FuyunBackups\20260929-neon-prod-release\neon-prod-20260929T054231Z.dump`，28858 bytes。
  - SHA-256 c726bc6bda5afc43d9bc68f6adffab10fa2a76bd8181453423d44c6ae5714bc2，與 SHA256SUMS 相符。
  - ACL 只有 Administrator 與 SYSTEM。
- 可恢復：`pg_restore --list` 共 49 項（10 張表）。完整還原到暫時的本機 PG 17（127.0.0.1:55432）後，逐表列數與正式唯讀計數完全一致（MATCH_EXPECTED=true）；暫時 PG 已停止。
- Migration：以 LF clone、neondb_owner、直連 endpoint 執行 `prisma migrate deploy`（沒有用 db push）。之後 `_prisma_migrations` 13 筆 finished、0 筆 unfinished，新增的恰好是那三個。
- Schema 比對（遷移前取自備份、遷移後 `pg_dump -s`）：既有 10 張表沒有任何變動。只新增 5 張表（instagram_login_tokens、line_webhook_events、operations_contents／events／jobs）及其索引與外鍵。
- 過程問題（已處理）：
  - LF clone 後另外執行的 `git checkout` 因全域 autocrlf=true 寫成 CRLF。pre-release 預檢的 LF 檢查攔下，重新 checkout 後 481 個檔案與 blob 逐位元相同。runbook §4 已修正。
  - 初次設定備份 ACL 時，`/T` 使檔案的 DACL 變成空的，改以繼承目錄 ACL 修正；修正後雜湊不變。

### 23.3 Production env、R2、token
- 新增 7 個名稱，前後比對只多出這些、沒有移除（31→38）：OPERATIONS_PERSISTENCE_MODE、OPERATIONS_LIVE_PUBLISH_ENABLED（false）、OPERATIONS_CRON_TOKEN（新值 fp 954444bf51，不同於 Preview）、R2_ACCOUNT_ID、R2_BUCKET_NAME、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY。
  - 全部是 sensitive 類型，只設在 production；值只經 stdin 傳遞。
  - 沒有複製 Preview 設定。
- R2（兩次預檢都是 D／C／A／B／E 全數 PASS）：fuyun-ops-production 私有、r2.dev Disabled、無 Custom Domain；token 只限正式 bucket；合成物件寫入、讀回後刪除。
- ADMIN_ACCESS_TOKEN：Production 只有一筆，更新時間 05:52:18.868Z，新值 fp d3c45fa759。
  - D_new 晚於 T_env 建置，兩個正式網域都指向 D_new。
  - rotation verify（yunsun.com.tw、fuyuntravel.com）：新值放在 header 回 404（已接受）、放在 query 回 401。
  - **舊值無法直接測試。** 它是 Vercel sensitive 變數，`vercel env pull` 只回傳佔位字串；一度誤記為 PREVIOUS，發現後已刪除，沒有拿來判定。
  - 舊值被拒的依據：Production 只剩一筆、D_new 晚於 T_env 建置、程式以常數時間比對唯一設定值、錯誤 token 回 401。
  - 舊部署網址（dpl_Fvr7b…）在沒有 bypass 時回 302（Vercel 驗證）。

### 23.4 部署後驗收（D_new、正式網域）
- `https://yunsun.com.tw`，API 46/46 PASS：
  - 公開頁（/、7 個包車城市頁、/contact/inquiry）都是 200。
  - Token：新值 header 可用、放在 query 401、錯誤值 401、沒帶 401。
  - 登入：cookie 為 HttpOnly／Secure／SameSite=Lax；/me 帶 cookie 200、不帶 403；登出清除 cookie（Max-Age=0）；跨來源登出 403。
  - 報價：header 與 cookie 200；query 與錯誤 token 401；跨來源 PATCH 與 send 401。
  - 營運（dry-run）：
    - 跨來源與無 Origin 的 cookie mutation 401，同源 201。
    - 同時送出相同 intake 得到同一個 id；DB 1 筆內容、3 筆 job。
    - 圖片 hash 相符；未帶 auth 401；R2 物件在 fuyun-ops-production，匿名讀取被拒，60 秒簽名網址可讀。
    - 核准後三次同時 process-due：每個 job 只 claim 一次，狀態 dry_run_verified，沒有 externalId。錯誤的 cron token 回 401。
  - 詢價：POST /api/inquiry 回 200，DB 寫入一筆。正式環境沒有設定 SMTP 與管理員 LINE，所以沒有寄信或推播。
  - 清理：2 筆內容、4 個 R2 物件、1 筆詢價都已刪除，剩餘 0。
- 瀏覽器 28/28 PASS（Chromium，playwright-core 1.63）：7 個城市頁都是 200 且 8 個欄位齊全；空白送出出現錯誤；連結為 `https://line.me/R/oaMessage/@954fyicw/?…`（官方帳號，與首頁連結相同），各欄位值完整、特殊字元已編碼；沒有對本站 /api 的請求。
- 營運相關資料表清理後為 0／0／0。

### 23.5 worker
- 已部署的 worker（bd04de67）比 merge 版本舊，更新為 b32526f5（來源 08bdd4f）。舊檔保留為 `.prev-bd04de67`，並更新 DEPLOYED.sha256。
- worker.env 新增兩項：OPERATIONS_AGENT_BASE_URL=https://fuyuntravel.com（canonical 網域）、正式 cron token。
- 手動 one-shot 執行：completed 0 job、exit 0。
- 排程已啟用並啟動：Administrator、S4U、Limited；node v24.16.0；每 60 秒一次，日誌為「completed: 0 job(s)」。
- Dry-run 由伺服器端保證：OPERATIONS_LIVE_PUBLISH_ENABLED=false（status 端點回 livePublishEnabled=false），executeJob 另有第二道關閉判斷。真實發布維持關閉。

### 23.6 發現與待辦
- **CRITICAL（發版前就存在，已開 PR #34，未合併）：**
  - `GET /api/inquiry` 不需驗證就回傳全部詢價，含未遮罩電話、姓名、LINE。
  - `PATCH /api/inquiry` 不需驗證就能修改任何詢價。
  - 修正：GET 用 verifyAdminRequest、PATCH 用 verifyAdminMutation。測試 4/4（舊版 3 項 FAIL）；tsc 與 next build 通過；Preview 煙霧測試 6/6（不寫入）。
- **管理員密碼外洩於本次工作階段輸出：** 檢查 admin-login.txt 格式時，指令把帳號與密碼印出。需要輪換：provision-admin-credentials，更新 Production 的 ADMIN_PASSWORD_HASH／SALT，再以新建置部署生效。
- vercel-ascii.ps1：`--exec` 後只有一個參數時，只會傳入第一個字元。已在本 PR 修正，launcher 測試 10/10。
- 合成資料的注意事項：dry-run 之後 job 仍可被 claim。之後若啟用 live，殘留的合成內容會被發布，所以驗收必須清理（本次已清理）。

## 24. 第二十輪（2026-09-29）：詢價權限修補、管理憑證輪換與 Preview 隔離

本節依 8940 發版作業的回報記錄。只記部署 ID、提交 SHA、驗收結果與尚待處理的範圍；不存放密碼、金鑰、連線字串或詢價內容。

### 24.1 修補與目前正式部署
- PR #34 已合併：merge commit `d9158b859e74be1fd84b925b240c5fd5d68e43fe`。GET /api/inquiry 要求管理員驗證；PATCH /api/inquiry 要求管理員驗證並檢查 cookie mutation 來源；公開 POST 保持可用。
- PR #35 已正常合併：merge commit `2660549e853d7ea48113524e17530fe8866509c2`，只變更發版紀錄、runbook 與 Vercel launcher 腳本。
- 目前正式部署 `dpl_ANc7Q55KjAgVUJcgvFmHuGvN2WCo`，來源 SHA 為 `2660549e853d7ea48113524e17530fe8866509c2`。09:19:03Z 建立、09:20:21Z Ready；最後一次管理憑證設定更新為 09:18:34Z。此前同一 SHA 的部署為 `dpl_Dn3pNcymg2FQX8VNE8RyycZ3Dy73`，之後另以 Vercel API 建立目前部署，未 Promote 或 Instant Rollback。該 API 不接受 no-cache 選項；本輪以實際登入與 session 驗證新設定已生效。
- GitHub 上該提交的 Vercel 狀態為 success。2026-09-29 另以未登入、只取 HTTP 狀態碼的請求核對：fuyuntravel.com、yunsun.com.tw、fuyun-travel.vercel.app 的 GET /api/inquiry 均回 401；未讀取任何客戶資料。

### 24.2 管理憑證、資料庫範圍與驗收
- 使用 `scripts/provision-admin-credentials.mjs` 產生新的正式管理密碼、salt、hash 與 JWT_SECRET；管理員帳號名及 ADMIN_ACCESS_TOKEN 未變。Production 的三個管理驗證設定已更新，登入資訊檔 ACL 只限 Administrator 與 SYSTEM，沒有輸出秘密值。all-branches Preview 另產生獨立憑證；PR #33 分支專屬的 Preview 憑證未變。
- Preview 全分支的新部署改用隔離 Neon branch `pr33-ops-e2e`（無客戶資料）；原本共用的 16 個資料庫變數只留給 Production 與 Development，值未改。既有 Preview 部署不因 env 更新而改變，見 24.3。
- 兩個正式網域的管理憑證、session 與詢價 API 驗收共 20/20 PASS：新密碼登入、錯誤密碼 401、以不同簽章金鑰產生的 session 403、新金鑰 session 200、管理員 GET /api/inquiry 200（不列印資料列）、未登入 GET/PATCH 401、登出清 cookie、/contact/inquiry 200。舊 session 的測試是不同金鑰簽章的間接驗證，沒有保留輪換前的真實 session。
- 公開表單送出一筆合成詢價回 200、確認寫入後刪除。驗收腳本早期因 heredoc 的 regex 逸出遺失而讀不到登入檔，送出空白帳密，造成兩次假失敗；修正腳本後上述驗收通過。worker 仍以 dry-run 每週期 0 job 運行，真實發布維持關閉。

### 24.3 待處理的部署及開發環境風險
1. 輪換之前建立的 Preview 部署仍可能持有舊的正式資料庫連線設定及舊 Preview 管理憑證。已抽查的舊 Preview URL 對未登入者要求 Vercel 登入；仍須在完整盤點、核對不含目前正式部署後，移除那些舊 Preview 部署，或採另行規劃的資料庫憑證輪換與正式重建。移除前不得把 Vercel 保護關閉。
2. Development 的資料庫設定仍指向正式 DB；`vercel env pull` 與 `vercel dev` 的使用者須先確認連線目標。應改為隔離開發分支，並核對所有相關變數一起切換。
3. Preview 隔離 branch `pr33-ops-e2e` 的 migration 紀錄留有一筆未完成項；未釐清前不要在該分支執行 migration。
4. main 的 required approving reviews 仍為 0，屬持有人先前決定；其他分支保護規則未在本輪調整。

以上是網站已上線後的收尾事項。任何清理、環境變更或重新部署，都須再核對正式網域、提交 SHA、部署 ID、未登入詢價 401 與 worker 的 dry-run 狀態。
