import { Send } from "lucide-react";
import Link from "next/link";
import InquiryForm from "@/components/InquiryForm";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "填寫詢價表單"
};

export default function InquiryPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-16 pt-16 text-[#242424]">
      <SiteHeader active="contact" />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/contact" className="text-sm font-bold text-[#b89b5e] hover:text-[#242424]">
          返回聯絡方式
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-md bg-[#2f2f2f] p-8 text-white">
            <p className="text-sm font-bold tracking-[0.25em] text-[#d9c38f]">第三層｜聯絡內容</p>
            <h1 className="mt-4 text-4xl font-black leading-tight">填寫詢價表單</h1>
            <p className="mt-5 leading-8 text-white/72">
              請留下出發日期、人數、出發地、目的地與需求。收到後會依照內容協助確認車型、路線與報價。
            </p>
          </section>
          <section className="rounded-md border border-[#d8ccb2] bg-white p-6 shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
            <div className="mb-6 flex items-center gap-3">
              <Send className="text-[#b89b5e]" size={22} />
              <h2 className="text-2xl font-black">詢價表單</h2>
            </div>
            <InquiryForm />
          </section>
        </div>
      </section>
    </main>
  );
}
