/**
 * 九則 /highlights 卡片的自架照片。資料庫 photo_urls 仍是沒有部署上去的
 * /images/featured-spots/fb_*.jpg，而 featured_spots 跟正式站共用 Neon，
 * 所以這裡不寫資料庫，只在渲染時用「原始貼文連結」換上 public/ 裡的 webp。
 *
 * 對照鍵是 Facebook share 路徑（去掉協定、www、查詢字串與結尾斜線），
 * 因為這條連結已經存在 source_url、也顯示在卡片上，不依賴那些 404 的檔名。
 * 做法跟 bdeabe5 一樣：圖放進 public/images/featured-spots/，頁面指到這個路徑。
 * 以後若要寫回資料庫，用 scripts/highlights-photo-urls-update.sql（不要在部署時執行）。
 */

export function sourcePhotoKey(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl?.trim()) return null;
  let url: URL;
  try {
    url = new URL(sourceUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  let host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "m.facebook.com" || host === "mbasic.facebook.com" || host === "web.facebook.com") {
    host = "facebook.com";
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (host !== "facebook.com" || !path.startsWith("/share/p/")) return null;
  return `${host}${path}`;
}

const LOCAL_PHOTOS: Record<string, readonly string[]> = {
  // 獅頭山勸化堂
  "facebook.com/share/p/1dYpVHcB9L": [
    "/images/featured-spots/shitoushan-quanhua.webp",
    "/images/featured-spots/shitoushan-quanhua-p2.webp",
    "/images/featured-spots/shitoushan-quanhua-p3.webp",
    "/images/featured-spots/shitoushan-quanhua-p4.webp",
    "/images/featured-spots/shitoushan-quanhua-p5.webp",
    "/images/featured-spots/shitoushan-quanhua-p6.webp",
    "/images/featured-spots/shitoushan-quanhua-p7.webp",
    "/images/featured-spots/shitoushan-quanhua-p8.webp",
    "/images/featured-spots/shitoushan-quanhua-p9.webp",
    "/images/featured-spots/shitoushan-quanhua-p10.webp",
    "/images/featured-spots/shitoushan-quanhua-p11.webp",
    "/images/featured-spots/shitoushan-quanhua-p12.webp",
    "/images/featured-spots/shitoushan-quanhua-p13.webp",
    "/images/featured-spots/shitoushan-quanhua-p14.webp",
    "/images/featured-spots/shitoushan-quanhua-p15.webp",
    "/images/featured-spots/shitoushan-quanhua-p16.webp",
  ],
  // 大溪韭菜花季
  "facebook.com/share/p/19TLpfUWso": [
    "/images/featured-spots/daxi-jiucaihua.webp",
    "/images/featured-spots/daxi-jiucaihua-p2.webp",
    "/images/featured-spots/daxi-jiucaihua-p3.webp",
    "/images/featured-spots/daxi-jiucaihua-p4.webp",
    "/images/featured-spots/daxi-jiucaihua-p5.webp",
    "/images/featured-spots/daxi-jiucaihua-p6.webp",
    "/images/featured-spots/daxi-jiucaihua-p7.webp",
    "/images/featured-spots/daxi-jiucaihua-p8.webp",
    "/images/featured-spots/daxi-jiucaihua-p9.webp",
    "/images/featured-spots/daxi-jiucaihua-p10.webp",
    "/images/featured-spots/daxi-jiucaihua-p11.webp",
    "/images/featured-spots/daxi-jiucaihua-p12.webp",
  ],
  // 台灣設計展
  "facebook.com/share/p/19UQ5TA1Do": [
    "/images/featured-spots/taiwan-design-expo.webp",
    "/images/featured-spots/taiwan-design-expo-p2.webp",
    "/images/featured-spots/taiwan-design-expo-p3.webp",
    "/images/featured-spots/taiwan-design-expo-p4.webp",
    "/images/featured-spots/taiwan-design-expo-p5.webp",
    "/images/featured-spots/taiwan-design-expo-p6.webp",
    "/images/featured-spots/taiwan-design-expo-p7.webp",
    "/images/featured-spots/taiwan-design-expo-p8.webp",
    "/images/featured-spots/taiwan-design-expo-p9.webp",
    "/images/featured-spots/taiwan-design-expo-p10.webp",
    "/images/featured-spots/taiwan-design-expo-p11.webp",
    "/images/featured-spots/taiwan-design-expo-p12.webp",
    "/images/featured-spots/taiwan-design-expo-p13.webp",
    "/images/featured-spots/taiwan-design-expo-p14.webp",
  ],
  // 蘆洲國小同學會・宜蘭頭城
  "facebook.com/share/p/18YVA2Fj6n": [
    "/images/featured-spots/toucheng-beiguan.webp",
    "/images/featured-spots/toucheng-beiguan-p2.webp",
    "/images/featured-spots/toucheng-beiguan-p3.webp",
    "/images/featured-spots/toucheng-beiguan-p4.webp",
    "/images/featured-spots/toucheng-beiguan-p5.webp",
    "/images/featured-spots/toucheng-beiguan-p6.webp",
    "/images/featured-spots/toucheng-beiguan-p7.webp",
    "/images/featured-spots/toucheng-beiguan-p8.webp",
    "/images/featured-spots/toucheng-beiguan-p9.webp",
    "/images/featured-spots/toucheng-beiguan-p10.webp",
  ],
  // 新竹柿餅農場
  "facebook.com/share/p/1EmMcYm1yx": [
    "/images/featured-spots/hsinchu-persimmon.webp",
    "/images/featured-spots/hsinchu-persimmon-p2.webp",
    "/images/featured-spots/hsinchu-persimmon-p3.webp",
    "/images/featured-spots/hsinchu-persimmon-p4.webp",
    "/images/featured-spots/hsinchu-persimmon-p5.webp",
    "/images/featured-spots/hsinchu-persimmon-p6.webp",
    "/images/featured-spots/hsinchu-persimmon-p7.webp",
    "/images/featured-spots/hsinchu-persimmon-p8.webp",
    "/images/featured-spots/hsinchu-persimmon-p9.webp",
    "/images/featured-spots/hsinchu-persimmon-p10.webp",
    "/images/featured-spots/hsinchu-persimmon-p11.webp",
    "/images/featured-spots/hsinchu-persimmon-p12.webp",
    "/images/featured-spots/hsinchu-persimmon-p13.webp",
    "/images/featured-spots/hsinchu-persimmon-p14.webp",
    "/images/featured-spots/hsinchu-persimmon-p15.webp",
    "/images/featured-spots/hsinchu-persimmon-p16.webp",
    "/images/featured-spots/hsinchu-persimmon-p17.webp",
    "/images/featured-spots/hsinchu-persimmon-p18.webp",
  ],
  // 礁溪五峰旗
  "facebook.com/share/p/19Ux8r6Epz": [
    "/images/featured-spots/jiaoxi-wufengqi.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p2.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p3.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p4.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p5.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p6.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p7.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p8.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p9.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p10.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p11.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p12.webp",
    "/images/featured-spots/jiaoxi-wufengqi-p13.webp",
  ],
  // 北埔冷泉
  "facebook.com/share/p/1GPkUrqjnd": [
    "/images/featured-spots/beipu-cold-spring.webp",
    "/images/featured-spots/beipu-cold-spring-p2.webp",
    "/images/featured-spots/beipu-cold-spring-p3.webp",
    "/images/featured-spots/beipu-cold-spring-p4.webp",
    "/images/featured-spots/beipu-cold-spring-p5.webp",
    "/images/featured-spots/beipu-cold-spring-p6.webp",
    "/images/featured-spots/beipu-cold-spring-p7.webp",
    "/images/featured-spots/beipu-cold-spring-p8.webp",
    "/images/featured-spots/beipu-cold-spring-p9.webp",
    "/images/featured-spots/beipu-cold-spring-p10.webp",
    "/images/featured-spots/beipu-cold-spring-p11.webp",
    "/images/featured-spots/beipu-cold-spring-p12.webp",
    "/images/featured-spots/beipu-cold-spring-p13.webp",
    "/images/featured-spots/beipu-cold-spring-p14.webp",
    "/images/featured-spots/beipu-cold-spring-p15.webp",
    "/images/featured-spots/beipu-cold-spring-p16.webp",
  ],
  // 羅東林場
  "facebook.com/share/p/19VY97BbQP": [
    "/images/featured-spots/luodong-forestry.webp",
    "/images/featured-spots/luodong-forestry-p2.webp",
    "/images/featured-spots/luodong-forestry-p3.webp",
    "/images/featured-spots/luodong-forestry-p4.webp",
    "/images/featured-spots/luodong-forestry-p5.webp",
    "/images/featured-spots/luodong-forestry-p6.webp",
    "/images/featured-spots/luodong-forestry-p7.webp",
    "/images/featured-spots/luodong-forestry-p8.webp",
    "/images/featured-spots/luodong-forestry-p9.webp",
    "/images/featured-spots/luodong-forestry-p10.webp",
    "/images/featured-spots/luodong-forestry-p11.webp",
    "/images/featured-spots/luodong-forestry-p12.webp",
    "/images/featured-spots/luodong-forestry-p13.webp",
    "/images/featured-spots/luodong-forestry-p14.webp",
    "/images/featured-spots/luodong-forestry-p15.webp",
    "/images/featured-spots/luodong-forestry-p16.webp",
  ],
  // 新竹眷村博物館
  "facebook.com/share/p/1EniYST3Ci": [
    "/images/featured-spots/hsinchu-military-village.webp",
    "/images/featured-spots/hsinchu-military-village-p2.webp",
    "/images/featured-spots/hsinchu-military-village-p3.webp",
    "/images/featured-spots/hsinchu-military-village-p4.webp",
    "/images/featured-spots/hsinchu-military-village-p5.webp",
    "/images/featured-spots/hsinchu-military-village-p6.webp",
    "/images/featured-spots/hsinchu-military-village-p7.webp",
    "/images/featured-spots/hsinchu-military-village-p8.webp",
    "/images/featured-spots/hsinchu-military-village-p9.webp",
    "/images/featured-spots/hsinchu-military-village-p10.webp",
    "/images/featured-spots/hsinchu-military-village-p11.webp",
    "/images/featured-spots/hsinchu-military-village-p12.webp",
    "/images/featured-spots/hsinchu-military-village-p13.webp",
    "/images/featured-spots/hsinchu-military-village-p14.webp",
    "/images/featured-spots/hsinchu-military-village-p15.webp",
  ],
};

export function localPhotosForSource(sourceUrl: string | null | undefined): readonly string[] | null {
  const key = sourcePhotoKey(sourceUrl);
  if (!key) return null;
  return LOCAL_PHOTOS[key] ?? null;
}
