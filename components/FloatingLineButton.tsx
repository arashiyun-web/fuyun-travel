"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { LINE_URL } from "@/lib/site";
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

export default function FloatingLineButton() {
  const pathname = usePathname();
  const lineHref = LINE_URL || "/contact";
  const lineSource = lineSourceFromPath(pathname);

  return (
    <a
      href={lineHref}
      target={LINE_URL ? "_blank" : undefined}
      rel={LINE_URL ? "noopener noreferrer" : undefined}
      onClick={() => trackEvent("line_click", { source: lineSource })}
      className="floating-line-btn-v2"
      aria-label="LINE立即報價"
      title="LINE立即報價"
    >
      <MessageCircle size={22} />
    </a>
  );
}
