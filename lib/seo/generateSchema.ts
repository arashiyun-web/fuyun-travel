import { absoluteUrl, organizationJsonLd } from "@/lib/site";

export function articleSchema(args: {
  title: string;
  description: string;
  path: string;
  image?: string;
  publishedAt?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: args.title,
    description: args.description,
    image: args.image ? absoluteUrl(args.image) : undefined,
    datePublished: args.publishedAt,
    mainEntityOfPage: absoluteUrl(args.path),
    publisher: organizationJsonLd(),
  };
}

export function faqSchema(faq: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * FAQPage for grouped charter FAQ. Each question is prefixed with its vehicle so
 * answers (prices differ per vehicle) are never read as applying to another group.
 */
export function charterFaqPageSchema(
  groups: Array<{ vehicle: string; items: Array<{ question: string; answer: string }> }>,
) {
  return faqSchema(
    groups.flatMap((group) =>
      group.items.map((item) => ({ question: `【${group.vehicle}】${item.question}`, answer: item.answer })),
    ),
  );
}

export function vehicleSchema(args: {
  name: string;
  description: string;
  path: string;
  seats?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: args.name,
    description: args.description,
    seatingCapacity: args.seats,
    url: absoluteUrl(args.path),
  };
}

export function serviceSchema(args: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: args.name,
    description: args.description,
    provider: organizationJsonLd(),
    url: absoluteUrl(args.path),
  };
}
