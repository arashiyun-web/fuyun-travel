import type { Metadata } from "next";
import SocialDistribute from "@/components/SocialDistribute";

export const metadata: Metadata = {
  title: "社群一鍵分發｜後台",
  robots: { index: false, follow: false },
};

export default function DistributePage() {
  return (
    <SocialDistribute
      connections={{
        line: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET),
        facebook: Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_ACCESS_TOKEN),
        instagram: Boolean(process.env.INSTAGRAM_BUSINESS_ID && process.env.FACEBOOK_ACCESS_TOKEN),
        x: Boolean(process.env.X_BEARER_TOKEN),
      }}
    />
  );
}
