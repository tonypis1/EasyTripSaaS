"use client";

import type { TripDetailDto } from "@/server/services/trip/tripService";
import {
  formatStatus,
  formatTripType,
  isDayUnlocked,
} from "@/lib/day-unlock";
import { DEV_PREVIEW_UNLOCK_CONTENT } from "@/lib/dev-flags";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  initialTrip: TripDetailDto;
  checkoutFlash?: "success" | "cancel" | null;
  showDevShortcut: boolean;
};

type Slot = {
  title: string;
  place: string;
  why: string;
  startTime: string;
  endTime: string;
  tips: string[];
};

function googleSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Prima parte della destinazione (es. "Salerno" da "Salerno, Italia") per query e confronti.
 */
function destinationPrimary(destination: string): string {
  const s = destination.trim();
  if (!s) return "";
  const i = s.indexOf(",");
  return (i === -1 ? s : s.slice(0, i)).trim();
}

/**
 * Query di ricerca per il POI: usa la destinazione del viaggio e, se serve, `place`
 * (solo per l’URL, non come etichetta cliccabile) per disambiguare su Google.
 */
function buildGoogleSearchQuery(
  title: string,
  place: string,
  destination: string
): string {
  const t = title.trim();
  const p = place.trim();
  const d = destination.trim();
  const city = destinationPrimary(d) || d;
  if (!t && !p) return d || "";
  if (!city) return t || p;

  const tL = t.toLowerCase();
  const pL = p.toLowerCase();
  const cityL = city.toLowerCase();
  const fullDestL = d.toLowerCase();

  // Titolo già ancorato alla destinazione (es. "Duomo di Salerno" o contiene "Salerno")
  if (tL.includes(cityL) || (fullDestL.length > 0 && tL.includes(fullDestL))) {
    return t;
  }

  // `place` spesso ripete il POI con città completa — utile solo per precisione URL
  if (p && (pL.includes(cityL) || pL.includes(fullDestL)) && (pL.includes(tL) || tL.length <= 3)) {
    return p;
  }

  if (/^centro storico$/i.test(t)) return `centro storico di ${city}`;
  if (/^centro città$/i.test(t)) return `centro città di ${city}`;

  const titleHasOtherPlaceName =
    /\b(di|del|della|all’|all'|a|in|presso)\s+/i.test(t) && t.length > 18;

  if (titleHasOtherPlaceName) {
    return `${t} ${city}`;
  }

  if (
    /^(museo|chiesa|duomo|cattedrale|basilica|cappella|piazza|parco|castello|teatro|galleria|pinacoteca|palazzo|villa|fontana|mercato|borgo|anfiteatro|sito|lungomare|porto)\b/i.test(
      t
    )
  ) {
    return `${t} di ${city}`;
  }

  return `${t} ${city}`;
}

function parseSlot(raw: string | null): Slot | null {
  if (!raw || raw === "{}" || raw === "null") return null;
  try {
    const o = JSON.parse(raw) as Partial<Slot> | null;
    if (!o || typeof o !== "object") return null;
    if (
      typeof o.title !== "string" ||
      typeof o.place !== "string" ||
      typeof o.why !== "string" ||
      typeof o.startTime !== "string" ||
      typeof o.endTime !== "string" ||
      !Array.isArray(o.tips)
    )
      return null;
    return {
      title: o.title,
      place: o.place,
      why: o.why,
      startTime: o.startTime,
      endTime: o.endTime,
      tips: o.tips.filter((t) => typeof t === "string"),
    };
  } catch {
    return null;
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
            Sblocco in base alla <strong>data di calendario del tuo device (PC-tablet-mobile)</strong>:
            <br />
            il primo giorno si sblocca solo alle ore 00:01 del primo giorno. Il secondo giorno si sblocca
            solo alle ore 00:01 del secondo giorno… e così via.
          </p>
          {DEV_PREVIEW_UNLOCK_CONTENT ? (
            <p
              className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90"
              role="status"
            >
              <strong className="font-semibold">Anteprima sviluppo:</strong> vedi i contenuti anche se il
              giorno non è ancora sbloccato (flag{" "}
              <code className="rounded bg-black/25 px-1 py-0.5 font-mono text-[0.7rem]">
                NEXT_PUBLIC_DEV_PREVIEW_UNLOCKED=true
              </code>
              ). In produzione il comportamento resta quello dello sblocco reale.
            </p>
          ) : null}
          <ul className="mt-6 space-y-4">
            {trip.days.map((day) => {
              const reallyUnlocked = isDayUnlocked(day.unlockDate);
              const open = DEV_PREVIEW_UNLOCK_CONTENT || reallyUnlocked;
              const morning = parseSlot(day.morning);
              const afternoon = parseSlot(day.afternoon);
              const evening = parseSlot(day.evening);
              const hasAnySlot = Boolean(morning || afternoon || evening);
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
                      {!reallyUnlocked ? (
                        DEV_PREVIEW_UNLOCK_CONTENT ? (
                          <span className="ml-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-amber-100/90">
                            Anteprima dev
                          </span>
                        ) : (
                          <span className="ml-2 rounded-full border border-et-border px-2 py-0.5 text-et-accent/88">
                            Bloccato
                          </span>
                        )
                      ) : (
                        <span className="ml-2 rounded-full border border-et-accent/30 bg-et-accent/10 px-2 py-0.5 text-et-accent">
                          Aperto
                        </span>
                      )}
                    </div>
                  </div>
                  {open ? (
                    <div className="mt-4 space-y-2 text-sm text-et-ink/75">
                      {morning ? (
                        <div className="space-y-1">
                          <p>
                            <span className="font-semibold capitalize text-et-ink/90">
                              Mattina:{" "}
                            </span>
                            <a
                              href={googleSearchUrl(
                                buildGoogleSearchQuery(
                                  morning.title,
                                  morning.place,
                                  trip.destination
                                )
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="text-et-accent underline underline-offset-4 hover:decoration-et-accent/80"
                            >
                              {morning.title}
                            </a>{" "}
                            · {morning.place} · {morning.why} ·{" "}
                            <span className="text-et-ink/55">
                              {morning.startTime}-{morning.endTime}
                            </span>
                          </p>
                          {morning.tips.length > 0 ? (
                            <p className="text-xs text-et-ink/55">
                              {morning.tips.slice(0, 3).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {afternoon ? (
                        <div className="space-y-1">
                          <p>
                            <span className="font-semibold capitalize text-et-ink/90">
                              Pomeriggio:{" "}
                            </span>
                            <a
                              href={googleSearchUrl(
                                buildGoogleSearchQuery(
                                  afternoon.title,
                                  afternoon.place,
                                  trip.destination
                                )
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="text-et-accent underline underline-offset-4 hover:decoration-et-accent/80"
                            >
                              {afternoon.title}
                            </a>{" "}
                            · {afternoon.place} · {afternoon.why} ·{" "}
                            <span className="text-et-ink/55">
                              {afternoon.startTime}-{afternoon.endTime}
                            </span>
                          </p>
                          {afternoon.tips.length > 0 ? (
                            <p className="text-xs text-et-ink/55">
                              {afternoon.tips.slice(0, 3).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {evening ? (
                        <div className="space-y-1">
                          <p>
                            <span className="font-semibold capitalize text-et-ink/90">
                              Sera:{" "}
                            </span>
                            <a
                              href={googleSearchUrl(
                                buildGoogleSearchQuery(
                                  evening.title,
                                  evening.place,
                                  trip.destination
                                )
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="text-et-accent underline underline-offset-4 hover:decoration-et-accent/80"
                            >
                              {evening.title}
                            </a>{" "}
                            · {evening.place} · {evening.why} ·{" "}
                            <span className="text-et-ink/55">
                              {evening.startTime}-{evening.endTime}
                            </span>
                          </p>
                          {evening.tips.length > 0 ? (
                            <p className="text-xs text-et-ink/55">
                              {evening.tips.slice(0, 3).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {!hasAnySlot ? (
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
