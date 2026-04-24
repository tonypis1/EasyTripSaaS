"use client";

import type { TripDetailDto } from "@/server/services/trip/tripService";
import { formatTripType } from "@/lib/day-unlock";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Globe,
  Heart,
  Loader2,
  MapPin,
  Sparkles,
  Sunset,
} from "lucide-react";

type Props = {
  trip: TripDetailDto;
};

export function PostTripScreen({ trip }: Props) {
  const t = useTranslations("app.trips.postTrip");
  const [loading, setLoading] = useState(false);

  const totalDays = trip.days.length || 1;

  async function onReactivate() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/reactivate-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { checkoutUrl?: string };
        error?: { message?: string };
      };
      const url = json.data?.checkoutUrl;
      if (res.ok && url) {
        window.location.href = url;
        return;
      }
      window.alert(json.error?.message ?? t("reactivateError"));
    } catch {
      window.alert(t("reactivateNetworkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 pt-8 pb-20">
      {/* Back link */}
      <Link
        href="/app/trips"
        className="text-et-ink/50 hover:text-et-accent inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase transition-colors duration-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("backToTrips")}
      </Link>

      {/* Emotional hero */}
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/20 bg-amber-500/10">
          <Sunset className="h-8 w-8 text-amber-400" />
        </div>

        <p className="text-sm font-medium tracking-widest text-amber-400/80 uppercase">
          {t("eyebrow")}
        </p>

        <h1 className="font-display text-et-ink mt-3 text-3xl leading-tight font-normal tracking-tight sm:text-4xl">
          {t("heroLine1")}{" "}
          <span className="text-et-accent">{trip.destination}</span>
          <br />
          {t("heroLine2")}
        </h1>

        <p className="text-et-ink/55 mt-4 max-w-md text-sm leading-relaxed">
          {t("heroBody")}
        </p>
      </div>

      {/* Trip stats */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="border-et-border bg-et-card flex items-center gap-2 rounded-xl border px-4 py-2.5">
          <Calendar className="text-et-ink/40 h-4 w-4" />
          <span className="text-et-ink/70 text-sm">
            {trip.startDate} → {trip.endDate}
          </span>
        </div>
        <div className="border-et-border bg-et-card flex items-center gap-2 rounded-xl border px-4 py-2.5">
          <MapPin className="text-et-ink/40 h-4 w-4" />
          <span className="text-et-ink/70 text-sm">
            {totalDays} {totalDays === 1 ? t("daysSingular") : t("daysPlural")}
          </span>
        </div>
        <div className="border-et-border bg-et-card flex items-center gap-2 rounded-xl border px-4 py-2.5">
          <Heart className="text-et-ink/40 h-4 w-4" />
          <span className="text-et-ink/70 text-sm">
            {formatTripType(trip.tripType)}
          </span>
        </div>
      </div>

      {/* Expiry notice */}
      <div className="text-center">
        <p className="text-et-ink/40 text-sm">
          {t("expiryPrefix")}{" "}
          <span className="text-et-ink/60 font-medium">
            {trip.accessExpiresAt}
          </span>
        </p>
        <p className="text-et-ink/30 mt-1 text-xs">{t("expirySuffix")}</p>
      </div>

      {/* CTA Cards */}
      <div className="space-y-4">
        {/* CTA 1: Reactivate */}
        <div className="group overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/8 via-amber-400/5 to-transparent transition-colors duration-200 hover:border-amber-400/35">
          <div className="px-6 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
                <BookOpen className="h-5 w-5 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-et-ink text-lg font-medium">
                  {t("reactivateTitle")}
                </h2>
                <p className="text-et-ink/55 mt-1 text-sm leading-relaxed">
                  {t.rich("reactivateBody", {
                    strong: (chunks) => (
                      <span className="font-semibold text-amber-300">
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
              </div>
            </div>

            <button
              onClick={onReactivate}
              disabled={loading}
              className="mt-5 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-gray-950 transition-all duration-200 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("reactivateCta")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* CTA 2: New trip */}
        <div className="group border-et-accent/20 from-et-accent/6 via-et-accent/3 hover:border-et-accent/35 overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent transition-colors duration-200">
          <div className="px-6 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="border-et-accent/25 bg-et-accent/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
                <Globe className="text-et-accent h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-et-ink text-lg font-medium">
                  {t("newTripTitle")}
                </h2>
                <p className="text-et-ink/55 mt-1 text-sm leading-relaxed">
                  {t.rich("newTripBody", {
                    accent: (chunks) => (
                      <span className="text-et-accent font-semibold">
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
              </div>
            </div>

            <Link
              href="/app/trips?new=1"
              className="border-et-accent/30 bg-et-accent/10 text-et-accent hover:bg-et-accent/20 mt-5 flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border px-6 py-3 text-sm font-semibold transition-all duration-200"
            >
              <Globe className="h-4 w-4" />
              {t("newTripCta")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-et-ink/30 text-center text-xs leading-relaxed">
        {t("footerNote")}
      </p>
    </div>
  );
}
