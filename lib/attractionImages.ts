const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=82`;

// Curated travel visuals stay destination-specific so cards never fall back to abstract placeholder imagery.
export const attractionImageMap = {
  jiufen: image("photo-1495567720989-cebdbdd97913"),
  yehliu: image("photo-1470770841072-f978cf4d019e"),
  tamsui: image("photo-1500530855697-b586d89ba3ee"),
  sunMoonLake: image("photo-1501785888041-af3ef285b470"),
  alishan: image("photo-1464822759023-fed622ff2c3b"),
  cingjing: image("photo-1500534623283-312aade485b7"),
  kenting: image("photo-1507525428034-b723cf961d3e"),
  taroko: image("photo-1469474968028-56623f02e42e"),
  flyingCowRanch: image("photo-1500595046743-cd271d694d30"),
  liufuVillage: image("photo-1513883049090-d0b7439799bf"),
  nationalPalaceMuseum: image("photo-1564399579883-451a5d44ec08"),
  greenWorld: image("photo-1540573133985-87b6da6d54a9"),
  littleDingDongSciencePark: image("photo-1441974231531-c6227db76b6e"),
  taichung: image("photo-1449824913935-59a10b8d2000"),
  hualien: image("photo-1476514525535-07fb3b4ae5f1"),
} as const;

const destinationToKey: Record<string, keyof typeof attractionImageMap> = {
  九份: "jiufen",
  野柳: "yehliu",
  淡水: "tamsui",
  日月潭: "sunMoonLake",
  阿里山: "alishan",
  清境: "cingjing",
  清境農場: "cingjing",
  墾丁: "kenting",
  太魯閣: "taroko",
  飛牛牧場: "flyingCowRanch",
  六福村: "liufuVillage",
  故宮博物院: "nationalPalaceMuseum",
  綠世界: "greenWorld",
  小叮噹科學園區: "littleDingDongSciencePark",
  台中: "taichung",
  花蓮: "hualien",
};

export function getAttractionImage(key: keyof typeof attractionImageMap) {
  return attractionImageMap[key];
}

export function getAttractionImageByDestination(destination: string) {
  const key = destinationToKey[destination] ?? destinationToKey[destination.replace(/\s+/g, "")];
  return attractionImageMap[key ?? "jiufen"];
}

export function getAttractionImageBySlug(slug: string) {
  const normalized = slug.replace(/-/g, "");
  const found = Object.entries(destinationToKey).find(([, value]) => value.toLowerCase() === normalized.toLowerCase());
  return found ? attractionImageMap[found[1]] : attractionImageMap.jiufen;
}
