// 粉專「小羽旅遊趣」貼文讀取。
//
// 只讀粉專（Page），不讀社團（Group）——Meta 自 2018 年起大幅收緊 Groups API，
// 一般商用 App 已無法申請到讀取社團貼文 feed 的權限，即使是公開社團、即使是
// 社團管理員本人，除非加入 Meta 極少數特定合作夥伴計畫。這是平台政策限制，
// 不是這裡的程式碼或權限設定問題，所以這支檔案完全沒有寫「讀社團」的邏輯，
// 避免留下一段永遠會失敗、誤導未來維護者以為「快設定好了」的死路。
//
// 社團內容目前只能透過 /api/content-sync/manual-submit 手動提交（見該路由）。

export interface FacebookPagePost {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time: string;
  full_picture?: string;
}

export interface FacebookGraphResult {
  configured: boolean;
  error?: string;
  posts: FacebookPagePost[];
}

const GRAPH_API_VERSION = "v21.0";

export async function fetchRecentPagePosts(sinceDays = 7): Promise<FacebookGraphResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !token) {
    return {
      configured: false,
      error: "缺少 FACEBOOK_PAGE_ID 或 FACEBOOK_ACCESS_TOKEN，尚未完成粉專授權設定",
      posts: [],
    };
  }

  const since = Math.floor(Date.now() / 1000) - sinceDays * 24 * 60 * 60;
  const fields = "id,message,permalink_url,created_time,full_picture";
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/posts?fields=${fields}&since=${since}&access_token=${token}`;

  try {
    const response = await fetch(url, { method: "GET" });
    const data: { data?: FacebookPagePost[]; error?: { message?: string } } = await response.json();

    if (data.error) {
      return { configured: true, error: data.error.message || "Graph API 回傳錯誤", posts: [] };
    }

    return { configured: true, posts: data.data || [] };
  } catch (error) {
    return { configured: true, error: String(error), posts: [] };
  }
}
