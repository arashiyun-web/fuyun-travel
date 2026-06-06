import { MessageCircle, Phone, Send, Smartphone } from "lucide-react";
import Link from "next/link";
import { COMPANY, LINE_URL } from "@/lib/site";

export default function FloatingContactBar() {
  const lineHref = LINE_URL || "/contact";

  return (
    <aside className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:inset-x-auto md:right-5 md:top-1/2 md:block md:-translate-y-1/2 md:px-0">
      <div className="pointer-events-auto flex gap-2 rounded-md border border-white/20 bg-[#2f2f2f]/92 p-2 shadow-2xl backdrop-blur md:flex-col">
        <a
          href={lineHref}
          target={LINE_URL ? "_blank" : undefined}
          rel={LINE_URL ? "noopener noreferrer" : undefined}
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
          className="hidden h-11 w-11 items-center justify-center rounded-md bg-[#1f1f1f] text-white hover:bg-[#444] md:inline-flex"
          aria-label="WhatsApp"
          title="WhatsApp"
        >
          <Smartphone size={20} />
        </a>
      </div>
    </aside>
  );
}
