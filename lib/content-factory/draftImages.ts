import { publicFleetProfile, publicFleetProfiles } from "@/lib/fleetCatalog";
import { fleetItems } from "@/lib/siteContent";
import { SITE_ORIGIN } from "./internalPages";
import { isPublicDraftImage } from "./sources";
import type { GeneratedContent } from "./types";

export const DRAFT_IMAGE_LIMIT = 20;
export const FLEET_PHOTO_LIMIT = 3;
export const ARTICLE_IMAGE_LIMIT = 4;

export type FleetVehicleMatch = {
  slug: string;
  title: string;
  photos: string[];
};

export type DraftImagePlan = {
  image_urls: string[];
  cover_image_url: string;
  fleet: FleetVehicleMatch | null;
  spotImages: string[];
  fleetImages: string[];
  spotTitle: string;
};

type InputFields = {
  trip_title?: string;
  user_notes?: string;
  additional_info?: string;
  target_audience?: string;
  days?: string;
  season?: string;
  price?: string;
  spots?: string[];
};

type VehicleRecord = {
  slug: string;
  title: string;
  photos: string[];
  tokens: string[];
  capacity: number | null;
};

/** Common capacity names, applied only when that slug exists in the catalog. Not photo paths. */
const SLUG_ALIASES: { [slug: string]: string[] } = {
  "mercedes-van": ["小巴", "九人座", "賓士", "賓士小車", "9人座", "九人座小車"],
  "toyota-midibus": ["中巴", "中型巴士", "豐田中巴"],
  "coach-42": ["大巴", "42人座", "42 人座", "42人座大巴"],
};

function unique(values: string[]): string[] {
  const seen: { [key: string]: true } = {};
  const out: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!value || seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }
  return out;
}

function normalizeKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function toAbsoluteSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hostname === "www.fuyuntravel.com" || url.hostname === "fuyuntravel.com") {
        return SITE_ORIGIN + url.pathname + url.search;
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }
  if (trimmed.startsWith("/")) return SITE_ORIGIN + trimmed;
  return trimmed;
}

function imageKey(value: string): string {
  const absolute = toAbsoluteSiteUrl(value);
  try {
    const url = new URL(absolute);
    return (url.origin + url.pathname).replace(/\/$/, "").toLowerCase();
  } catch {
    return normalizeKey(absolute.replace(/\/$/, ""));
  }
}

function canonicalizeDraftImage(value: string): string | null {
  const direct = isPublicDraftImage(value) ? value : "";
  const absolute = toAbsoluteSiteUrl(value);
  const candidate = direct || (isPublicDraftImage(absolute) ? absolute : "");
  if (!candidate) return null;
  // Store first-party fleet photos as absolute site URLs so they pass
  // isPublicDraftImage even when a caller only allows https or /images/.
  if (candidate.startsWith("/fleet/") || /https:\/\/([a-z0-9-]+\.)?fuyuntravel\.com\/fleet\//i.test(candidate)) {
    return toAbsoluteSiteUrl(candidate);
  }
  return candidate;
}

function dedupeImages(values: string[]): string[] {
  const seen: { [key: string]: true } = {};
  const out: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const normalized = canonicalizeDraftImage(values[i]);
    if (!normalized) continue;
    const key = imageKey(normalized);
    if (seen[key]) continue;
    seen[key] = true;
    out.push(normalized);
  }
  return out;
}

function latinBoundaryMatch(token: string, haystack: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)", "i").test(haystack);
}

export function tokenOccursIn(token: string, haystack: string): boolean {
  const needle = token.trim();
  if (!needle) return false;
  if (/^[a-z0-9][a-z0-9\-]*$/i.test(needle)) {
    return latinBoundaryMatch(needle, haystack);
  }
  return haystack.toLowerCase().indexOf(needle.toLowerCase()) !== -1;
}

