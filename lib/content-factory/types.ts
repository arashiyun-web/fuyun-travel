export interface ParsedTrip {
  trip_title: string;
  days: string;
  season: string;
  price: string;
  spots: string[];
  user_notes: string;
  target_audience: string;
  additional_info: string;
}

export interface ContentFactoryInput extends ParsedTrip {
  image_urls: string[];
  cover_image_url: string;
}

export interface GeneratedKeywords {
  primary: string[];
  secondary: string[];
  long_tail: string[];
}

export interface InternalLink {
  anchor: string;
  target: string;
}

export interface SeoArticle {
  h1: string;
  body_markdown: string;
  faq: Array<{ q: string; a: string }>;
}

export interface FacebookContent {
  body: string;
  info_table: {
    行程名稱: string;
    天數: string;
    適合族群: string;
    季節特色: string;
  };
}

export interface EdmContent {
  subject: string;
  body: string;
}

export interface Extras {
  gmb_short: string;
  ai_qa_block: Array<{ q: string; a: string }>;
  ab_test: { fb: string[]; ig: string[] };
}

export interface GeneratedContent {
  meta: {
    trip_title: string;
    generated_keywords: GeneratedKeywords;
    missing_fields: string[];
    internal_links: InternalLink[];
  };
  geo_summary: string;
  seo_article: SeoArticle;
  instagram: { caption: string; hashtags: string[] };
  facebook: FacebookContent;
  line_oa: string;
  edm: EdmContent;
  extras: Extras;
  json_ld: string;
}

export interface ContentDraftItem {
  id: string;
  input: ContentFactoryInput;
  output: GeneratedContent;
  status: "draft" | "reviewing" | "ready" | "published";
  createdAt: string;
}
