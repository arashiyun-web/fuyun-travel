import type { GeneratedContent } from "./types";

export type ContentChannel = "geo_summary" | "seo_article" | "facebook" | "instagram" | "x" | "line_oa" | "edm" | "extras" | "json_ld";
export type ChannelEdits = Partial<Record<ContentChannel, string>>;

/** Edit the main text separately so FAQ, hashtags, subject and information tables remain structured. */
export function editableChannelText(content: GeneratedContent, key: ContentChannel): string {
  switch (key) {
    case "seo_article": return content.seo_article.body_markdown;
    case "facebook": return content.facebook.body;
    case "instagram": return content.instagram.caption;
    case "x": return content.x?.body || "";
    case "edm": return content.edm.body;
    case "extras": return content.extras.gmb_short;
    default: return content[key];
  }
}

export function applyChannelEdits(content: GeneratedContent, edits: ChannelEdits): GeneratedContent {
  return {
    ...content,
    geo_summary: edits.geo_summary ?? content.geo_summary,
    seo_article: { ...content.seo_article, body_markdown: edits.seo_article ?? content.seo_article.body_markdown },
    facebook: { ...content.facebook, body: edits.facebook ?? content.facebook.body },
    instagram: { ...content.instagram, caption: edits.instagram ?? content.instagram.caption },
    ...(content.x || edits.x !== undefined ? { x: { body: edits.x ?? content.x?.body ?? "" } } : {}),
    line_oa: edits.line_oa ?? content.line_oa,
    edm: { ...content.edm, body: edits.edm ?? content.edm.body },
    extras: { ...content.extras, gmb_short: edits.extras ?? content.extras.gmb_short },
    json_ld: edits.json_ld ?? content.json_ld,
  };
}
