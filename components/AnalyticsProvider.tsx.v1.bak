"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

let posthogReady = false;

function initPostHog() {
  if (posthogReady || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: false,
  });
  posthogReady = true;
}

export default function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!posthogReady) return;

    const query = searchParams.toString();
    posthog.capture("$pageview", {
      current_url: `${window.location.origin}${pathname}${query ? `?${query}` : ""}`,
      path: pathname,
    });
  }, [pathname, searchParams]);

  return children;
}
