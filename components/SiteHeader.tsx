import Link from "next/link";
import { SITE } from "@/lib/site";

type SiteHeaderProps = {
  active?: "home" | "about" | "services" | "fleet" | "travel" | "reviews" | "contact";
};

const navItems = [
  { href: "/about", label: "關於我們", key: "about" },
  { href: "/services", label: "服務項目", key: "services" },
  { href: "/fleet", label: "車隊介紹", key: "fleet" },
  { href: "/travel", label: "旅遊內容", key: "travel" },
  { href: "/reviews", label: "旅客評價", key: "reviews" },
  { href: "/contact", label: "聯絡我們", key: "contact" },
] as const;

export default function SiteHeader({ active = "home" }: SiteHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-[#f7f3ea]/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-black tracking-wide text-[#2b2b2b]">
          {SITE.name}
          <span className="block text-xs font-medium tracking-[0.22em] text-[#b89b5e]">
            台灣包車旅遊
          </span>
        </Link>

        <div className="hidden items-center gap-6 text-sm font-semibold text-[#3d3d3d] md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`transition hover:text-[#b89b5e] ${
                active === item.key ? "text-[#b89b5e]" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/contact/inquiry"
            className="rounded-md bg-[#2f2f2f] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#b89b5e]"
          >
            立即報價
          </Link>
          <a
            href="/platform/index.html?v=official-member-register-v1#login"
            className="rounded-md border border-[#d8c9aa] bg-white/70 px-4 py-2 text-sm font-bold text-[#242424] transition hover:bg-white"
          >
            平台登入
          </a>
        </div>
      </nav>
    </header>
  );
}