function parseCapacity(title: string, keywords: string[], summary: string, detail: string): number | null {
  const primary = [title].concat(keywords).concat([summary]).join(" ");
  const seat = primary.match(/(\d+)\s*人座/);
  if (seat) return parseInt(seat[1], 10);
  if (/九人座/.test(primary)) return 9;
  const wider = primary + " " + (detail || "");
  const passengers = wider.match(/最多\s*(\d+)\s*位乘客/);
  if (passengers) return parseInt(passengers[1], 10);
  const withDriver = wider.match(/含司機\s*(\d+)\s*座/);
  if (withDriver) return parseInt(withDriver[1], 10);
  if (/九人座/.test(wider)) return 9;
  return null;
}

/** Service phrases like 遊覽車包車 are catalog keywords, not a unique vehicle identity. */
function isGenericServiceToken(token: string): boolean {
  const stripped = token.replace(/\s+/g, "").replace(/包車|遊覽車|旅遊|小團體|團體|家庭|高級/g, "");
  return stripped.length === 0;
}

function vehicleTokens(slug: string, title: string, keywords: string[]): string[] {
  const raw: string[] = [slug, slug.replace(/-/g, " "), title].concat(keywords);
  const parts = slug.split("-");
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length >= 3 && parts[i] !== "coach") raw.push(parts[i]);
  }
  const aliases = SLUG_ALIASES[slug];
  if (aliases) {
    for (let i = 0; i < aliases.length; i++) raw.push(aliases[i]);
  }
  const capacityLabels = title.match(/\d+\s*人座|九人座|中巴|大巴/g);
  if (capacityLabels) {
    for (let i = 0; i < capacityLabels.length; i++) raw.push(capacityLabels[i].replace(/\s+/g, ""));
  }
  const cleaned: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const token = raw[i] ? raw[i].trim() : "";
    if (token.length < 2) continue;
    cleaned.push(token);
  }
  return unique(cleaned);
}

function collectVehicles(): VehicleRecord[] {
  const profiles = publicFleetProfiles();
  const profileBySlug: { [slug: string]: { title: string; photos: string[]; keywords: string[] } } = {};
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    profileBySlug[profile.slug] = {
      title: profile.title,
      photos: profile.photos ? profile.photos.slice() : [],
      keywords: profile.keywords ? profile.keywords.slice() : [],
    };
  }

  const seen: { [slug: string]: true } = {};
  const records: VehicleRecord[] = [];

  function add(slug: string, title: string, keywords: string[], photos: string[], summary: string, detail: string) {
    if (!slug || seen[slug]) return;
    seen[slug] = true;
    const profile = publicFleetProfile(slug);
    const mergedPhotos = dedupeImages(
      (photos || []).concat(profile && profile.photos ? profile.photos : []).concat(
        profileBySlug[slug] && profileBySlug[slug].photos ? profileBySlug[slug].photos : [],
      ),
    );
    const mergedKeywords = unique(
      (keywords || []).concat(profileBySlug[slug] && profileBySlug[slug].keywords ? profileBySlug[slug].keywords : []),
    );
    const resolvedTitle = title || (profile ? profile.title : slug);
    records.push({
      slug: slug,
      title: resolvedTitle,
      photos: mergedPhotos,
      tokens: vehicleTokens(slug, resolvedTitle, mergedKeywords),
      capacity: parseCapacity(resolvedTitle, mergedKeywords, summary || "", detail || ""),
    });
  }

  for (let i = 0; i < fleetItems.length; i++) {
    const item = fleetItems[i];
    add(item.slug, item.title, item.keywords || [], item.photos || [], item.summary || "", item.detail || "");
  }
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    add(profile.slug, profile.title, profile.keywords || [], profile.photos || [], profile.cardSummary || "", profile.detail || "");
  }
  return records;
}

let cachedVehicles: VehicleRecord[] | null = null;
function vehicles(): VehicleRecord[] {
  if (!cachedVehicles) cachedVehicles = collectVehicles();
  return cachedVehicles;
}

