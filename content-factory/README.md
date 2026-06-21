# 暑假 Content Factory + AutoSEO 基礎版

## 模組用途

此模組集中管理暑假旅遊、包車、遊覽車出租、校外教學、企業旅遊與機場接送的內容主題、渠道模板及 SEO 頁面候選資料。現階段只產生草稿，不會直接發布到官網或任何站外平台。

所有草稿均使用「雲陞通運 × 浮雲輕鬆遊」品牌用語，並保留人工確認與發布狀態欄位，供後續串接 n8n、GX10 或 Qwen。

## 產生草稿

在專案根目錄執行：

```bash
pnpm content:generate
```

此指令會讀取 `content-factory/data/summer-campaign-topics.json`，並套用 `content-factory/templates/` 內的四種模板。

## 輸出位置

每個主題會輸出到：

```text
content-factory/output/{topic-id}/
```

每個資料夾包含：

- `seo.md`
- `facebook.md`
- `google-business.md`
- `line-push.md`
- `metadata.json`

可執行下列指令檢查輸出完整性：

```bash
pnpm content:check
```

## 人工審核流程

1. 執行 `pnpm content:generate` 產生草稿。
2. 執行 `pnpm content:check` 做基本格式與用字檢查。
3. 由內容負責人確認關鍵字、服務範圍、行程、價格、圖片授權及平台規範。
4. 在草稿的「人工確認欄位」填入審核人、日期與修改備註。
5. 審核通過後，才可將發布狀態由 `draft` 改為內部約定的核准狀態。
6. 發布工具只允許處理已核准內容，並保留發布紀錄。

## 串接 n8n

n8n 可透過受控的檔案節點或 API 讀取 topics、templates 與 output。建議流程：讀取 draft 主題、呼叫模型、寫入獨立草稿區、執行檢查、建立人工審核任務，最後只將已核准內容交給獨立發布流程。

正式環境應限制 n8n 的檔案權限、憑證存取與可發布平台，並保留每次執行的輸入、輸出及審核紀錄。

## 串接 GX10 / Qwen

可將 topic JSON 與對應 Markdown 模板組成提示內容，再由本機 GX10 上執行的 Qwen 產生草稿。模型輸出必須：

- 僅寫入草稿輸出位置。
- 使用繁體中文及固定品牌、信任點與 CTA。
- 不捏造價格、車型、執照、空位或活動時效。
- 保留 `draft` 與 `requiresHumanApproval: true`。
- 完成後執行 `pnpm content:check`。

後續可在 `generate-drafts.mjs` 前增加模型生成階段，或由 n8n 呼叫本機模型 API；目前腳本維持零外部模型相依，先驗證資料結構與審核流程。

## 避免未審核內容自動發布

- AI 產出一律標記為 `draft`。
- metadata 必須保留 `requiresHumanApproval: true`。
- 生成流程與發布流程分離，生成器不持有平台發布憑證。
- 發布工作流必須檢查人工核准狀態、審核人與審核時間。
- 不以檔案存在或生成成功視為審核通過。
- 對外發布前再次檢查內容、連結、圖片授權、價格與服務條件。
