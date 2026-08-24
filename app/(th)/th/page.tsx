import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "ภาษาไทย",
  description: "ทางเข้าสำหรับบริการรถเช่าเหมาคันและท่องเที่ยวไต้หวัน.",
  path: "/th",
});

export default function ThPage() {
  return (
    <>
      <h1>Fuyun Travel</h1>
      <p className="lead">เนื้อหาภาษาไทยจะอยู่ในระยะถัดไป.</p>
      <Link href="/contact/inquiry">ขอใบเสนอราคา</Link>
    </>
  );
}
