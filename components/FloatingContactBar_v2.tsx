"use client";

import { MessageCircle, Phone, Send, Smartphone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY, LINE_URL } from "@/lib/site";
import { trackEvent } from "@/lib/analytics";

type LineSource = "home" | "pricing" | "charter" | "school" | "airport" | "article";

function lineSourceFromPath(pathname: string): LineSource {
  if (pathname === "/") return "home";
  if (pathname.includes("school")) return "school";
  if (pathname.includes("airport")) return "airport";
  if (pathname.startsWith("/charter-bus") || pathname.includes("coach-charter")) return "charter";
  if (pathname.startsWith("/travel")) return "article";
  return "pricing";
}

export default function FloatingContactBarV2() {
  const pathname = usePathname();
  const lineHref = LINE_URL || "/contact";
  const lineSource = lineSourceFromPath(pathname);

  return (
    <>
      {/* Desktop sidebar (md+) — unchanged from original */}
      <aside className="pointer-events-none fixed inset-x-auto right-5 top-1/2 z-50 hidden -translate-y-1/2 md:block">
        <div className="pointer-events-auto flex flex-col gap-2 rounded-md border border-white/20 bg-[#2f2f2f]/92 p-2 shadow-2xl backdrop-blur">
          <a
            href={lineHref}
            target={LINE_URL ? "_blank" : undefined}
            rel={LINE_URL ? "noopener noreferrer" : undefined}
            onClick={() => trackEvent("line_click", { source: lineSource })}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#066d2b] text-white hover:bg-[#0a8d39]"
            aria-label="LINE AI客服"
            title="LINE AI客服"
          >
            <MessageCircle size={20} />
          </a>
          <Link
            href="/contact/inquiry"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#2f6fed] text-white hover:bg-[#1f58c7]"
            aria-label="立即報價"
            title="立即報價"
          >
            <Send size={20} />
          </Link>
          <a
            href={`tel:${COMPANY.phone}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#d1b875] text-[#242424] hover:bg-[#e0c983]"
            aria-label="電話直撥"
            title="電話直撥"
          >
            <Phone size={20} />
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`我想詢問 ${COMPANY.siteName} 包車旅遊服務`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#1f1f1f] text-white hover:bg-[#444]"
            aria-label="WhatsApp"
            title="WhatsApp"
          >
            <Smartphone size={20} />
          </a>
        </div>
      </aside>

      {/* Mobile bottom CTA bar (B) — not rendered on inquiry page */}
      {pathname !== "/contact/inquiry" && (
        <div className="mobile-cta-bar-v2" aria-label="快速聯絡">
          <a
            href={lineHref}
            target={LINE_URL ? "_blank" : undefined}
            rel={LINE_URL ? "noopener noreferrer" : undefined}
            onClick={() => trackEvent("line_click", { source: lineSource })}
            className="mobile-cta-bar-v2__line"
            aria-label="LINE立即報價"
          >
            LINE立即報價
          </a>
          <Link
            href="/contact/inquiry"
            className="mobile-cta-bar-v2__inquiry"
            aria-label="立即詢價"
          >
            立即詢價
          </Link>
        </div>
      )}
    </>
  );
}
