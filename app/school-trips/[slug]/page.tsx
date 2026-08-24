import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExploreDetailPage } from "@/components/TravelExploreCard";
import {
  buildExploreSchemas,
  explorePageMeta,
  findSchoolTrip,
  schoolTrips,
} from "@/lib/travelExplore";

type SchoolTripPageProps = { params: { slug: string } };

// Static params keep the first release limited to the five approved school-trip venues.
export function generateStaticParams() {
  return schoolTrips.map((item) => ({ slug: item.slug }));
}

export function generateMetadata({ params }: SchoolTripPageProps): Metadata {
  const item = findSchoolTrip(params.slug);
  if (!item) return explorePageMeta({ title: "找不到校外教學景點", path: "/travel" });

  return explorePageMeta({
    title: `${item.title}校外教學`,
    description: item.description,
    path: `/school-trips/${item.slug}`,
    image: item.coverImage,
  });
}

export default function SchoolTripPage({ params }: SchoolTripPageProps) {
  const item = findSchoolTrip(params.slug);
  if (!item) notFound();

  const path = `/school-trips/${item.slug}`;
  return (
    <ExploreDetailPage
      item={item}
      parentName="校外教學推薦"
      parentPath="/travel"
      jsonLd={buildExploreSchemas(item, path, "校外教學推薦", "/travel")}
    />
  );
}
