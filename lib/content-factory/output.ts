import type { GeneratedContent } from "./types";

type Obj = Record<string, unknown>;
function object(value: unknown): Obj {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid content object");
  return value as Obj;
}
function text(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new Error("Invalid content text");
  return value;
}
function texts(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error("Invalid content list");
  return value;
}
function questions(value: unknown): Array<{ q: string; a: string }> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid questions");
  return value.map((item) => {
    const row = object(item);
    return { q: text(row.q), a: text(row.a) };
  });
}

/** Treat provider JSON as untrusted; normalize omissions and reject incompatible field types. */
export function normalizeGeneratedContent(value: unknown): GeneratedContent {
  const root = object(value);
  const facebook = object(root.facebook), instagram = object(root.instagram), seo = object(root.seo_article);
  const fbBody = text(facebook.body), igBody = text(instagram.caption), webBody = text(seo.body_markdown);
  if (!fbBody.trim() || !igBody.trim() || !webBody.trim()) throw new Error("Missing platform content");
  const meta = object(root.meta), keywords = object(meta.generated_keywords), table = object(facebook.info_table);
  const edm = object(root.edm), extras = object(root.extras), ab = object(extras.ab_test);
  const x = object(root.x);
  if (meta.internal_links !== undefined && !Array.isArray(meta.internal_links)) throw new Error("Invalid internal links");
  const internalLinks = ((meta.internal_links || []) as unknown[]).map((item) => {
    const row = object(item);
    return { anchor: text(row.anchor), target: text(row.target) };
  });
  let jsonLd = "";
  if (root.json_ld !== undefined) {
    jsonLd = typeof root.json_ld === "string" ? root.json_ld : JSON.stringify(object(root.json_ld));
  }
  return {
    meta: { trip_title: text(meta.trip_title), generated_keywords: { primary: texts(keywords.primary), secondary: texts(keywords.secondary), long_tail: texts(keywords.long_tail) }, missing_fields: texts(meta.missing_fields), internal_links: internalLinks },
    geo_summary: text(root.geo_summary),
    seo_article: { h1: text(seo.h1), body_markdown: webBody, faq: questions(seo.faq) },
    facebook: { body: fbBody, info_table: { 行程名稱: text(table.行程名稱), 天數: text(table.天數), 適合族群: text(table.適合族群), 季節特色: text(table.季節特色) } },
    instagram: { caption: igBody, hashtags: texts(instagram.hashtags) },
    // Preserve the previous operations conversion's X derivation, now in the persisted draft itself.
    x: { body: Array.from(text(x.body).trim() || fbBody).slice(0, 280).join("") },
    line_oa: text(root.line_oa),
    edm: { subject: text(edm.subject), body: text(edm.body) },
    extras: { gmb_short: text(extras.gmb_short), ai_qa_block: questions(extras.ai_qa_block), ab_test: { fb: texts(ab.fb), ig: texts(ab.ig) } },
    json_ld: jsonLd,
  };
}
