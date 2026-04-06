"use client";

import type { TripDetailDto } from "@/server/services/trip/tripService";
import { formatTripType } from "@/lib/day-unlock";
import Link from "next/link";
import { useState } from "react";
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
      window.alert(json.error?.message ?? "Errore durante la riattivazione");
    } catch {
      window.alert("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 pb-20 pt-8">
      {/* Back link */}
      <Link
        href="/app/trips"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-et-ink/50 transition-colors duration-200 hover:text-et-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tutti i viaggi
      </Link>

      {/* Emotional hero */}
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/20 bg-amber-500/10">
          <Sunset className="h-8 w-8 text-amber-400" />
        </div>

        <p className="text-sm font-medium uppercase tracking-widest text-amber-400/80">
          Viaggio completato
        </p>

        <h1 className="font-display mt-3 text-3xl font-normal leading-tight tracking-tight text-et-ink sm:text-4xl">
          Il tuo viaggio a{" "}
          <span className="text-et-accent">{trip.destination}</span>
          <br />è stato indimenticabile
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-et-ink/55">
          Ogni viaggio lascia un segno. I luoghi che hai scoperto, i sapori che
          hai assaggiato, i momenti che hai vissuto — sono tutti qui, pronti per
          essere rivissuti.
        </p>
      </div>

      {/* Trip stats */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-et-border bg-et-card px-4 py-2.5">
          <Calendar className="h-4 w-4 text-et-ink/40" />
          <span className="text-sm text-et-ink/70">
            {trip.startDate} → {trip.endDate}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-et-border bg-et-card px-4 py-2.5">
          <MapPin className="h-4 w-4 text-et-ink/40" />
          <span className="text-sm text-et-ink/70">
            {totalDays} {totalDays === 1 ? "giorno" : "giorni"} di avventura
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-et-border bg-et-card px-4 py-2.5">
          <Heart className="h-4 w-4 text-et-ink/40" />
          <span className="text-sm text-et-ink/70">
            {formatTripType(trip.tripType)}
          </span>
        </div>
      </div>

      {/* Expiry notice */}
      <div className="text-center">
        <p className="text-sm text-et-ink/40">
          L&apos;accesso al tuo itinerario è scaduto il{" "}
          <span className="font-medium text-et-ink/60">
            {trip.accessExpiresAt}
          </span>
        </p>
        <p className="mt-1 text-xs text-et-ink/30">
          Ma i ricordi restano per sempre.
        </p>
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
                <h2 className="text-lg font-medium text-et-ink">
                  Rileggi i ricordi
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-et-ink/55">
                  Riattiva l&apos;accesso completo al tuo itinerario per{" "}
                  <span className="font-semibold text-amber-300">
                    30 giorni
                  </span>
                  . Rivivi ogni giorno, ogni ristorante, ogni gemma nascosta che
                  hai scoperto.
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
                  Riattiva accesso — €2,90
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* CTA 2: New trip */}
        <div className="group overflow-hidden rounded-2xl border border-et-accent/20 bg-gradient-to-br from-et-accent/6 via-et-accent/3 to-transparent transition-colors duration-200 hover:border-et-accent/35">
          <div className="px-6 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-et-accent/25 bg-et-accent/10">
                <Globe className="h-5 w-5 text-et-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-medium text-et-ink">
                  Pianifica il prossimo viaggio
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-et-ink/55">
                  Hai già vissuto la magia di un itinerario su misura. La
                  prossima avventura ti aspetta — con uno{" "}
                  <span className="font-semibold text-et-accent">
                    sconto del 20%
                  </span>{" "}
                  dedicato a te.
                </p>
              </div>
            </div>

            <Link
              href="/app/trips?new=1"
              className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-et-accent/30 bg-et-accent/10 px-6 py-3 text-sm font-semibold text-et-accent transition-all duration-200 hover:bg-et-accent/20"
            >
              <Globe className="h-4 w-4" />
              Nuovo viaggio — sconto 20%
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs leading-relaxed text-et-ink/30">
        Il tuo itinerario è al sicuro. Puoi riattivare l&apos;accesso in
        qualsiasi momento.
      </p>
    </div>
  );
}
