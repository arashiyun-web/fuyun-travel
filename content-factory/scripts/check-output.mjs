import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const factoryDirectory = path.resolve(scriptDirectory, "..");
const topicsPath = path.join(factoryDirectory, "data", "summer-campaign-topics.json");
const outputDirectory = path.join(factoryDirectory, "output");
const publishQueuePath = path.join(outputDirectory, "publish-queue.json");
const reviewListPath = path.join(outputDirectory, "review-list.md");

const CTA = "請提供日期、人數、出發地、目的地，我們會儘速回覆優惠方案。";
const REQUIRED_DRAFTS = ["seo.md", "facebook.md", "google-business.md", "line-push.md"];
const REQUIRED_CHANNELS = ["seo", "facebook", "google-business", "line-push"];
const SIMPLIFIED_CHINESE_TERMS = ["旅游", "出租车", "联系"];
const HIGH_RISK_TERMS = ["立即付款", "保證最低價", "一定有車"];
const REQUIRED_UTM_FIELDS = ["utmSource", "utmMedium", "utmCampaign", "utmContent"];

async function readRequiredFile(filePath, label, errors) {
  try {
    const fileStat = await stat(filePath);
    const content = await readFile(filePath, "utf8");
    if (!fileStat.isFile() || fileStat.size === 0 || !content.trim()) {
      errors.push(`${label} 是空檔案。`);
      return null;
    }
    return content;
  } catch {
    errors.push(`${label} 不存在或無法讀取。`);
    return null;
  }
}

function checkForbiddenTerms(content, label, errors) {
  for (const term of [...SIMPLIFIED_CHINESE_TERMS, ...HIGH_RISK_TERMS]) {
    if (content.includes(term)) {
      errors.push(`${label} 包含禁止字詞：${term}`);
    }
  }
}

function checkMetadata(topic, metadata, errors) {
  if (!Array.isArray(metadata) || metadata.length !== REQUIRED_CHANNELS.length) {
    errors.push(`${topic.id}/metadata.json 必須包含 4 筆渠道 metadata。`);
    return;
  }

  const channels = new Set(metadata.map(({ channel }) => channel));
  for (const channel of REQUIRED_CHANNELS) {
    if (!channels.has(channel)) {
      errors.push(`${topic.id}/metadata.json 缺少 ${channel} 渠道。`);
    }
  }

  for (const entry of metadata) {
    const label = `${topic.id}/metadata.json (${entry.channel ?? "unknown"})`;
    if (entry.status !== "draft") {
      errors.push(`${label} status 必須是 draft。`);
    }
    if (entry.approved === true || entry.published === true) {
      errors.push(`${label} 不可標記為已核准或已發布。`);
    }
    for (const field of REQUIRED_UTM_FIELDS) {
      if (!entry[field] || !String(entry[field]).trim()) {
        errors.push(`${label} 缺少 ${field}。`);
      }
    }
    if (entry.utmCampaign !== "summer_2026") {
      errors.push(`${label} utmCampaign 必須是 summer_2026。`);
    }
    if (entry.utmContent !== topic.id) {
      errors.push(`${label} utmContent 必須等於 topic id。`);
    }
    if (!entry.landingUrl || !entry.landingUrl.trim()) {
      errors.push(`${label} landingUrl 不可空白。`);
    }
    if (!entry.lineCtaUrl || !entry.lineCtaUrl.trim()) {
      errors.push(`${label} lineCtaUrl 不可空白。`);
    }
  }
}

async function main() {
  const topics = JSON.parse(await readFile(topicsPath, "utf8"));
  const errors = [];

  if (!Array.isArray(topics) || topics.length === 0) {
    throw new Error("summer-campaign-topics.json 必須包含至少一筆主題。");
  }

  for (const topic of topics) {
    for (const fileName of REQUIRED_DRAFTS) {
      const filePath = path.join(outputDirectory, topic.id, fileName);
      const content = await readRequiredFile(
        filePath,
        `${topic.id}/${fileName}`,
        errors
      );
      if (!content) continue;
      if (!content.includes(CTA)) {
        errors.push(`${topic.id}/${fileName} 缺少固定 CTA。`);
      }
      checkForbiddenTerms(content, `${topic.id}/${fileName}`, errors);
    }

    const metadataContent = await readRequiredFile(
      path.join(outputDirectory, topic.id, "metadata.json"),
      `${topic.id}/metadata.json`,
      errors
    );
    if (metadataContent) {
      try {
        checkMetadata(topic, JSON.parse(metadataContent), errors);
        checkForbiddenTerms(metadataContent, `${topic.id}/metadata.json`, errors);
      } catch {
        errors.push(`${topic.id}/metadata.json 不是有效 JSON。`);
      }
    }
  }

  const queueContent = await readRequiredFile(
    publishQueuePath,
    "publish-queue.json",
    errors
  );
  if (queueContent) {
    try {
      const queue = JSON.parse(queueContent);
      if (!Array.isArray(queue) || queue.length !== topics.length * REQUIRED_CHANNELS.length) {
        errors.push("publish-queue.json 筆數必須等於主題數 × 4 個渠道。");
      } else {
        for (const item of queue) {
          if (item.status !== "draft") {
            errors.push(`${item.id} status 必須是 draft。`);
          }
          if (item.approved === true) {
            errors.push(`${item.id} 不可出現 approved: true。`);
          }
          if (item.published === true) {
            errors.push(`${item.id} 不可出現 published: true。`);
          }
          if (!item.landingUrl || !item.landingUrl.trim()) {
            errors.push(`${item.id} landingUrl 不可空白。`);
          }
        }
      }
      checkForbiddenTerms(queueContent, "publish-queue.json", errors);
    } catch {
      errors.push("publish-queue.json 不是有效 JSON。");
    }
  }

  const reviewListContent = await readRequiredFile(
    reviewListPath,
    "review-list.md",
    errors
  );
  if (reviewListContent) {
    checkForbiddenTerms(reviewListContent, "review-list.md", errors);
  }

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(
    `檢查通過：${topics.length} 個主題、${topics.length * 4} 篇草稿、UTM、發布清單與人工審核清單均符合 draft-only 規則。`
  );
}

main().catch((error) => {
  console.error("內容草稿檢查失敗：", error);
  process.exitCode = 1;
});
