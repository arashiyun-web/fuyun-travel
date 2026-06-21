"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LINE_URL } from "@/lib/site";
import { trackCtaClick } from "@/lib/analytics";

const STORAGE_KEY = "summer-banner-closed";

export default function SummerUrgencyBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (pathname.startsWith("/admin") || !visible) return null;

  const lineHref = LINE_URL || "/contact";

  function handleClose() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="summer-banner-v2" role="banner" aria-label="暑假優惠通知">
      <span className="summer-banner-v2__text">
        暑假熱門日期快速額滿，現在詢問把握機會！
      </span>
      <a
        href={lineHref}
        target={LINE_URL ? "_blank" : undefined}
        rel={LINE_URL ? "noopener noreferrer" : undefined}
        className="summer-banner-v2__line"
        onClick={() => trackCtaClick({ cta_location: "banner" })}
        aria-label="LINE 立即詢問"
      >
        LINE 立即詢問
      </a>
      <button
        type="button"
        className="summer-banner-v2__close"
        onClick={handleClose}
        aria-label="關閉暑假優惠通知"
      >
        ✕
      </button>
    </div>
  );
}
