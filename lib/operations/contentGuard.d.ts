export interface ApprovedFacts {
  version: string;
  price?: { amount: number; currency: string; unit: "per_vehicle" | "per_person" } | null;
  durationHours?: number | null;
  includes?: string[];
  excludes?: string[];
  dates?: string[];
  seats?: number | null;
  validUntil?: string | null;
  [key: string]: unknown;
}
export interface GuardViolation { code: string; detail: string }
export declare const INCLUDABLE_ITEMS: string[];
export declare const KNOWN_PLACES: string[];
export declare function renderFactsBlock(facts: ApprovedFacts | null): string;
export declare function validateGenerated(
  text: string,
  facts: ApprovedFacts | null,
  now?: Date,
  options?: { allowedPlaces?: string[] | null; maxChars?: number | null },
): { ok: boolean; violations: GuardViolation[] };
export declare function composeDraft(args: {
  modelText: string;
  templateText: string;
  facts: ApprovedFacts | null;
  now?: Date;
  allowedPlaces?: string[];
  maxChars?: number;
}): { text: string; source: "model" | "template_fallback"; violations: GuardViolation[]; requiresHuman: boolean; status: "pending_approval" };
export declare function approvalHash(args: { text: string; imageSha256s?: string[]; platform: string; account?: string | null; factsVersion?: string | null }): string;
export declare function isApprovalValid(approval: { hash?: string | null } | null | undefined, current: { text: string; imageSha256s?: string[]; platform: string; account?: string | null; factsVersion?: string | null }): boolean;
