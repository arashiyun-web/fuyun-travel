import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Bahasa Melayu",
  description: "Pintu masuk perkhidmatan sewa kenderaan dan pelancongan Taiwan.",
  path: "/ms",
});

export default function MsPage() {
  return (
    <>
      <h1>Fuyun Travel</h1>
      <p className="lead">Peringkat akan datang untuk kandungan Bahasa Melayu.</p>
      <Link href="/contact/inquiry">Minta sebut harga</Link>
    </>
  );
}
