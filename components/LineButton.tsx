import type { ReactNode } from "react";
import { LINE_URL } from "@/lib/site";

export default function LineButton({
  children = "LINE 諮詢",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  if (!LINE_URL) {
    return (
      <span
        className={`btn btn-line btn-disabled ${className}`}
        role="button"
        aria-disabled="true"
        title="請設定 NEXT_PUBLIC_LINE_OA_URL"
      >
        加入LINE立即詢價
      </span>
    );
  }

  return (
    <a
      className={`btn btn-line ${className}`}
      href={LINE_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
