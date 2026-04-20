import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { ReferralCapture } from "@/app/referral-tracker";
import { container } from "@/server/di/container";
import { CreateTripForm } from "@/app/app/trips/create-trip-form";
import { HeroMarketing } from "@/components/home/hero-marketing";
import { FeaturesSection } from "@/components/home/features-section";
import { PricingSection } from "@/components/home/pricing-section";
import { FAQSection } from "@/components/home/faq-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { CTASection } from "@/components/home/cta-section";
import { MarketingFooter } from "@/components/home/footer";
import { HomeNavBar } from "@/components/home/home-nav";
import { HeroAuthenticated } from "@/components/home/hero-authenticated";
import {
  DashboardQuickView,
  type HomeTripRow,
} from "@/components/home/dashboard-quick-view";
import { GpsHomeIndicator } from "@/components/home/gps-home-indicator";

export const metadata: Metadata = {
  title:
    "EasyTrip — Itinerari AI per Weekend in Europa | Pianifica in 30 secondi",
  description:
    "Pianifica viaggi brevi di 2–5 o più giorni con l'AI. Itinerari ottimizzati per distanze, ristoranti locali e gemme nascoste.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "it_IT",
    title:
      "EasyTrip — Itinerari AI per Weekend in Europa | Pianifica in 30 secondi",
    description:
      "Pianifica viaggi brevi di 2–5 o più giorni con l'AI. Itinerari ottimizzati per distanze, ristoranti locali e gemme nascoste.",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "EasyTrip — Itinerari AI per viaggi brevi",
      },
    ],
  },
};

function mapTripsForHome(
  rows: Awaited<
    ReturnType<
      typeof container.repositories.tripRepository.listRecentForDashboard
    >
  >,
): HomeTripRow[] {
  return rows.map((t) => ({
    id: t.id,
    destination: t.destination,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    status: t.status,
    currentVersion: t.currentVersion,
    versions: t.versions.map((v) => ({
      versionNum: v.versionNum,
      isActive: v.isActive,
      generatedAt: v.generatedAt.toISOString(),
      geoScore: v.geoScore != null ? String(v.geoScore) : null,
    })),
  }));
}

export default async function Home() {
  const clerk = await currentUser();
  const isAuthed = Boolean(clerk);

  let authenticatedBody: ReactNode = null;

  if (isAuthed) {
    const appUser =
      await container.services.authService.getOrCreateCurrentUser();
    const rawTrips =
      await container.repositories.tripRepository.listRecentForDashboard(
        appUser.id,
        5,
      );
    const trips = mapTripsForHome(rawTrips);
    const latestTripId = trips[0]?.id ?? null;

    const subExpires = appUser.subExpiresAt;
    const isPro =
      appUser.planType === "sub" &&
      subExpires != null &&
      subExpires > new Date();
    const planLabel = isPro ? ("Pro" as const) : ("Free" as const);
    const subExpiresLabel =
      isPro && subExpires
        ? `fino al ${subExpires.toLocaleDateString("it-IT")}`
        : null;

    const displayName =
      appUser.name?.trim() || appUser.email.split("@")[0] || "viaggiatore";

    authenticatedBody = (
      <>
        <HeroAuthenticated
          displayName={displayName}
          planLabel={planLabel}
          subExpiresLabel={subExpiresLabel}
        />
        <div className="mx-auto max-w-6xl space-y-8 px-4 pb-10">
          <GpsHomeIndicator latestTripId={latestTripId} />
          <DashboardQuickView trips={trips} />
          <section id="crea-itinerario" className="scroll-mt-28">
            <CreateTripForm />
          </section>
        </div>
        <MarketingFooter />
      </>
    );
  }

  return (
    <div className={`bg-et-deep text-et-ink min-h-screen`}>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <HomeNavBar mode={isAuthed ? "authenticated" : "guest"} />

      {isAuthed ? (
        authenticatedBody
      ) : (
        <>
          <HeroMarketing />
          <div id="come-funziona">
            <FeaturesSection />
          </div>
          <PricingSection />
          <TestimonialsSection />
          <FAQSection />
          <CTASection />
          <MarketingFooter />
        </>
      )}
    </div>
  );
}

