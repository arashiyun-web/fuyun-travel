import { notFound } from "next/navigation";
import SeatBooking from "@/components/SeatBooking";
import SiteHeader from "@/components/SiteHeader";
import { findTourById, toursData } from "@/lib/tours";

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

  return {
    title: tour ? `${tour.title}｜報名選位` : "行程報名選位"
  };
}

export default function TourDetailPage({ params }: TourDetailPageProps) {
  const tour = findTourById(params.id);

  if (!tour) {
    notFound();
  }

  return (
    <>
      <SiteHeader active="itineraries" />
      <SeatBooking tour={tour} />
    </>
  );
}
