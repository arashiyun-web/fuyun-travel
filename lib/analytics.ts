export type AnalyticsEventName =
  | "ai_chat_started"
  | "ai_quote_requested"
  | "ai_price_viewed"
  | "line_click"
  | "quote_submitted"
  | "quote_sent"
  | "quote_confirmed"
  | "booking_completed";

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (command: "event", eventName: string, params?: AnalyticsPayload) => void;
  }
}

function sendGa4Event(eventName: AnalyticsEventName, payload: AnalyticsPayload) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, payload);
}

async function sendPostHogEvent(eventName: AnalyticsEventName, payload: AnalyticsPayload) {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  const posthog = await import("posthog-js");
  posthog.default.capture(eventName, payload);
}

export function trackEvent(eventName: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  sendGa4Event(eventName, payload);
  void sendPostHogEvent(eventName, payload);
}

export function getAttribution() {
  if (typeof window === "undefined") {
    return {
      sourcePage: "",
      referer: "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmTerm: "",
      utmContent: "",
      keyword: "",
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    sourcePage: window.location.pathname,
    referer: document.referrer || "",
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmTerm: params.get("utm_term") || "",
    utmContent: params.get("utm_content") || "",
    keyword: params.get("keyword") || params.get("q") || "",
  };
}
