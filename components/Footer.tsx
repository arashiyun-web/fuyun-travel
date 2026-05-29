import Link from "next/link";
import LegalInfo from "@/components/LegalInfo";
import LineButton from "@/components/LineButton";
import { COMPANY } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <LegalInfo />

        <div className="site-footer__cta">
          <a className="btn" href={`tel:${COMPANY.phone}`}>
            電話：{COMPANY.phone}
          </a>
          <a className="btn" href={`mailto:${COMPANY.email}`}>
            Email：{COMPANY.email}
          </a>
          <LineButton>LINE 官方帳號諮詢</LineButton>
        </div>

        <nav className="site-footer__links" aria-label="網站連結">
          <Link href="/privacy">隱私權政策</Link>
        </nav>

        <small className="site-footer__copy">
          © {new Date().getFullYear()} {COMPANY.companyName}（{COMPANY.siteName}）All rights reserved.
        </small>
      </div>
    </footer>
  );
}
