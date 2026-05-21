import Link from "next/link";

type SiteHeaderProps = {
  active?: "home" | "itineraries";
};

export default function SiteHeader({ active = "home" }: SiteHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-[#f7f3ea]/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-black tracking-wide text-[#2b2b2b]">
          浮雲旅遊
          <span className="block text-xs font-medium tracking-[0.22em] text-[#b89b5e]">
            專業包車旅遊服務
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-semibold text-[#3d3d3d] md:flex">
          <Link href="/#services" className="transition hover:text-[#b89b5e]">
            服務
          </Link>
          <Link href="/#vehicles" className="transition hover:text-[#b89b5e]">
            車型
          </Link>
          <Link
            href="/itineraries"
            className={`transition hover:text-[#b89b5e] ${
              active === "itineraries" ? "text-[#b89b5e]" : ""
            }`}
          >
            行程
          </Link>
          <Link href="/#contact" className="transition hover:text-[#b89b5e]">
            聯絡
          </Link>
        </div>

        <Link
          href={active === "itineraries" ? "/#contact" : "#contact"}
          className="rounded-md bg-[#2f2f2f] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#b89b5e]"
        >
          立即詢價
        </Link>
      </nav>
    </header>
  );
}
