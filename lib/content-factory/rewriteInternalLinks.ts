import type { GeneratedContent, InternalLink } from "./types";
import {
  canonicalizeSitePath,
  findBestPage,
  isSitemapPath,
  toCanonicalUrl,
} from "./internalPages";

const MARKDOWN_LINK_RE = /(?<!!)\[([^\]]*)\]\(([^)]*)\)/g;
const HTML_HREF_RE = /(<a\b[^>]*\bhref\s*=\s*)(["'])([^"']*)\2/gi;

export type ResolvedLink = { action: "keep" | "replace" | "strip"; href?: string };

function queryFor(href: string, anchor: string): string {
  const parsed = canonicalizeSitePath(href);
  const path = parsed.kind === "internal" ? parsed.path || "" : "";
  return [anchor, href, path.replace(/[-/]/g, " ")].filter(Boolean).join(" ");
}

export function resolveInternalHref(href: string, anchor = ""): ResolvedLink {
  const parsed = canonicalizeSitePath(href);
  if (parsed.kind === "external") {
    return { action: "keep", href: href.trim() };
  }
  if (parsed.kind === "internal" && parsed.path && isSitemapPath(parsed.path)) {
    return { action: "keep", href: toCanonicalUrl(parsed.path) };
  }
  const page = findBestPage(queryFor(href, anchor));
  if (page) return { action: "replace", href: toCanonicalUrl(page.path) };
  return { action: "strip" };
}

function rewriteMarkdown(text: string): string {
  return text.replace(MARKDOWN_LINK_RE, (full, anchor: string, target: string) => {
    const parts = target.trim().split(/\s+/, 2);
    const href = parts[0] || "";
    const title = parts[1] ? ` ${parts[1]}` : "";
    const resolved = resolveInternalHref(href, anchor);
    if (resolved.action === "strip") return anchor;
    if (resolved.action === "replace" || (resolved.href && resolved.href !== href)) {
      return `[${anchor}](${resolved.href}${title})`;
    }
    return full;
  });
}

function rewriteHtmlHrefs(text: string): string {
  return text.replace(HTML_HREF_RE, (full, prefix: string, quote: string, href: string) => {
    const resolved = resolveInternalHref(href, "");
    if (resolved.action === "strip") return `${prefix}${quote}${quote}`;
    if (resolved.href && resolved.href !== href) return `${prefix}${quote}${resolved.href}${quote}`;
    return full;
  });
}

export function rewriteTextLinks(text: string): string {
  if (!text) return text;
  return rewriteHtmlHrefs(rewriteMarkdown(text));
}

function rewriteQuestions(rows: Array<{ q: string; a: string }>): Array<{ q: string; a: string }> {
  return rows.map((row) => ({ q: rewriteTextLinks(row.q), a: rewriteTextLinks(row.a) }));
}

function collectMarkdownLinks(text: string): InternalLink[] {
  const links: InternalLink[] = [];
  const re = /(?<!!)\[([^\]]*)\]\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const href = (match[2] || "").trim().split(/\s+/, 1)[0] || "";
    const parsed = canonicalizeSitePath(href);
    if (parsed.kind === "internal" && parsed.path && isSitemapPath(parsed.path)) {
      links.push({ anchor: match[1] || "", target: toCanonicalUrl(parsed.path) });
    }
  }
  return links;
}

function rewriteInternalLinkList(links: InternalLink[], fallbacks: InternalLink[]): InternalLink[] {
  const resolved: InternalLink[] = [];
  const seen = new Set<string>();
  const push = (anchor: string, target: string) => {
    const key = `${anchor}@@${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    resolved.push({ anchor, target });
  };
  for (const link of links) {
    const result = resolveInternalHref(link.target, link.anchor);
    if (result.action === "strip" || !result.href) continue;
    const parsed = canonicalizeSitePath(result.href);
    if (parsed.kind !== "internal" || !parsed.path || !isSitemapPath(parsed.path)) continue;
    push(link.anchor, toCanonicalUrl(parsed.path));
  }
  if (!resolved.length) {
    for (const link of fallbacks) push(link.anchor, link.target);
  }
  return resolved;
}

export function rewriteGeneratedContent(content: GeneratedContent): GeneratedContent {
  const seoBody = rewriteTextLinks(content.seo_article.body_markdown);
  const faqs = rewriteQuestions(content.seo_article.faq);
  const facebookBody = rewriteTextLinks(content.facebook.body);
  const instagram = rewriteTextLinks(content.instagram.caption);
  const line = rewriteTextLinks(content.line_oa);
  const edmBody = rewriteTextLinks(content.edm.body);
  const extrasQa = rewriteQuestions(content.extras.ai_qa_block);
  const gmb = rewriteTextLinks(content.extras.gmb_short);
  const geo = rewriteTextLinks(content.geo_summary);
  const bodyLinks = [
    ...collectMarkdownLinks(seoBody),
    ...collectMarkdownLinks(faqs.map((row) => `${row.q} ${row.a}`).join("\n")),
  ];
  return {
    ...content,
    geo_summary: geo,
    seo_article: { ...content.seo_article, body_markdown: seoBody, faq: faqs },
    facebook: { ...content.facebook, body: facebookBody },
    instagram: { ...content.instagram, caption: instagram },
    line_oa: line,
    edm: { ...content.edm, body: edmBody },
    extras: { ...content.extras, gmb_short: gmb, ai_qa_block: extrasQa },
    meta: {
      ...content.meta,
      internal_links: rewriteInternalLinkList(content.meta.internal_links, bodyLinks),
    },
  };
}
