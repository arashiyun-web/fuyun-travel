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
- 未完成：乾淨 build 被 §3 的既有錯誤阻擋；尚未推送；正式站未套用
- 正式站是否仍接受舊憑證：未驗證（對正式站的 live probe 被 auto-mode 拒絕，需持有人核准）

## 5. 其他風險
- public/platform/app.js 的 demo OWNER_ACCOUNT 在公開 JS 中含明文 demo 密碼（僅 localStorage demo，不經伺服器登入）；需確認該密碼未在其他地方重用
