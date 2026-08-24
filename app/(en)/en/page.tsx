import type { Metadata } from "next";
import GeoHomeContent from "@/components/GeoHomeContent";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "home" as Parameters<typeof geoContent>[0];
const LOCALE = "en" as string;
const CANONICAL = "https://fuyuntravel.com/en";
const TITLE = "Taiwan Charter Bus, Airport Transfer & Coach | Fuyun Travel";
const DESCRIPTION =
  "Fuyun Travel — licensed Taiwan charter bus, airport transfer, coach tours & school trips. Reply within 30 minutes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: geoAlternates(SECTION, LOCALE as Parameters<typeof geoAlternates>[1]),
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
};

const LABELS = {
  brand: "Fuyun Travel｜浮雲輕鬆遊",
  quote: "Request a quote",
  phone: "Call now",
  trust: "Licenses & credentials",
  updated: "2026 latest",
  faqTitle: "FAQ",
  trustBadges: [
    "Reply within 30 minutes",
    "Licensed travel agency & coach operator",
    "Family, school & corporate tours",
  ],
  features: [
    { title: "Coach Charter", text: "School trips, corporate tours, large groups" },
    { title: "Airport Transfer", text: "Pickup / drop-off, multi-stop, luggage help" },
    { title: "Travel Guides", text: "Latest guides, popular routes, charter advice" },
    { title: "Instant Quote", text: "Date, group size, route — quick estimate" },
    { title: "Highlights", text: "Real trips we've taken — photos & stories" },
  ],
};

export default function HomeEnPage() {
  const content = geoContent(SECTION, LOCALE);
  const schema = buildGeoSchema({
    locale: LOCALE as Parameters<typeof buildGeoSchema>[0]["locale"],
    service: { name: content.h1, description: content.lead, url: CANONICAL },
    faq: content.faq.map((f) => ({ q: f.q, a: f.a })),
  });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <GeoHomeContent content={content} labels={LABELS} />
    </>
  );
}
