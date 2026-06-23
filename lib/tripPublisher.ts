import { findLocationPage } from "@/lib/growthPages";

export const ARTICLE_TYPES = [
  { value: "travel_story", label: "出團紀錄" },
  { value: "charter_guide", label: "包車攻略" },
  { value: "school_trip", label: "校外教學" },
  { value: "corporate_trip", label: "企業旅遊" },
  { value: "airport_transfer", label: "機場接送" },
] as const;

export type ArticleType = (typeof ARTICLE_TYPES)[number]["value"];
export type PhotoPermissionStatus = "not_applicable" | "pending" | "confirmed";

export type SocialCopy = {
  facebook: string;
  lineVoom: string;
  googleBusiness: string;
  threads: string;
  youtubeShorts: string;
};

export type TripPublisherInput = {
  title: string;
  slug: string;
  date: string;
  departure: string;
  destination: string;
  summary: string;
  coverImage: string;
  contentMarkdown: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  relatedCharterRoute: string;
  articleType: ArticleType;
  lineUrl: string;
  photoPermissionStatus: PhotoPermissionStatus;
  faq: Array<{ question: string; answer: string }>;
  socialCopy: SocialCopy;
};

export type PublisherCheck = {
  key: "priceChecked" | "lineUrlChecked" | "slugChecked" | "ctaChecked" | "routeLinkChecked";
  label: string;
  passed: boolean;
  detail: string;
};

const explicitPricePattern = /(?:NT\$|TWD|\$)\s*\d[\d,]*|\d[\d,]*\s*元/i;
const ctaPattern = /(LINE|詢價|預約|聯絡|立即洽詢)/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function articleTypeToCategory(type: ArticleType) {
  switch (type) {
    case "school_trip":
      return "校外教學";
    case "corporate_trip":
      return "企業旅遊";
    case "airport_transfer":
      return "機場接送";
    case "charter_guide":
      return "包車旅遊";
    default:
      return "旅遊攻略";
  }
}

export function evaluatePublisherChecks(
  input: TripPublisherInput,
  slugState: "checking" | "available" | "draft" | "published" = "checking",
): PublisherCheck[] {
  const allCopy = [
    input.summary,
    input.contentMarkdown,
    ...Object.values(input.socialCopy),
  ].join("\n");
  const hasExplicitPrice = explicitPricePattern.test(allCopy);
  const routeExists = Boolean(findLocationPage(input.relatedCharterRoute));
  const lineUrlValid = (() => {
    try {
      const url = new URL(input.lineUrl);
      return url.protocol === "https:" && /(^|\.)line\.me$/i.test(url.hostname);
    } catch {
      return false;
    }
  })();
  const slugFormatValid = slugPattern.test(input.slug);
  const slugPassed = slugFormatValid && (slugState === "available" || slugState === "draft");

  return [
    {
      key: "priceChecked",
      label: "價格安全",
      passed: !hasExplicitPrice,
      detail: hasExplicitPrice
        ? "偵測到明確價格。MVP 不接受未連接核價來源的價格，請改為 LINE 詢價。"
        : "未偵測到未核價的明確金額。",
    },
    {
      key: "lineUrlChecked",
      label: "LINE 連結",
      passed: lineUrlValid,
      detail: lineUrlValid ? "使用有效的 line.me HTTPS 連結。" : "請填入有效的 https://line.me/… 連結。",
    },
    {
      key: "slugChecked",
      label: "Slug",
      passed: slugPassed,
      detail: !slugFormatValid
        ? "僅可使用小寫英文、數字與單一連字號。"
        : slugState === "checking"
          ? "正在確認是否重複。"
          : slugState === "published"
            ? "此 slug 已有已發布文章，禁止直接覆寫。"
            : slugState === "draft"
              ? "格式正確，將更新既有草稿。"
              : "格式正確且可使用。",
    },
    {
      key: "ctaChecked",
      label: "詢價 CTA",
      passed: lineUrlValid && ctaPattern.test(allCopy),
      detail: lineUrlValid && ctaPattern.test(allCopy)
        ? "內容含有明確詢價行動文字，公開頁會顯示 LINE CTA。"
        : "摘要、內文或平台文案需包含 LINE／詢價／預約等行動文字。",
    },
    {
      key: "routeLinkChecked",
      label: "包車路線連結",
      passed: routeExists,
      detail: routeExists
        ? `公開文章會連結 /charter-bus/${input.relatedCharterRoute}。`
        : "請選擇有效的相關包車路線。",
    },
  ];
}

export function schoolPhotoBlocked(input: TripPublisherInput) {
  return input.articleType === "school_trip" && input.photoPermissionStatus !== "confirmed";
}

export function parseKeywords(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,，、\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function parseFaqLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.split(/[｜|]/).map((part) => part.trim()))
    .filter((parts) => parts.length >= 2 && parts[0] && parts.slice(1).join("｜"))
    .map((parts) => ({ question: parts[0], answer: parts.slice(1).join("｜") }));
}
