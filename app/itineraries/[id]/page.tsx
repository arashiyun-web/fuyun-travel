import { notFound } from "next/navigation";
import SeatBooking from "@/components/SeatBooking";
import SiteHeader from "@/components/SiteHeader";
import { findTourById, toursData } from "@/lib/tours";
import { pageMeta } from "@/lib/site";

type TourDetailPageProps = {
  params: {
    id: string;
  };
};

export function generateStaticParams() {
  return toursData.map((tour) => ({ id: String(tour.id) }));
}

export function generateMetadata({ params }: TourDetailPageProps) {
  const tour = findTourById(params.id);
  if (!tour) return pageMeta({ title: "精選行程", path: "/itineraries" });
  return pageMeta({
    title: tour.title,
    description: tour.summary,
    path: `/itineraries/${tour.id}`,
  });
}

export default function TourDetailPage({ params }: TourDetailPageProps) {
  const tour = findTourById(params.id);

  if (!tour) {
    notFound();
  }

  return (
    <>
      <SiteHeader active="travel" />
      <SeatBooking tour={tour} />
    </>
  );
}
