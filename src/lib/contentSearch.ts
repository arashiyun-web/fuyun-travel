import {
  getKnowledgeByKeyword,
  type KnowledgeEntry,
} from "@/src/data/knowledge";
import {
  searchAttractionsByKeyword,
  type AttractionEntry,
} from "@/src/data/attractions";
import {
  searchRoutesByKeyword,
  type CharterRouteEntry,
} from "@/src/data/charterRoutes";

export type TravelContentSearchResult =
  | { type: "knowledge"; item: KnowledgeEntry }
  | { type: "attraction"; item: AttractionEntry }
  | { type: "route"; item: CharterRouteEntry };

// These functions query local TypeScript records only; no LLM, database, or network is involved.
export function searchKnowledge(keyword: string) {
  return getKnowledgeByKeyword(keyword);
}

export function searchAttractions(keyword: string) {
  return searchAttractionsByKeyword(keyword);
}

export function searchRoutes(keyword: string) {
  return searchRoutesByKeyword(keyword);
}

export function searchAllTravelContent(keyword: string): TravelContentSearchResult[] {
  return [
    ...searchKnowledge(keyword).map((item) => ({ type: "knowledge" as const, item })),
    ...searchAttractions(keyword).map((item) => ({ type: "attraction" as const, item })),
    ...searchRoutes(keyword).map((item) => ({ type: "route" as const, item })),
  ];
}
