"use client";

import type { TripDetailDto } from "@/server/services/trip/tripService";
import {
  formatStatus,
  formatTripType,
  isDayUnlocked,
} from "@/lib/day-unlock";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  initialTrip: TripDetailDto;
  checkoutFlash?: "success" | "cancel" | null;
  showDevShortcut: boolean;
};

function snippetFromJson(raw: string | null) {
  if (!raw || raw === "{}" || raw === "null") return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o === "object" && o !== null && !Array.isArray(o)) {
      const entries = Object.entries(o as Record<string, unknown>);
      if (entries.length === 0) return null;
      return entries
        .map(([k, v]) => `${k}: ${String(v)}`)
        .slice(0, 4)
        .join(" · ");
    }
    return String(o).slice(0, 120);
  } catch {
    return raw.slice(0, 160);
  }
}

export function TripDetailClient({
  initialTrip,
  checkoutFlash,
  showDevShortcut,
}: Props) {
  const router = useRouter();
  const [trip, setTrip] = useState(initialTrip);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setTrip(initialTrip);
  }, [initialTrip]);

  const generating =
    trip.isPaid && trip.days.length === 0 && trip.status === "pending";

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [generating, router]);

  const refreshTrip = useCallback(async () => {
    const res = await fetch(`/api/trips/${trip.id}`);
    const json = await res.json();
    if (res.ok && json.ok) setTrip(json.data as TripDetailDto);
  }, [trip.id]);

  async function onCheckout() {
    setBusy("checkout");
    setMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json.error?.message ?? "Checkout non disponibile");
        return;
      }
      const url = json.data.checkoutUrl as string;
      window.location.href = url;
    } catch {
      setMsg("Errore di rete durante il checkout");
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate() {
    setBusy("gen");
    setMsg(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/generate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? "Generazione non avviata");
        return;
      }
      setMsg("Generazione avviata. Attendi qualche secondo…");
      await refreshTrip();
      router.refresh();
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="border-l-2 border-et-accent/40 pl-6">
          <Link
            href="/app/trips"
            className="text-xs font-semibold uppercase tracking-wider text-et-ink/50 transition hover:text-et-accent"
          >
            ← Tutti i viaggi
          </Link>
          <h1 className="font-display mt-2 text-3xl font-normal tracking-tight text-et-ink sm:text-4xl">
            {trip.destination}
          </h1>
          <p className="mt-2 text-sm text-et-ink/65">
            {trip.startDate} → {trip.endDate} · {formatTripType(trip.tripType)}
            {trip.style ? ` · ${trip.style}` : ""}
          </p>
          <p className="mt-1 text-xs text-et-ink/50">
            Stato: <span className="text-et-accent/90">{formatStatus(trip.status)}</span>
            {trip.isPaid ? " · Pagato" : " · Da pagare"}
          </p>
        </div>
      </div>

      {checkoutFlash === "success" ? (
        <div className="rounded-xl border border-et-accent/35 bg-et-accent/10 px-4 py-3 text-sm text-et-accent/95">
          Pagamento ricevuto. La generazione parte in background: aggiornamento automatico ogni pochi secondi.
        </div>
      ) : null}
      {checkoutFlash === "cancel" ? (
        <div className="rounded-xl border border-et-border bg-et-card px-4 py-3 text-sm text-et-ink/70">
          Checkout annullato. Puoi riprovare quando vuoi.
        </div>
      ) : null}
      {msg ? (
        <div className="rounded-xl border border-et-border bg-et-card px-4 py-3 text-sm text-et-ink/80">
          {msg}
        </div>
      ) : null}

      {/* Flusso: pagamento */}
      {!trip.isPaid ? (
        <section className="rounded-2xl border border-et-border bg-et-card p-6">
          <h2 className="font-display text-lg text-et-ink">Sblocca la generazione</h2>
          <p className="mt-2 max-w-xl text-sm text-et-ink/65">
            Completa il pagamento con Stripe (test o live). Al termine, il webhook avvia
            Inngest e crea i giorni dell&apos;itinerario.
          </p>
          <button
            type="button"
            onClick={onCheckout}
            disabled={busy !== null}
            className="mt-4 inline-flex rounded-xl bg-et-accent px-5 py-3 text-sm font-semibold text-et-accent-ink transition hover:bg-et-accent/90 disabled:opacity-50"
          >
            {busy === "checkout" ? "Reindirizzamento…" : "Vai al pagamento"}
          </button>
          {showDevShortcut ? (
            <div className="mt-6 border-t border-et-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-et-ink/45">
                Solo sviluppo locale
              </p>
              <p className="mt-1 text-sm text-et-ink/55">
                Salta Stripe e avvia subito lo stub Inngest (utile per demo senza checkout).
              </p>
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy !== null}
                className="mt-3 rounded-xl border border-et-border px-4 py-2 text-sm text-et-ink/80 transition hover:border-et-accent/40 hover:text-et-accent"
              >
                {busy === "gen" ? "Invio…" : "Avvia generazione (dev)"}
              </button>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-et-ink/45">
                Serve un secondo terminale con il server Inngest locale (
                <code className="rounded bg-et-deep px-1 py-0.5 text-et-ink/70">
                  npm run inngest:dev
                </code>
                ) mentre gira <code className="rounded bg-et-deep px-1">npm run dev</code>
                . Senza di quello l&apos;evento parte ma il job non viene eseguito.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Generazione in corso */}
      {trip.isPaid && trip.days.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-et-accent/35 bg-et-accent/5 p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-pulse rounded-full bg-et-accent/40" aria-hidden />
          <h2 className="font-display mt-4 text-xl text-et-ink">
            Generazione in corso
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-et-ink/65">
            Inngest sta creando la versione attiva e i giorni. Se usi il dev server Inngest,
            assicurati che sia in esecuzione.
          </p>
          <button
            type="button"
            onClick={() => {
              void refreshTrip();
              router.refresh();
            }}
            className="mt-6 text-sm text-et-accent underline-offset-4 hover:underline"
          >
            Aggiorna ora
          </button>
        </section>
      ) : null}

      {/* Giorni */}
      {trip.days.length > 0 ? (
        <section>
          <h2 className="font-display text-xl text-et-ink">Itinerario</h2>
          <p className="mt-1 text-sm text-et-ink/55">
            Sblocco in base alla <strong>data di calendario del tuo PC</strong> (browser):
            conta solo giorno/mese/anno locali, non l’ora esatta — es. il 23 marzo 2026
            alle 21:49 il giorno con sblocco 24 marzo resta ancora bloccato fino al 24
            (sempre nel tuo fuso).
          </p>
          <ul className="mt-6 space-y-4">
            {trip.days.map((day) => {
              const open = isDayUnlocked(day.unlockDate);
              return (
                <li
                  key={day.id}
                  className={`rounded-2xl border p-5 transition ${
                    open
                      ? "border-et-border bg-et-card"
                      : "border-et-border/60 bg-et-deep/80 opacity-80"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-display text-lg text-et-ink">
                      {day.title ?? `Giorno ${day.dayNumber}`}
                    </div>
                    <div className="text-xs text-et-ink/50">
                      Sblocco: {day.unlockDate}
                      {!open ? (
                        <span className="ml-2 rounded-full border border-et-border px-2 py-0.5 text-et-accent/88">
                          Bloccato
                        </span>
                      ) : (
                        <span className="ml-2 rounded-full border border-et-accent/30 bg-et-accent/10 px-2 py-0.5 text-et-accent">
                          Aperto
                        </span>
                      )}
                    </div>
                  </div>
                  {open ? (
                    <div className="mt-4 space-y-2 text-sm text-et-ink/75">
                      {["morning", "afternoon", "evening"].map((slot) => {
                        const key = slot as "morning" | "afternoon" | "evening";
                        const text = snippetFromJson(day[key]);
                        if (!text) return null;
                        return (
                          <p key={key}>
                            <span className="font-semibold capitalize text-et-ink/90">
                              {key === "morning"
                                ? "Mattina"
                                : key === "afternoon"
                                  ? "Pomeriggio"
                                  : "Sera"}
                              :{" "}
                            </span>
                            {text}
                          </p>
                        );
                      })}
                      {!snippetFromJson(day.morning) &&
                      !snippetFromJson(day.afternoon) &&
                      !snippetFromJson(day.evening) ? (
                        <p className="text-et-ink/50">
                          Contenuto strutturato in arrivo (stub AI).
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-et-ink/45">
                      Torna in questa data per vedere il piano del giorno.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
