import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const factoryDirectory = path.resolve(scriptDirectory, "..");
const topicsPath = path.join(factoryDirectory, "data", "summer-campaign-topics.json");
const outputDirectory = path.join(factoryDirectory, "output");

const CTA = "請提供日期、人數、出發地、目的地，我們會儘速回覆優惠方案。";
const REQUIRED_DRAFTS = ["seo.md", "facebook.md", "google-business.md", "line-push.md"];
const SIMPLIFIED_CHINESE_TERMS = ["旅游", "出租车", "联系"];

async function main() {
  const topics = JSON.parse(await readFile(topicsPath, "utf8"));
  const errors = [];

  if (!Array.isArray(topics) || topics.length === 0) {
    throw new Error("summer-campaign-topics.json 必須包含至少一筆主題。");
  }

  for (const topic of topics) {
    for (const fileName of REQUIRED_DRAFTS) {
      const filePath = path.join(outputDirectory, topic.id, fileName);

      try {
        const fileStat = await stat(filePath);
        const content = await readFile(filePath, "utf8");

        if (!fileStat.isFile() || fileStat.size === 0 || !content.trim()) {
          errors.push(`${topic.id}/${fileName} 是空檔案。`);
        }

        if (!content.includes(CTA)) {
          errors.push(`${topic.id}/${fileName} 缺少固定 CTA。`);
        }

        for (const term of SIMPLIFIED_CHINESE_TERMS) {
          if (content.includes(term)) {
            errors.push(`${topic.id}/${fileName} 包含簡體中文常見字詞：${term}`);
          }
        }
      } catch {
        errors.push(`${topic.id}/${fileName} 不存在或無法讀取。`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(
    `檢查通過：${topics.length} 個主題均包含 4 種非空白草稿、固定 CTA，且未發現指定簡體字詞。`
  );
}

main().catch((error) => {
  console.error("內容草稿檢查失敗：", error);
  process.exitCode = 1;
});
