-- 手動腳本，不要在 CI、部署或這個 PR 裡執行。
-- featured_spots 與正式站共用 Neon。等確認預覽照片無誤、並決定寫回時才跑。
-- 預期剛好更新 9 列；不是 9 列會拋錯並回滾。
-- 比對方式與 lib/content-sync/highlightsLocalPhotos.ts 的 sourcePhotoKey 相同：
-- 去掉 http(s)://、開頭的 www.、查詢字串與結尾斜線，保留 share id 的大小寫。

BEGIN;

DO $$
DECLARE
  updated_count integer;
BEGIN
  WITH next_photos (source_path, photo_url, photo_urls) AS (
    VALUES
      ('facebook.com/share/p/1dYpVHcB9L', '/images/featured-spots/shitoushan-quanhua.webp', ARRAY[
        '/images/featured-spots/shitoushan-quanhua.webp',
        '/images/featured-spots/shitoushan-quanhua-p2.webp',
        '/images/featured-spots/shitoushan-quanhua-p3.webp',
        '/images/featured-spots/shitoushan-quanhua-p4.webp',
        '/images/featured-spots/shitoushan-quanhua-p5.webp',
        '/images/featured-spots/shitoushan-quanhua-p6.webp',
        '/images/featured-spots/shitoushan-quanhua-p7.webp',
        '/images/featured-spots/shitoushan-quanhua-p8.webp',
        '/images/featured-spots/shitoushan-quanhua-p9.webp',
        '/images/featured-spots/shitoushan-quanhua-p10.webp',
        '/images/featured-spots/shitoushan-quanhua-p11.webp',
        '/images/featured-spots/shitoushan-quanhua-p12.webp',
        '/images/featured-spots/shitoushan-quanhua-p13.webp',
        '/images/featured-spots/shitoushan-quanhua-p14.webp',
        '/images/featured-spots/shitoushan-quanhua-p15.webp',
        '/images/featured-spots/shitoushan-quanhua-p16.webp'
      ]::text[]),
      ('facebook.com/share/p/19TLpfUWso', '/images/featured-spots/daxi-jiucaihua.webp', ARRAY[
        '/images/featured-spots/daxi-jiucaihua.webp',
        '/images/featured-spots/daxi-jiucaihua-p2.webp',
        '/images/featured-spots/daxi-jiucaihua-p3.webp',
        '/images/featured-spots/daxi-jiucaihua-p4.webp',
        '/images/featured-spots/daxi-jiucaihua-p5.webp',
        '/images/featured-spots/daxi-jiucaihua-p6.webp',
        '/images/featured-spots/daxi-jiucaihua-p7.webp',
        '/images/featured-spots/daxi-jiucaihua-p8.webp',
        '/images/featured-spots/daxi-jiucaihua-p9.webp',
        '/images/featured-spots/daxi-jiucaihua-p10.webp',
        '/images/featured-spots/daxi-jiucaihua-p11.webp',
        '/images/featured-spots/daxi-jiucaihua-p12.webp'
      ]::text[]),
      ('facebook.com/share/p/19UQ5TA1Do', '/images/featured-spots/taiwan-design-expo.webp', ARRAY[
        '/images/featured-spots/taiwan-design-expo.webp',
        '/images/featured-spots/taiwan-design-expo-p2.webp',
        '/images/featured-spots/taiwan-design-expo-p3.webp',
        '/images/featured-spots/taiwan-design-expo-p4.webp',
        '/images/featured-spots/taiwan-design-expo-p5.webp',
        '/images/featured-spots/taiwan-design-expo-p6.webp',
        '/images/featured-spots/taiwan-design-expo-p7.webp',
        '/images/featured-spots/taiwan-design-expo-p8.webp',
        '/images/featured-spots/taiwan-design-expo-p9.webp',
        '/images/featured-spots/taiwan-design-expo-p10.webp',
        '/images/featured-spots/taiwan-design-expo-p11.webp',
        '/images/featured-spots/taiwan-design-expo-p12.webp',
        '/images/featured-spots/taiwan-design-expo-p13.webp',
        '/images/featured-spots/taiwan-design-expo-p14.webp'
      ]::text[]),
      ('facebook.com/share/p/18YVA2Fj6n', '/images/featured-spots/toucheng-beiguan.webp', ARRAY[
        '/images/featured-spots/toucheng-beiguan.webp',
        '/images/featured-spots/toucheng-beiguan-p2.webp',
        '/images/featured-spots/toucheng-beiguan-p3.webp',
        '/images/featured-spots/toucheng-beiguan-p4.webp',
        '/images/featured-spots/toucheng-beiguan-p5.webp',
        '/images/featured-spots/toucheng-beiguan-p6.webp',
        '/images/featured-spots/toucheng-beiguan-p7.webp',
        '/images/featured-spots/toucheng-beiguan-p8.webp',
        '/images/featured-spots/toucheng-beiguan-p9.webp',
        '/images/featured-spots/toucheng-beiguan-p10.webp'
      ]::text[]),
      ('facebook.com/share/p/1EmMcYm1yx', '/images/featured-spots/hsinchu-persimmon.webp', ARRAY[
        '/images/featured-spots/hsinchu-persimmon.webp',
        '/images/featured-spots/hsinchu-persimmon-p2.webp',
        '/images/featured-spots/hsinchu-persimmon-p3.webp',
        '/images/featured-spots/hsinchu-persimmon-p4.webp',
        '/images/featured-spots/hsinchu-persimmon-p5.webp',
        '/images/featured-spots/hsinchu-persimmon-p6.webp',
        '/images/featured-spots/hsinchu-persimmon-p7.webp',
        '/images/featured-spots/hsinchu-persimmon-p8.webp',
        '/images/featured-spots/hsinchu-persimmon-p9.webp',
        '/images/featured-spots/hsinchu-persimmon-p10.webp',
        '/images/featured-spots/hsinchu-persimmon-p11.webp',
        '/images/featured-spots/hsinchu-persimmon-p12.webp',
        '/images/featured-spots/hsinchu-persimmon-p13.webp',
        '/images/featured-spots/hsinchu-persimmon-p14.webp',
        '/images/featured-spots/hsinchu-persimmon-p15.webp',
        '/images/featured-spots/hsinchu-persimmon-p16.webp',
        '/images/featured-spots/hsinchu-persimmon-p17.webp',
        '/images/featured-spots/hsinchu-persimmon-p18.webp'
      ]::text[]),
      ('facebook.com/share/p/19Ux8r6Epz', '/images/featured-spots/jiaoxi-wufengqi.webp', ARRAY[
        '/images/featured-spots/jiaoxi-wufengqi.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p2.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p3.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p4.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p5.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p6.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p7.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p8.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p9.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p10.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p11.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p12.webp',
        '/images/featured-spots/jiaoxi-wufengqi-p13.webp'
      ]::text[]),
      ('facebook.com/share/p/1GPkUrqjnd', '/images/featured-spots/beipu-cold-spring.webp', ARRAY[
        '/images/featured-spots/beipu-cold-spring.webp',
        '/images/featured-spots/beipu-cold-spring-p2.webp',
        '/images/featured-spots/beipu-cold-spring-p3.webp',
        '/images/featured-spots/beipu-cold-spring-p4.webp',
        '/images/featured-spots/beipu-cold-spring-p5.webp',
        '/images/featured-spots/beipu-cold-spring-p6.webp',
        '/images/featured-spots/beipu-cold-spring-p7.webp',
        '/images/featured-spots/beipu-cold-spring-p8.webp',
        '/images/featured-spots/beipu-cold-spring-p9.webp',
        '/images/featured-spots/beipu-cold-spring-p10.webp',
        '/images/featured-spots/beipu-cold-spring-p11.webp',
        '/images/featured-spots/beipu-cold-spring-p12.webp',
        '/images/featured-spots/beipu-cold-spring-p13.webp',
        '/images/featured-spots/beipu-cold-spring-p14.webp',
        '/images/featured-spots/beipu-cold-spring-p15.webp',
        '/images/featured-spots/beipu-cold-spring-p16.webp'
      ]::text[]),
      ('facebook.com/share/p/19VY97BbQP', '/images/featured-spots/luodong-forestry.webp', ARRAY[
        '/images/featured-spots/luodong-forestry.webp',
        '/images/featured-spots/luodong-forestry-p2.webp',
        '/images/featured-spots/luodong-forestry-p3.webp',
        '/images/featured-spots/luodong-forestry-p4.webp',
        '/images/featured-spots/luodong-forestry-p5.webp',
        '/images/featured-spots/luodong-forestry-p6.webp',
        '/images/featured-spots/luodong-forestry-p7.webp',
        '/images/featured-spots/luodong-forestry-p8.webp',
        '/images/featured-spots/luodong-forestry-p9.webp',
        '/images/featured-spots/luodong-forestry-p10.webp',
        '/images/featured-spots/luodong-forestry-p11.webp',
        '/images/featured-spots/luodong-forestry-p12.webp',
        '/images/featured-spots/luodong-forestry-p13.webp',
        '/images/featured-spots/luodong-forestry-p14.webp',
        '/images/featured-spots/luodong-forestry-p15.webp',
        '/images/featured-spots/luodong-forestry-p16.webp'
      ]::text[]),
      ('facebook.com/share/p/1EniYST3Ci', '/images/featured-spots/hsinchu-military-village.webp', ARRAY[
        '/images/featured-spots/hsinchu-military-village.webp',
        '/images/featured-spots/hsinchu-military-village-p2.webp',
        '/images/featured-spots/hsinchu-military-village-p3.webp',
        '/images/featured-spots/hsinchu-military-village-p4.webp',
        '/images/featured-spots/hsinchu-military-village-p5.webp',
        '/images/featured-spots/hsinchu-military-village-p6.webp',
        '/images/featured-spots/hsinchu-military-village-p7.webp',
        '/images/featured-spots/hsinchu-military-village-p8.webp',
        '/images/featured-spots/hsinchu-military-village-p9.webp',
        '/images/featured-spots/hsinchu-military-village-p10.webp',
        '/images/featured-spots/hsinchu-military-village-p11.webp',
        '/images/featured-spots/hsinchu-military-village-p12.webp',
        '/images/featured-spots/hsinchu-military-village-p13.webp',
        '/images/featured-spots/hsinchu-military-village-p14.webp',
        '/images/featured-spots/hsinchu-military-village-p15.webp'
      ]::text[])
  ),
  updated AS (
    UPDATE featured_spots AS spot
    SET
      photo_url = next_photos.photo_url,
      photo_urls = next_photos.photo_urls,
      updated_at = CURRENT_TIMESTAMP
    FROM next_photos
    WHERE spot.status = 'published'
      AND regexp_replace(
            regexp_replace(split_part(btrim(spot.source_url), '?', 1), '^https?://(www\.)?', ''),
            '/+$',
            ''
          ) = next_photos.source_path
    RETURNING spot.id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  IF updated_count <> 9 THEN
    RAISE EXCEPTION 'expected to update 9 featured_spots rows, updated %', updated_count;
  END IF;
END $$;

COMMIT;
