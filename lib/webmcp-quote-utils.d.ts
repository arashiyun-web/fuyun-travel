// lib/webmcp-quote-utils.d.ts — TypeScript type declarations（Next type-check 用）
// 實際匯入目標：同目錄 webmcp-quote-utils.mjs（ES 模組）。

export declare const LINE_OA_CODE: string;
export declare const LINE_BASE: string;
export declare const FALLBACK_EMAIL: string;

export declare function validateQuote(input: {
  from?: string | null;
  to?: string | null;
  date?: string | null;
  party?: string | number | null;
}): {
  ok: boolean;
  errors: string[];
  normalized: {
    from: string | null;
    to: string | null;
    date: string | null;
    party: number | null;
  };
};

export declare function buildQuoteMessage(input: {
  from?: string | null;
  to?: string | null;
  date?: string | null;
  party?: string | number | null;
  luggage?: string | null;
  notes?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
}): string;

export declare function buildLineUrl(message: string | null): string;
export declare function buildMailto(message: string | null, subject?: string): string;
