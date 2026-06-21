import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const factoryDirectory = path.resolve(scriptDirectory, "..");
const topicsPath = path.join(factoryDirectory, "data", "summer-campaign-topics.json");
const templatesDirectory = path.join(factoryDirectory, "templates");
const outputDirectory = path.join(factoryDirectory, "output");

const CTA = "請提供日期、人數、出發地、目的地，我們會儘速回覆優惠方案。";
const TRUST_POINTS = [
  "合法旅行社",
  "自有遊覽車車隊",
  "專人協助安排",
  "板橋、新莊、土城、樹林、三峽、中和、永和皆可服務",
  "家庭旅遊、企業旅遊、校外教學、機場接送皆可安排"
];
const draftTypes = [
  { template: "seo-article-template.md", output: "seo.md", titlePrefix: "" },
  { template: "facebook-post-template.md", output: "facebook.md", titlePrefix: "暑假出遊提案｜" },
  { template: "google-business-post-template.md", output: "google-business.md", titlePrefix: "暑假服務推薦｜" },
  { template: "line-push-template.md", output: "line-push.md", titlePrefix: "暑假輕鬆遊｜" }
];

function toBulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function getAudience(topic) {
  const audiences = {
    校外教學: ["各級學校與補習班", "教師、學生與家長團體"],
    企業旅遊: ["企業福委會與人資單位", "部門活動與員工旅遊團體"],
    機場接送: ["多人同行家庭", "攜帶大型行李的旅客", "企業差旅團體"],
    遊覽車出租: ["大型家庭與親友團體", "公司、學校與社團"],
    樂園包車: ["親子家庭", "親友與學生團體"],
    一日遊: ["家庭與親子旅客", "朋友、社團與企業小旅行"]
  };

  return audiences[topic.category] ?? ["家庭與親子旅客", "朋友、企業與社團團體"];
}

function getSuggestedUse(topic) {
  const uses = {
    校外教學: ["學校集合點往返校外教學場地", "可依課程、用餐與參訪時段調整動線"],
    企業旅遊: ["員工一日遊、二日遊與部門活動", "可依預算與人數安排車輛及行程"],
    機場接送: ["雙北地區往返桃園機場", "依班機時間、乘客與行李數量安排車輛"],
    遊覽車出租: ["企業活動、校外教學與大型團體旅遊", "依乘車人數、集合點與路線安排車輛"],
    樂園包車: [`${topic.target_area}樂園接送`, "可安排定點往返或搭配周邊景點"],
    一日遊: [`${topic.target_area}景點一日遊`, "可依成員年齡與停留時間彈性調整"]
  };

  return uses[topic.category] ?? [
    `${topic.target_area}一日遊或多日旅遊`,
    "可安排定點接送、景點串聯與團體用車"
  ];
}

function renderTemplate(template, topic, titlePrefix) {
  const replacements = {
    主標: `${titlePrefix}${topic.suggested_title}`,
    副標: `${topic.target_area}暑假交通與行程草稿，等待人工確認後發布`,
    內容摘要: `正在規劃${topic.keyword}嗎？我們可依日期、人數、出發地與目的地，協助安排適合的車輛與行程。本內容回應「${topic.search_intent}」需求，實際服務內容以人工確認及正式報價為準。`,
    服務重點: toBulletList([
      `${topic.keyword}行程與交通需求評估`,
      "依人數、路線與行李需求安排合適車輛",
      "出發前由專人確認集合地點與行程細節"
    ]),
    適合對象: toBulletList(getAudience(topic)),
    建議行程用途: toBulletList(getSuggestedUse(topic)),
    信任點: toBulletList(TRUST_POINTS),
    CTA: topic.cta || CTA
  };

  return Object.entries(replacements).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

async function main() {
  const topics = JSON.parse(await readFile(topicsPath, "utf8"));
  const templates = new Map(
    await Promise.all(
      draftTypes.map(async ({ template }) => [
        template,
        await readFile(path.join(templatesDirectory, template), "utf8")
      ])
    )
  );

  await mkdir(outputDirectory, { recursive: true });

  for (const topic of topics) {
    const topicDirectory = path.join(outputDirectory, topic.id);
    await mkdir(topicDirectory, { recursive: true });

    for (const draftType of draftTypes) {
      const content = renderTemplate(
        templates.get(draftType.template),
        topic,
        draftType.titlePrefix
      );
      await writeFile(
        path.join(topicDirectory, draftType.output),
        `${content.trim()}\n`,
        "utf8"
      );
    }

    const metadata = {
      topicId: topic.id,
      keyword: topic.keyword,
      category: topic.category,
      targetArea: topic.target_area,
      searchIntent: topic.search_intent,
      suggestedTitle: topic.suggested_title,
      cta: topic.cta || CTA,
      status: "draft",
      requiresHumanApproval: true,
      generatedFiles: draftTypes.map(({ output }) => output)
    };

    await writeFile(
      path.join(topicDirectory, "metadata.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8"
    );
  }

  console.log(`已產生 ${topics.length} 組暑假內容草稿：${outputDirectory}`);
}

main().catch((error) => {
  console.error("內容草稿產生失敗：", error);
  process.exitCode = 1;
});
