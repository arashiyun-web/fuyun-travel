export type EnvFlag = { name: string; set: boolean };

function flag(name: string): EnvFlag {
  return { name, set: Boolean(process.env[name]?.trim()) };
}

export function publishingHealth() {
  const anthropic = flag("ANTHROPIC_API_KEY").set && flag("AI_MODEL_NAME").set;
  const openai = flag("OPENAI_API_KEY").set && flag("OPENAI_MODEL").set;
  const r2Upload = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"].every((name) => flag(name).set);
  const facebookPage = flag("FACEBOOK_PAGE_ID").set && flag("FACEBOOK_ACCESS_TOKEN").set;
  const instagramLogin = ["INSTAGRAM_LOGIN_APP_ID", "INSTAGRAM_LOGIN_APP_SECRET", "INSTAGRAM_LOGIN_REDIRECT_URI", "INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY", "INSTAGRAM_LOGIN_API_VERSION", "INSTAGRAM_LOGIN_MEDIA_ORIGIN"].every((name) => flag(name).set);
  const x = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"].every((name) => flag(name).set);
  const lineNotify = flag("LINE_CHANNEL_ACCESS_TOKEN").set && (flag("LINE_ADMIN_USER_ID").set || flag("ADMIN_LINE_USER_ID").set);
  const email = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].every((name) => flag(name).set) && (flag("INQUIRY_TO_EMAIL").set || flag("SMTP_USER").set);
  return {
    copywriting: {
      ready: anthropic || openai,
      env: [flag("ANTHROPIC_API_KEY"), flag("AI_MODEL_NAME"), flag("AI_API_BASE"), flag("OPENAI_API_KEY"), flag("OPENAI_MODEL")],
    },
    imageUpload: {
      ready: r2Upload,
      env: [flag("R2_ACCOUNT_ID"), flag("R2_ACCESS_KEY_ID"), flag("R2_SECRET_ACCESS_KEY"), flag("R2_BUCKET_NAME"), flag("R2_PUBLIC_URL"), flag("R2_ENDPOINT")],
    },
    facebookPage: { ready: facebookPage, env: [flag("FACEBOOK_PAGE_ID"), flag("FACEBOOK_ACCESS_TOKEN")] },
    instagramLogin: {
      ready: instagramLogin && flag("OPERATIONS_INSTAGRAM_V2_ENABLED").set,
      env: [flag("OPERATIONS_INSTAGRAM_V2_ENABLED"), flag("INSTAGRAM_LOGIN_APP_ID"), flag("INSTAGRAM_LOGIN_APP_SECRET"), flag("INSTAGRAM_LOGIN_REDIRECT_URI"), flag("INSTAGRAM_LOGIN_STATE_SECRET"), flag("INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY"), flag("INSTAGRAM_LOGIN_API_VERSION"), flag("INSTAGRAM_LOGIN_MEDIA_ORIGIN"), flag("INSTAGRAM_LOGIN_ACCOUNT_ID"), flag("INSTAGRAM_LOGIN_ACCESS_TOKEN")],
    },
    x: { ready: x, env: [flag("X_API_KEY"), flag("X_API_SECRET"), flag("X_ACCESS_TOKEN"), flag("X_ACCESS_SECRET")] },
    scheduler: {
      ready: flag("CRON_SECRET").set || flag("OPERATIONS_CRON_TOKEN").set,
      livePublish: flag("OPERATIONS_LIVE_PUBLISH_ENABLED").set,
      env: [flag("CRON_SECRET"), flag("OPERATIONS_CRON_TOKEN"), flag("OPERATIONS_LIVE_PUBLISH_ENABLED"), flag("OPERATIONS_PERSISTENCE_MODE")],
    },
    inquiryNotify: {
      line: lineNotify,
      email,
      env: [flag("LINE_CHANNEL_ACCESS_TOKEN"), flag("LINE_ADMIN_USER_ID"), flag("ADMIN_LINE_USER_ID"), flag("SMTP_HOST"), flag("SMTP_PORT"), flag("SMTP_USER"), flag("SMTP_PASS"), flag("INQUIRY_TO_EMAIL"), flag("INQUIRY_FROM_EMAIL")],
    },
  };
}
