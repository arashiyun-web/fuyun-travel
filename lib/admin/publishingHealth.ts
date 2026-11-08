export type EnvFlag = { name: string; set: boolean };
export type CheckState = "not_tested";

function raw(name: string) {
  return process.env[name]?.trim() || "";
}

/** A filled name. The word false is not treated as present or enabled. */
function flag(name: string): EnvFlag {
  const value = raw(name);
  return { name, set: Boolean(value) && !/^false$/i.test(value) };
}

/** Same rule as publishing: only the exact string true turns a switch on. */
export function envEnabled(name: string) {
  return raw(name) === "true";
}

const COPY_PAIRS = [
  { id: "gemini", key: "GEMINI_API_KEY", model: "GEMINI_MODEL" },
  { id: "anthropic", key: "ANTHROPIC_API_KEY", model: "AI_MODEL_NAME" },
  { id: "openai", key: "OPENAI_API_KEY", model: "OPENAI_MODEL" },
] as const;

function copywritingStatus() {
  const pairs = COPY_PAIRS.map((pair) => {
    const keySet = flag(pair.key).set;
    const modelSet = flag(pair.model).set;
    return { ...pair, complete: keySet && modelSet, missing: [keySet ? "" : pair.key, modelSet ? "" : pair.model].filter(Boolean) };
  });
  const selected = pairs.find((pair) => pair.complete) || null;
  const partial = pairs.find((pair) => pair.missing.length === 1) || null;
  return {
    selected: selected?.id || null,
    missing: selected ? [] : partial?.missing || [],
    unselected: !selected && !partial,
  };
}