/** Exposed for tests. */
export function listFleetVehiclesForDrafts(): Array<{ slug: string; title: string; photos: string[]; capacity: number | null }> {
  return vehicles().map((item) => ({
    slug: item.slug,
    title: item.title,
    photos: item.photos.slice(),
    capacity: item.capacity,
  }));
}

function tokenOwners(): { [normalized: string]: string[] } {
  const owners: { [normalized: string]: string[] } = {};
  const list = vehicles();
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    for (let j = 0; j < item.tokens.length; j++) {
      const key = normalizeKey(item.tokens[j]);
      if (!owners[key]) owners[key] = [];
      if (owners[key].indexOf(item.slug) === -1) owners[key].push(item.slug);
    }
  }
  return owners;
}

function inputHaystack(input: InputFields): string {
  const parts: string[] = [
    input.trip_title || "",
    input.user_notes || "",
    input.additional_info || "",
    input.target_audience || "",
    input.days || "",
    input.season || "",
    input.price || "",
  ];
  if (input.spots) {
    for (let i = 0; i < input.spots.length; i++) parts.push(input.spots[i]);
  }
  return parts.join("\n");
}

function extractPassengerCounts(text: string): number[] {
  const counts: number[] = [];
  const re = /(\d+)\s*人(座)?/g;
  let match: RegExpExecArray | null = re.exec(text);
  while (match) {
    const value = parseInt(match[1], 10);
    if (value >= 1 && value <= 80) counts.push(value);
    match = re.exec(text);
  }
  if (/九人(座)?/.test(text)) counts.push(9);
  return unique(counts.map((value) => String(value))).map((value) => parseInt(value, 10));
}

function vehicleForCount(count: number, list: VehicleRecord[]): string | null {
  const withCapacity: VehicleRecord[] = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].capacity != null) withCapacity.push(list[i]);
  }
  const matches: string[] = [];
  for (let i = 0; i < withCapacity.length; i++) {
    const capacity = withCapacity[i].capacity as number;
    if (capacity <= 9 && count >= 1 && count <= 9) {
      matches.push(withCapacity[i].slug);
      continue;
    }
    if (capacity >= 10 && capacity <= 25 && count >= 10 && count <= 21) {
      matches.push(withCapacity[i].slug);
      continue;
    }
    if (capacity >= 36 && count >= 36 && count <= 45) {
      matches.push(withCapacity[i].slug);
    }
  }
  const slugs = unique(matches);
  return slugs.length === 1 ? slugs[0] : null;
}

export function resolveFleetVehicle(input: InputFields): FleetVehicleMatch | null {
  const haystack = inputHaystack(input);
  if (!haystack.trim()) return null;
  const list = vehicles();
  const owners = tokenOwners();
  const distinctiveHits: { [slug: string]: string[] } = {};
  const sharedHits: { [slug: string]: string[] } = {};

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    for (let j = 0; j < item.tokens.length; j++) {
      const token = item.tokens[j];
      if (!tokenOccursIn(token, haystack)) continue;
      const key = normalizeKey(token);
      const ownedBy = owners[key] || [];
      if (ownedBy.length === 1 && !isGenericServiceToken(token)) {
        if (!distinctiveHits[item.slug]) distinctiveHits[item.slug] = [];
        distinctiveHits[item.slug].push(token);
      } else {
        if (!sharedHits[item.slug]) sharedHits[item.slug] = [];
        sharedHits[item.slug].push(token);
      }
    }
  }

  // Drop distinctive hits that are proper substrings of a longer distinctive hit (keep specificity).
  // Shared matches that are substrings of a distinctive match are already ignored in the decision.
  const distinctiveSlugs = Object.keys(distinctiveHits);

  const counts = extractPassengerCounts(haystack);
  const countSlugs: string[] = [];
  for (let i = 0; i < counts.length; i++) {
    const slug = vehicleForCount(counts[i], list);
    if (slug && countSlugs.indexOf(slug) === -1) countSlugs.push(slug);
  }
  const uniqueCountSlug = countSlugs.length === 1 ? countSlugs[0] : null;
  const countAmbiguous = counts.length > 0 && !uniqueCountSlug;

  if (distinctiveSlugs.length > 1) return null;
  if (distinctiveSlugs.length === 1) {
    if (uniqueCountSlug && uniqueCountSlug !== distinctiveSlugs[0]) return null;
    if (countAmbiguous) return null;
    return toMatch(distinctiveSlugs[0], list);
  }
  // No distinctive name. A passenger count may uniquely resolve a vehicle.
  // Shared name tokens alone are never enough.
  if (countAmbiguous) return null;
  if (uniqueCountSlug) return toMatch(uniqueCountSlug, list);
  return null;
}

