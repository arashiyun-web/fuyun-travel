const slugMap: Record<string, string> = {
  台北: "taipei",
  新北: "new-taipei",
  板橋: "banqiao",
  桃園: "taoyuan",
  新竹: "hsinchu",
  台中: "taichung",
  台南: "tainan",
  高雄: "kaohsiung",
  阿里山: "alishan",
  日月潭: "sun-moon-lake",
  九份: "jiufen",
  十分: "shifen",
  太平山: "taipingshan",
  武陵農場: "wuling-farm",
};

export function generateSlug(input: string) {
  const trimmed = input.trim();
  if (slugMap[trimmed]) return slugMap[trimmed];

  return trimmed
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || `post-${Date.now()}`;
}
