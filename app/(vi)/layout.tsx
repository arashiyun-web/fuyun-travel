import "../globals.css";
import SiteRootLayout from "@/components/SiteRootLayout";
import { siteRootMetadata, siteRootViewport } from "@/lib/site-root-metadata";

export const metadata = siteRootMetadata;
export const viewport = siteRootViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <SiteRootLayout lang="vi">{children}</SiteRootLayout>;
}
