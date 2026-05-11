// MarketingLandingPage — the public landing at "/".
//
// This is intentionally thin. All visual concerns live in components/landing/*.
// The page's only job is composition + reading the optional `?error=...`
// query param that /install bounces back when Zoom OAuth fails.

import type { Metadata } from "next";
import { humanizeError } from "@/lib/copy";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingProblemSection } from "@/components/landing/LandingProblemSection";
import { LandingHowItWorksSection } from "@/components/landing/LandingHowItWorksSection";
import { LandingWhoItsForSection } from "@/components/landing/LandingWhoItsForSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "NoteBouncer — You decide what AI is allowed in your meeting",
  description:
    "Detect and remove AI notetakers from your Zoom meetings. Otter, Fireflies, Read, Krisp, and more — caught the moment they join. By Sapience AI.",
  alternates: {
    canonical: "/",
  },
};

interface MarketingLandingPageProps {
  searchParams: {
    error?: string;
  };
}

export default function MarketingLandingPage({
  searchParams,
}: MarketingLandingPageProps) {
  const errorMessage = searchParams.error
    ? humanizeError(searchParams.error)
    : undefined;

  return (
    <main className="min-h-screen bg-canvas-sand">
      <LandingNav />
      <LandingHero errorMessage={errorMessage} />
      <LandingProblemSection />
      <LandingHowItWorksSection />
      <LandingWhoItsForSection />
      <LandingFooter />
    </main>
  );
}
