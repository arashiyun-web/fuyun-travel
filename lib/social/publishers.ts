export interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

export async function publishToFacebook(params: {
  caption: string;
  imageUrl: string;
}): Promise<PublishResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !token) {
    return { platform: "facebook", success: false, error: "缺少 FB 設定" };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: params.imageUrl,
        caption: params.caption,
        access_token: token,
      }),
    });
    const data: { id?: string; error?: { message?: string } } = await response.json();
    if (data.id) {
      return { platform: "facebook", success: true, postId: data.id };
    }

    return { platform: "facebook", success: false, error: data.error?.message || "發布失敗" };
  } catch (error) {
    return { platform: "facebook", success: false, error: String(error) };
  }
}

