import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReferralCapture } from "@/app/referral-tracker";
import { container } from "@/server/di/container";
import { CreateTripForm } from "./app/trips/create-trip-form";
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

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.metadata" });

  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: t("ogLocale"),
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: "/og.svg",
          width: 1200,
          height: 630,
          alt: t("ogImageAlt"),
        },
      ],
    },
  };
}

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

export default async function Home({ params }: LocalePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const clerk = await currentUser();
  const isAuthed = Boolean(clerk);

  let authenticatedBody: ReactNode = null;

  if (isAuthed) {
    const t = await getTranslations({ locale, namespace: "home.heroAuth" });
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
    const localeToBcp47: Record<string, string> = {
      it: "it-IT",
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
      de: "de-DE",
    };
    const subExpiresLabel =
      isPro && subExpires
        ? `${t("subExpiresPrefix")} ${subExpires.toLocaleDateString(
            localeToBcp47[locale] ?? "it-IT",
          )}`
        : null;

    const displayName =
      appUser.name?.trim() ||
      appUser.email.split("@")[0] ||
      t("greetingFallback");

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
        <div id="come-funziona" className="scroll-mt-28">
          <FeaturesSection />
        </div>
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
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
