# Worktree Guard

僅限修改 API、LINE webhook、報價引擎、後端邏輯、測試。禁止改前端視覺、SEO 頁、行銷文案。

## 強制規則(依 AI-PIPELINE-v1.0.md)
- 禁止修改本 worktree 職責以外的檔案。
- 禁止直接修改 main。
- 完成必須執行測試或 build,並 commit。
- 不得提交 .env / .env.local / 金鑰 / token。
- 風格凍結:不動既有 UI/CSS/配色/字體/佈局,必須碰先標註。
