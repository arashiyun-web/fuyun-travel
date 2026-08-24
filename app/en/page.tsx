import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "English",
  description: "Fuyun Travel Taiwan charter service entry.",
  path: "/en",
});

export default function EnPage() {
  return (
    <>
      <h1>Fuyun Travel</h1>
      <p className="lead">Taiwan charter transport for private tours, airport transfers, schools and corporate groups.</p>
      <Link href="/contact/inquiry">Request a quote</Link>
    </>
  );
}
