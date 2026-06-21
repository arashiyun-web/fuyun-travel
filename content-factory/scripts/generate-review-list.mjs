import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const factoryDirectory = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(factoryDirectory, "output");
const queuePath = path.join(outputDirectory, "publish-queue.json");
const topicsPath = path.join(factoryDirectory, "data", "summer-campaign-topics.json");
const reviewListPath = path.join(outputDirectory, "review-list.md");
const priorities = ["high", "medium", "low"];

async function main() {
  const [queue, topics] = await Promise.all([
    readFile(queuePath, "utf8").then(JSON.parse),
    readFile(topicsPath, "utf8").then(JSON.parse)
  ]);
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const sections = ["# 暑假內容審核清單"];

  for (const priority of priorities) {
    sections.push(`## ${priority}`);
    const items = queue.filter((item) => item.priority === priority);

    if (items.length === 0) {
      sections.push("目前無項目。");
      continue;
    }

    for (const item of items) {
      const topic = topicById.get(item.topicId);
      if (!topic) {
        throw new Error(`找不到發布清單主題：${item.topicId}`);
      }

      sections.push(
        `- [ ] ${item.title}`,
        "",
        `  - channel: ${item.channel}`,
        `  - keyword: ${topic.keyword}`,
        `  - filePath: ${item.filePath}`,
        `  - landingUrl: ${item.landingUrl}`,
        `  - CTA: ${topic.cta}`
      );
    }
  }

  await writeFile(reviewListPath, `${sections.join("\n\n")}\n`, "utf8");
  console.log(`已產生 ${queue.length} 筆人工審核清單：${reviewListPath}`);
}

main().catch((error) => {
  console.error("人工審核清單產生失敗：", error);
  process.exitCode = 1;
});
