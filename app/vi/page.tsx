import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Tiếng Việt",
  description: "Cổng thông tin thuê xe và du lịch Đài Loan.",
  path: "/vi",
});

export default function ViPage() {
  return (
    <>
      <h1>Fuyun Travel</h1>
      <p className="lead">Giai đoạn tiếp theo dành cho nội dung tiếng Việt.</p>
      <Link href="/contact/inquiry">Yêu cầu báo giá</Link>
    </>
  );
}