export function publishingHealth() {
  const copy = copywritingStatus();
  const r2Upload = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"].every((name) => flag(name).set);
  const facebookPage = flag("FACEBOOK_PAGE_ID").set && flag("FACEBOOK_ACCESS_TOKEN").set;
  const instagramLogin = ["INSTAGRAM_LOGIN_APP_ID", "INSTAGRAM_LOGIN_APP_SECRET", "INSTAGRAM_LOGIN_REDIRECT_URI", "INSTAGRAM_LOGIN_STATE_SECRET", "INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY", "INSTAGRAM_LOGIN_API_VERSION", "INSTAGRAM_LOGIN_MEDIA_ORIGIN"].every((name) => flag(name).set);
  const x = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"].every((name) => flag(name).set);
  const lineNotify = flag("LINE_CHANNEL_ACCESS_TOKEN").set && (flag("LINE_ADMIN_USER_ID").set || flag("ADMIN_LINE_USER_ID").set);
  const email = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].every((name) => flag(name).set) && (flag("INQUIRY_TO_EMAIL").set || flag("SMTP_USER").set);
  const checks = { functionalCheck: "not_tested" as CheckState, authorizationCheck: "not_tested" as CheckState };
  return {
    copywriting: {
      ready: Boolean(copy.selected),
      selected: copy.selected,
      missing: copy.missing,
      unselected: copy.unselected,
      ...checks,
      env: [flag("GEMINI_API_KEY"), flag("GEMINI_MODEL"), flag("ANTHROPIC_API_KEY"), flag("AI_MODEL_NAME"), flag("AI_API_BASE"), flag("OPENAI_API_KEY"), flag("OPENAI_MODEL")],
    },
    imageUpload: {
      ready: r2Upload,
      missing: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"].filter((name) => !flag(name).set),
      optional: ["R2_ENDPOINT"],
      ...checks,
      env: [flag("R2_ACCOUNT_ID"), flag("R2_ACCESS_KEY_ID"), flag("R2_SECRET_ACCESS_KEY"), flag("R2_BUCKET_NAME"), flag("R2_PUBLIC_URL"), flag("R2_ENDPOINT")],
    },
    facebookPage: {
      ready: facebookPage,
      missing: ["FACEBOOK_PAGE_ID", "FACEBOOK_ACCESS_TOKEN"].filter((name) => !flag(name).set),
      ...checks,
      env: [flag("FACEBOOK_PAGE_ID"), flag("FACEBOOK_ACCESS_TOKEN")],
    },
    instagramLogin: {
      ready: instagramLogin && envEnabled("OPERATIONS_INSTAGRAM_V2_ENABLED"),
      missing: ["OPERATIONS_INSTAGRAM_V2_ENABLED", "INSTAGRAM_LOGIN_APP_ID", "INSTAGRAM_LOGIN_APP_SECRET", "INSTAGRAM_LOGIN_REDIRECT_URI", "INSTAGRAM_LOGIN_STATE_SECRET", "INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY", "INSTAGRAM_LOGIN_API_VERSION", "INSTAGRAM_LOGIN_MEDIA_ORIGIN"].filter((name) => name === "OPERATIONS_INSTAGRAM_V2_ENABLED" ? !envEnabled(name) : !flag(name).set),
      optional: ["INSTAGRAM_LOGIN_ACCOUNT_ID", "INSTAGRAM_LOGIN_ACCESS_TOKEN"],
      ...checks,
      env: [flag("OPERATIONS_INSTAGRAM_V2_ENABLED"), flag("INSTAGRAM_LOGIN_APP_ID"), flag("INSTAGRAM_LOGIN_APP_SECRET"), flag("INSTAGRAM_LOGIN_REDIRECT_URI"), flag("INSTAGRAM_LOGIN_STATE_SECRET"), flag("INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY"), flag("INSTAGRAM_LOGIN_API_VERSION"), flag("INSTAGRAM_LOGIN_MEDIA_ORIGIN"), flag("INSTAGRAM_LOGIN_ACCOUNT_ID"), flag("INSTAGRAM_LOGIN_ACCESS_TOKEN")],
    },
    x: {
      ready: x,
      missing: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"].filter((name) => !flag(name).set),
      notUsed: ["X_BEARER_TOKEN"],
      ...checks,
      env: [flag("X_API_KEY"), flag("X_API_SECRET"), flag("X_ACCESS_TOKEN"), flag("X_ACCESS_SECRET")],
    },
    scheduler: {
      ready: flag("CRON_SECRET").set || flag("OPERATIONS_CRON_TOKEN").set,
      livePublish: envEnabled("OPERATIONS_LIVE_PUBLISH_ENABLED"),
      missing: flag("CRON_SECRET").set || flag("OPERATIONS_CRON_TOKEN").set ? [] : ["CRON_SECRET"],
      ...checks,
      env: [flag("CRON_SECRET"), flag("OPERATIONS_CRON_TOKEN"), flag("OPERATIONS_LIVE_PUBLISH_ENABLED"), flag("OPERATIONS_PERSISTENCE_MODE")],
    },
    inquiryNotify: {
      line: lineNotify,
      lineEither: ["LINE_ADMIN_USER_ID", "ADMIN_LINE_USER_ID"],
      email,
      emailOptional: ["SMTP_PORT", "INQUIRY_TO_EMAIL", "INQUIRY_FROM_EMAIL"],
      missing: [
        flag("LINE_CHANNEL_ACCESS_TOKEN").set ? "" : "LINE_CHANNEL_ACCESS_TOKEN",
        flag("LINE_ADMIN_USER_ID").set || flag("ADMIN_LINE_USER_ID").set ? "" : "LINE_ADMIN_USER_ID 或 ADMIN_LINE_USER_ID",
        email ? "" : "SMTP_HOST、SMTP_USER、SMTP_PASS",
      ].filter(Boolean),
      ...checks,
      env: [flag("LINE_CHANNEL_ACCESS_TOKEN"), flag("LINE_ADMIN_USER_ID"), flag("ADMIN_LINE_USER_ID"), flag("SMTP_HOST"), flag("SMTP_PORT"), flag("SMTP_USER"), flag("SMTP_PASS"), flag("INQUIRY_TO_EMAIL"), flag("INQUIRY_FROM_EMAIL")],
    },
  };
}
