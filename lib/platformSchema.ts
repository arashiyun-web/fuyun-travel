export const platformEntities = [
  {
    name: "agencies",
    purpose: "支援多旅行社，不寫死單一旅行社。",
    fields: ["id", "name", "tax_id", "license_no", "phone", "email", "address", "created_at"],
  },
  {
    name: "fleets",
    purpose: "支援多車隊與車隊品牌資料。",
    fields: ["id", "agency_id", "name", "operator_name", "contact_phone", "created_at"],
  },
  {
    name: "vehicles",
    purpose: "管理 MAN、Scania、Hino、Daewoo 等車型與座位資訊。",
    fields: ["id", "fleet_id", "brand", "model", "seat_count", "features", "status"],
  },
  {
    name: "drivers",
    purpose: "司機資料與調度預留。",
    fields: ["id", "fleet_id", "name", "phone", "license_status", "languages", "status"],
  },
  {
    name: "suppliers",
    purpose: "飯店、餐廳、景點、票券與其他供應商。",
    fields: ["id", "type", "name", "contact", "region", "tags", "status"],
  },
  {
    name: "travel_posts",
    purpose: "Facebook 匯入與 AI 內容工廠產生的文章。",
    fields: ["id", "source", "title", "content", "seo_json", "schema_json", "status", "published_at"],
  },
  {
    name: "inquiries",
    purpose: "詢價與成交流程追蹤。",
    fields: ["id", "agency_id", "customer_name", "phone", "line_id", "trip_type", "status", "created_at"],
  },
];

export const apiDesign = [
  { method: "GET", path: "/api/inquiry", purpose: "後台讀取詢價與稽核紀錄" },
  { method: "POST", path: "/api/inquiry", purpose: "前台建立詢價" },
  { method: "PATCH", path: "/api/inquiry", purpose: "更新詢價狀態與內容" },
  { method: "GET", path: "/api/travel/import", purpose: "查看 Facebook 匯入暫存與自動化流程" },
  { method: "POST", path: "/api/travel/import", purpose: "匯入 Facebook 旅遊貼文並產生 SEO/AEO/GEO 草稿" },
  { method: "GET", path: "/api/line/webhook", purpose: "LINE webhook 健康檢查與 RAG 預留" },
  { method: "POST", path: "/api/line/webhook", purpose: "接收 LINE OA 訊息並回覆初版客服答案" },
];