function toMatch(slug: string, list: VehicleRecord[]): FleetVehicleMatch | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].slug === slug) {
      return { slug: list[i].slug, title: list[i].title, photos: list[i].photos.slice() };
    }
  }
  return null;
}

function pickFleetPhotos(photos: string[]): string[] {
  const valid = dedupeImages(photos).map((photo) => toAbsoluteSiteUrl(photo));
  return dedupeImages(valid).slice(0, FLEET_PHOTO_LIMIT);
}

function explicitCoverEmpty(cover: string | null | undefined): boolean {
  return typeof cover === "string" && cover.trim() === "";
}

export function planDraftImages(options: {
  input: InputFields;
  sourceImages?: string[];
  coverImageUrl?: string | null;
  spotTitle?: string;
}): DraftImagePlan {
  const sourceImages = dedupeImages(options.sourceImages || []);
  const fleet = resolveFleetVehicle(options.input);
  const fleetImages = fleet ? pickFleetPhotos(fleet.photos) : [];
  const combined = dedupeImages(sourceImages.concat(fleetImages)).slice(0, DRAFT_IMAGE_LIMIT);
  const spotTitle = (options.spotTitle || "").trim();

  let cover = "";
  if (explicitCoverEmpty(options.coverImageUrl)) {
    cover = "";
  } else if (options.coverImageUrl && isPublicDraftImage(options.coverImageUrl)) {
    cover = options.coverImageUrl;
  } else if (sourceImages[0]) {
    cover = sourceImages[0];
  } else if (fleetImages[0]) {
    cover = fleetImages[0];
  }

  return {
    image_urls: combined,
    cover_image_url: cover,
    fleet: fleet,
    spotImages: sourceImages,
    fleetImages: fleetImages,
    spotTitle: spotTitle,
  };
}

export function fleetPhotoAlt(vehicleTitle: string, photoUrl: string): string {
  const path = photoUrl.toLowerCase();
  let kind = "實拍";
  if (path.indexOf("captain") !== -1) kind = "獨立座";
  else if (path.indexOf("interior") !== -1 && path.indexOf("rear") !== -1) kind = "後排內裝";
  else if (path.indexOf("interior") !== -1 && path.indexOf("front") !== -1) kind = "前排內裝";
  else if (path.indexOf("interior") !== -1) kind = "內裝";
  else if (path.indexOf("rear") !== -1) kind = "車尾";
  else if (path.indexOf("front") !== -1) kind = "車頭";
  else if (path.indexOf("side") !== -1) kind = "車側";
  else if (path.indexOf("exterior") !== -1) kind = "外觀";
  return (vehicleTitle || "浮雲輕鬆遊車隊") + kind;
}

export function spotPhotoAlt(spotTitle: string, index: number): string {
  const title = (spotTitle || "").replace(/\s+/g, " ").trim();
  const compact = title.length > 28 ? "" : title;
  const base = compact ? compact + "實拍" : "這裡好好玩景點實拍";
  return index === 0 ? base : base + String(index + 1);
}

function bodyHasUrl(body: string, url: string): boolean {
  const abs = toAbsoluteSiteUrl(url);
  return body.indexOf(abs) !== -1 || body.indexOf(url) !== -1;
}

function imageMarkdown(url: string, alt: string): string {
  const safeAlt = alt.replace(/[\[\]]/g, "").trim() || "浮雲輕鬆遊實拍";
  return "![" + safeAlt + "](" + toAbsoluteSiteUrl(url) + ")";
}

