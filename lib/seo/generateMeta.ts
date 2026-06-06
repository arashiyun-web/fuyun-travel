import { SITE, absoluteUrl } from "@/lib/site";

export function generateMeta(args: {
  title: string;
  description?: string;
  path: string;
  image?: string;
}) {
  const description =
    args.description ||
    `${args.title}｜${SITE.name} 提供台灣包車旅遊、車型建議、FAQ 與立即詢價服務。`;

  return {
    metaTitle: `${args.title}｜${SITE.name}`,
    metaDescription: description,
    canonical: absoluteUrl(args.path),
    openGraph: {
      title: `${args.title}｜${SITE.name}`,
      description,
      url: absoluteUrl(args.path),
      image: args.image || SITE.ogImage,
    },
    twitterCard: "summary_large_image",
  };
}
