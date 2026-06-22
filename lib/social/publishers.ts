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

export async function publishToInstagram(params: {
  caption: string;
  imageUrl: string;
}): Promise<PublishResult> {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ID;
  const token = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!igUserId || !token) {
    return { platform: "instagram", success: false, error: "缺少 IG 設定" };
  }

  try {
    const containerResponse = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: params.imageUrl,
        caption: params.caption,
        access_token: token,
      }),
    });
    const container: { id?: string; error?: { message?: string } } = await containerResponse.json();

    if (!container.id) {
      return { platform: "instagram", success: false, error: container.error?.message || "容器建立失敗" };
    }

    const publishResponse = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: token,
      }),
    });
    const published: { id?: string; error?: { message?: string } } = await publishResponse.json();

    if (published.id) {
      return { platform: "instagram", success: true, postId: published.id };
    }

    return { platform: "instagram", success: false, error: published.error?.message || "發布失敗" };
  } catch (error) {
    return { platform: "instagram", success: false, error: String(error) };
  }
}

export async function publishToX(params: { caption: string }): Promise<PublishResult> {
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    return { platform: "x", success: false, error: "缺少 X 設定" };
  }

  try {
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: params.caption.slice(0, 280) }),
    });
    const data: { data?: { id?: string }; detail?: string; error?: string } = await response.json();

    if (data.data?.id) {
      return { platform: "x", success: true, postId: data.data.id };
    }

    return { platform: "x", success: false, error: data.detail || data.error || "發布失敗" };
  } catch (error) {
    return { platform: "x", success: false, error: String(error) };
  }
}
