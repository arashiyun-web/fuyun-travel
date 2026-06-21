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

## 輸出位置與 metadata

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

每個 `metadata.json` 包含四筆渠道資料，分別對應 SEO、Facebook、Google 商家與 LINE 推播草稿。所有渠道初始狀態均為 `draft`，`reviewer`、`approvedAt` 與 `publishedAt` 均為空值。

生成器也會建立 `content-factory/output/publish-queue.json`，作為人工審核與後續自動化的唯一發布候選清單，但生成器本身不具備任何發布能力。

可執行下列指令檢查輸出完整性：

```bash
pnpm content:check
```

## 人工審核流程

1. 執行 `pnpm content:generate` 產生草稿。
2. 執行 `pnpm content:review`，由發布清單產生 `review-list.md`。
3. 執行 `pnpm content:check` 做格式、用字、UTM 與 draft-only 檢查。
4. 由內容負責人依 priority 確認關鍵字、服務範圍、行程、價格、圖片授權及平台規範。
5. 在草稿與發布清單記錄審核人、核准時間與修改備註。
6. 審核通過後，才可由人工或另一個受控流程改變核准狀態。
7. 發布工具只允許處理已核准內容，並保留發布時間與平台回應。

## UTM 規則

- `utm_campaign` 固定為 `summer_2026`。
- `utm_source`：Facebook 為 `facebook`、Google 商家為 `google_business`、LINE 為 `line`、SEO 為 `seo`。
- `utm_medium`：Facebook 為 `social`、Google 商家為 `organic`、LINE 為 `push`、SEO 為 `search`。
- `utm_content` 固定使用 topic id。
- `landingUrl` 由對應 SEO 候選頁或詢價頁加上上述 UTM 參數產生。

## publish-queue 用法

`content-factory/output/publish-queue.json` 每篇草稿一筆，共包含 topic、channel、檔案路徑、priority、建議日期與審核狀態。新產生的項目一律為 `status: draft`、`approved: false`、`published: false`。

人工審核時可更新 reviewer 與內部核准資訊，但不應直接由生成器改成已發布。若重新執行 `content:generate`，發布清單會重建為安全的 draft 狀態。

## review-list 用法

執行：

```bash
pnpm content:review
```

產生 `content-factory/output/review-list.md`，依 high、medium、low 分組，提供標題、渠道、關鍵字、檔案路徑、落地頁與 CTA，供人工逐項勾選。

## 串接 n8n

n8n 應先讀取 `publish-queue.json`，只建立審核任務，不直接呼叫平台發布 API。建議依 `priority` 與 `suggestedPublishDate` 排序，讀取 `filePath` 指向的草稿，等待人工更新 reviewer 與核准狀態後，再交給權限隔離的發布工作流。

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

AI 可能產生錯誤服務資訊、過度承諾、失效連結或不符合平台政策的內容，因此 AI 僅負責草稿，不得自行做出商業發布決策。

- AI 產出一律標記為 `draft`。
- 發布清單一律以 `approved: false`、`published: false` 建立。
- 生成流程與發布流程分離，生成器不持有平台發布憑證。
- 發布工作流必須檢查人工核准狀態、審核人與審核時間。
- 不以檔案存在或生成成功視為審核通過。
- 禁止生成器直接呼叫 Facebook、Google 商家或 LINE 發布 API。
- 對外發布前再次檢查內容、連結、圖片授權、價格與服務條件。