type InsertCandidate = { url: string; alt: string; role: "spot" | "fleet" };

function paragraphBlocks(markdown: string): string[] {
  return markdown.split(/\n{2,}/);
}

export function insertDraftImagesIntoMarkdown(
  body: string,
  plan: Pick<DraftImagePlan, "spotImages" | "fleetImages" | "fleet" | "spotTitle">,
): string {
  const source = typeof body === "string" ? body : "";
  if (!source.trim()) return source;

  const candidates: InsertCandidate[] = [];
  for (let i = 0; i < plan.spotImages.length; i++) {
    const url = plan.spotImages[i];
    if (bodyHasUrl(source, url)) continue;
    candidates.push({ url: url, alt: spotPhotoAlt(plan.spotTitle, i), role: "spot" });
  }
  const fleetTitle = plan.fleet ? plan.fleet.title : "浮雲輕鬆遊車隊";
  for (let i = 0; i < plan.fleetImages.length; i++) {
    const url = plan.fleetImages[i];
    if (bodyHasUrl(source, url)) continue;
    candidates.push({ url: url, alt: fleetPhotoAlt(fleetTitle, url), role: "fleet" });
  }
  if (!candidates.length) return source;

  const openingSpot = candidates.filter((item) => item.role === "spot")[0];
  const midFleet = candidates.filter((item) => item.role === "fleet")[0];
  const extras: InsertCandidate[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    if (openingSpot && item.url === openingSpot.url) continue;
    if (midFleet && item.url === midFleet.url) continue;
    extras.push(item);
  }

  const chosen: InsertCandidate[] = [];
  if (openingSpot) chosen.push(openingSpot);
  else if (midFleet) {
    // No spot photo: put the fleet exterior near the opening so a manual trip still has a lead image.
    chosen.push(midFleet);
  }
  if (midFleet && (!chosen.length || chosen[0].url !== midFleet.url)) chosen.push(midFleet);
  for (let i = 0; i < extras.length && chosen.length < ARTICLE_IMAGE_LIMIT; i++) {
    chosen.push(extras[i]);
  }
  if (!chosen.length) return source;
  const limited = chosen.slice(0, ARTICLE_IMAGE_LIMIT);

  const blocks = paragraphBlocks(source);
  const textIndexes: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (!/^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(blocks[i]) && blocks[i].trim()) textIndexes.push(i);
  }
  if (!textIndexes.length) {
    const suffix: string[] = [];
    for (let i = 0; i < limited.length; i++) suffix.push(imageMarkdown(limited[i].url, limited[i].alt));
    return source.replace(/\s*$/, "") + "\n\n" + suffix.join("\n\n") + "\n";
  }

  const insertions: { [index: number]: string[] } = {};
  function queue(afterIndex: number, item: InsertCandidate) {
    if (!insertions[afterIndex]) insertions[afterIndex] = [];
    insertions[afterIndex].push(imageMarkdown(item.url, item.alt));
  }

  queue(textIndexes[0], limited[0]);
  if (limited[1]) {
    const mid = textIndexes[Math.min(textIndexes.length - 1, Math.max(1, Math.floor(textIndexes.length / 2)))];
    queue(mid, limited[1]);
  }
  for (let i = 2; i < limited.length; i++) {
    const idx = textIndexes[Math.min(textIndexes.length - 1, i)];
    queue(idx, limited[i]);
  }

  const out: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    out.push(blocks[i]);
    const extra = insertions[i];
    if (extra) {
      for (let j = 0; j < extra.length; j++) out.push(extra[j]);
    }
  }
  return out.join("\n\n");
}

export function applyDraftImagesToContent(content: GeneratedContent, plan: DraftImagePlan): GeneratedContent {
  return {
    ...content,
    seo_article: {
      ...content.seo_article,
      body_markdown: insertDraftImagesIntoMarkdown(content.seo_article.body_markdown, plan),
    },
  };
}

