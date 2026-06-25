# Worktree Guard

僅限修改 UI、前端樣式、元件、版面、文案呈現。禁止改 API、LINE webhook、資料庫、報價邏輯、SEO 路由。

## 強制規則(依 AI-PIPELINE-v1.0.md)
- 禁止修改本 worktree 職責以外的檔案。
- 禁止直接修改 main。
- 完成必須執行測試或 build,並 commit。
- 不得提交 .env / .env.local / 金鑰 / token。
- 風格凍結:不動既有 UI/CSS/配色/字體/佈局,必須碰先標註。
