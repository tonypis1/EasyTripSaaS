"use client";

import type { TripDetailDto } from "@/server/services/trip/tripService";
import {
  formatStatus,
  formatTripType,
  isDayUnlocked,
  daysUntilUnlock,
  tripPhase,
} from "@/lib/day-unlock";
import { DEV_PREVIEW_UNLOCK_CONTENT } from "@/lib/dev-flags";
import { PostTripScreen } from "./post-trip-screen";
import { formatGeoScoreLabel } from "@/lib/geo-score-ui";
import dynamic from "next/dynamic";
import posthog from "posthog-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const DayRouteMap = dynamic(() => import("./day-route-map"), { ssr: false });
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Compass,
  Gem,
  Info,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Replace,
  Route,
  ShieldAlert,
  Star,
  Sunrise,
  Sun,
  Moon,
  UtensilsCrossed,
  Lightbulb,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  Settings,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

type Props = {
  initialTrip: TripDetailDto;
  checkoutFlash?: "success" | "cancel" | null;
  regenFlash?: "success" | "cancel" | null;
  reactivateFlash?: "success" | "cancel" | null;
  showDevShortcut: boolean;
};

type Slot = {
  title: string;
  place: string;
  why: string;
  startTime: string;
  endTime: string;
  durationMin: number | null;
  googleMapsQuery: string | null;
  bookingLink: string | null;
  tips: string[];
  lat: number | null;
  lng: number | null;
};

type SlotReplaceResult = {
  whyNotOriginal: string;
  geoContinuityNote: string;
  dayRouteUpdated: string;
  alternatives: { name: string; distance: string; note: string }[];
};

/* ---------- helpers ---------- */

const BUDGET_LABELS: Record<string, { label: string; color: string }> = {
  economy: { label: "Economico", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  moderate: { label: "Standard", color: "text-sky-400 border-sky-400/30 bg-sky-400/10" },
  premium: { label: "Premium", color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
};

function googleSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function destinationPrimary(destination: string): string {
  const s = destination.trim();
  if (!s) return "";
  const i = s.indexOf(",");
  return (i === -1 ? s : s.slice(0, i)).trim();
}

function buildGoogleSearchQuery(
  title: string,
  place: string,
  destination: string,
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

  if (tL.includes(cityL) || (fullDestL.length > 0 && tL.includes(fullDestL)))
    return t;
  if (
    p &&
    (pL.includes(cityL) || pL.includes(fullDestL)) &&
    (pL.includes(tL) || tL.length <= 3)
  )
    return p;
  if (/^centro storico$/i.test(t)) return `centro storico di ${city}`;
  if (/^centro città$/i.test(t)) return `centro città di ${city}`;

  const titleHasOtherPlaceName =
    /\b(di|del|della|all'|all'|a|in|presso)\s+/i.test(t) && t.length > 18;
  if (titleHasOtherPlaceName) return `${t} ${city}`;

  if (
    /^(museo|chiesa|duomo|cattedrale|basilica|cappella|piazza|parco|castello|teatro|galleria|pinacoteca|palazzo|villa|fontana|mercato|borgo|anfiteatro|sito|lungomare|porto)\b/i.test(
      t,
    )
  )
    return `${t} di ${city}`;

  return `${t} ${city}`;
}

function parseSlot(raw: string | null): Slot | null {
  if (!raw || raw === "{}" || raw === "null") return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null;
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
      durationMin:
        typeof o.durationMin === "number" && Number.isFinite(o.durationMin)
          ? o.durationMin
          : null,
      googleMapsQuery:
        typeof o.googleMapsQuery === "string" && o.googleMapsQuery.length > 0
          ? o.googleMapsQuery
          : null,
      bookingLink:
        typeof o.bookingLink === "string" && o.bookingLink.length > 0
          ? o.bookingLink
          : null,
      tips: (o.tips as unknown[]).filter((t): t is string => typeof t === "string"),
      lat: typeof o.lat === "number" && Number.isFinite(o.lat) ? o.lat : null,
      lng: typeof o.lng === "number" && Number.isFinite(o.lng) ? o.lng : null,
    };
  } catch {
    return null;
  }
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function googleMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const slotLabel = {
  morning: "Mattina",
  afternoon: "Pomeriggio",
  evening: "Sera",
} as const;

const SlotIcon = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
} as const;

/* ---------- component ---------- */

export function TripDetailClient({
  initialTrip,
  checkoutFlash,
  regenFlash,
  reactivateFlash,
  showDevShortcut,
}: Props) {
  const router = useRouter();
  const [trip, setTrip] = useState(initialTrip);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set());
  const [prefOpen, setPrefOpen] = useState(false);
  const [prefStyle, setPrefStyle] = useState(initialTrip.style ?? "");
  const [prefBudget, setPrefBudget] = useState(initialTrip.budgetLevel);
  const [replaceResult, setReplaceResult] = useState<{
    key: string;
    data: SlotReplaceResult;
  } | null>(null);

  useEffect(() => setTrip(initialTrip), [initialTrip]);

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

  function apiMsg(json: { error?: { message?: string } | string }) {
    if (typeof json.error === "string") return json.error;
    return json.error?.message ?? "Operazione non riuscita";
  }

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

      const d = json.data as {
        fullyPaidByCredit?: boolean;
        checkoutUrl?: string;
        creditAppliedCents?: number;
      };

      if (d.fullyPaidByCredit) {
        posthog.capture("checkout_credit_full", {
          tripId: trip.id,
          destination: trip.destination,
          creditAppliedCents: d.creditAppliedCents,
        });
        router.push(`/app/trips/${trip.id}?checkout=success`);
        router.refresh();
        return;
      }

      posthog.capture("checkout_started", {
        tripId: trip.id,
        destination: trip.destination,
        tripType: trip.tripType,
        creditAppliedCents: d.creditAppliedCents ?? 0,
      });
      window.location.href = d.checkoutUrl as string;
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
      if (!res.ok || !json.ok) {
        setMsg(apiMsg(json));
        return;
      }
      posthog.capture("itinerary_generated", {
        tripId: trip.id,
        destination: trip.destination,
        nextVersion: trip.regen.nextVersion,
      });
      setMsg("Generazione avviata. Attendi qualche secondo…");
      await refreshTrip();
      router.refresh();
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  async function onRegenCheckout() {
    setBusy("regen-pay");
    setMsg(null);
    try {
      const res = await fetch("/api/billing/regen-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(apiMsg(json));
        return;
      }
      posthog.capture("regen_checkout_started", {
        tripId: trip.id,
        destination: trip.destination,
        nextVersion: trip.regen.nextVersion,
      });
      window.location.href = json.data.checkoutUrl as string;
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  async function onSetActiveVersion(versionNum: number) {
    setBusy("version");
    setMsg(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/active-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionNum }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(apiMsg(json));
        return;
      }
      await refreshTrip();
      router.refresh();
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  function requestGeo() {
    if (!navigator.geolocation) {
      setMsg("Geolocalizzazione non supportata dal browser.");
      return;
    }
    setBusy("geo");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude);
        setGeoLng(pos.coords.longitude);
        setBusy(null);
        setMsg("Posizione acquisita.");
      },
      () => {
        setBusy(null);
        setMsg("Impossibile leggere la posizione. Controlla i permessi.");
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  async function onReplaceSlot(
    dayId: string,
    slot: "morning" | "afternoon" | "evening",
  ) {
    setBusy(`replace-${dayId}-${slot}`);
    setMsg(null);
    setReplaceResult(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/replace-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayId, slot, lat: geoLat, lng: geoLng }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(apiMsg(json));
        return;
      }
      posthog.capture("slot_replaced", {
        tripId: trip.id,
        destination: trip.destination,
        dayId,
        slot,
        hadGps: geoLat != null && geoLng != null,
      });
      const d = json.data as Record<string, unknown> | undefined;
      if (
        d &&
        typeof d.whyNotOriginal === "string" &&
        typeof d.geoContinuityNote === "string" &&
        typeof d.dayRouteUpdated === "string" &&
        Array.isArray(d.alternatives)
      ) {
        setReplaceResult({
          key: `${dayId}-${slot}`,
          data: {
            whyNotOriginal: d.whyNotOriginal,
            geoContinuityNote: d.geoContinuityNote,
            dayRouteUpdated: d.dayRouteUpdated,
            alternatives: d.alternatives as SlotReplaceResult["alternatives"],
          },
        });
      }
      await refreshTrip();
      router.refresh();
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  async function onSavePreferences() {
    setBusy("pref");
    setMsg(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: prefStyle.trim().length >= 2 ? prefStyle.trim() : null,
          budgetLevel: prefBudget,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(apiMsg(json));
        return;
      }
      posthog.capture("preferences_updated", {
        tripId: trip.id,
        destination: trip.destination,
        budgetLevel: prefBudget,
        style: prefStyle.trim() || null,
      });
      setPrefOpen(false);
      setMsg("Preferenze aggiornate. Puoi rigenerare l'itinerario gratuitamente.");
      await refreshTrip();
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(null);
    }
  }

  function toggleTips(key: string) {
    setExpandedTips((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  /* ========== RENDER ========== */

  if (trip.isAccessExpired && reactivateFlash !== "success") {
    return <PostTripScreen trip={trip} />;
  }

  const hasDays = trip.days.length > 0;
  const showControls = (trip.isPaid || showDevShortcut) && hasDays;
  const phase = tripPhase(trip.startDate, trip.endDate);

  return (
    <div className="et-protected mx-auto max-w-3xl space-y-8 pb-16">
      {/* ── Header ── */}
      <header className="border-l-2 border-et-accent/40 pl-6">
        <Link
          href="/app/trips"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-et-ink/50 transition-colors duration-200 hover:text-et-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tutti i viaggi
        </Link>

        <h1 className="font-display mt-2 text-3xl font-normal tracking-tight text-et-ink sm:text-4xl">
          {trip.destination}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-et-ink/65">
          <span>
            {trip.startDate} → {trip.endDate}
          </span>
          <span className="text-et-ink/30">|</span>
          <span>{formatTripType(trip.tripType)}</span>
          {trip.style ? (
            <>
              <span className="text-et-ink/30">|</span>
              <span>{trip.style}</span>
            </>
          ) : null}
          {trip.budgetLevel ? (() => {
            const bl = BUDGET_LABELS[trip.budgetLevel] ?? BUDGET_LABELS.moderate;
            return (
              <>
                <span className="text-et-ink/30">|</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${bl.color}`}>
                  <Wallet className="h-3 w-3" />
                  {bl.label}
                </span>
              </>
            );
          })() : null}
        </div>

        <div className="mt-1.5 flex items-center gap-3 text-xs text-et-ink/50">
          <span>
            Stato:{" "}
            <span className="text-et-accent/90">
              {formatStatus(trip.status)}
            </span>
          </span>
          <span>{trip.isPaid ? "Pagato" : "Da pagare"}</span>
        </div>

        {/* Geo-score nell'header quando disponibile */}
        {trip.activeGeoScore != null ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-et-accent/25 bg-et-accent/8 px-3.5 py-1.5">
            <Star className="h-4 w-4 text-et-accent" />
            <span className="text-sm font-medium text-et-accent">
              {formatGeoScoreLabel(trip.activeGeoScore)}
            </span>
          </div>
        ) : null}
      </header>

      {/* ── Countdown banner ── */}
      {hasDays ? (
        phase.phase === "pre" ? (
          <div className="flex items-center gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/8 px-5 py-3.5">
            <Calendar className="h-5 w-5 shrink-0 text-sky-400" />
            <div>
              <p className="text-sm font-medium text-sky-300">
                Il viaggio inizia tra{" "}
                <span className="font-bold text-sky-200">
                  {phase.daysUntil} {phase.daysUntil === 1 ? "giorno" : "giorni"}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-sky-400/70">
                I contenuti si sbloccano giorno per giorno a partire dalla data di partenza.
              </p>
            </div>
          </div>
        ) : phase.phase === "ongoing" ? (
          <div className="flex items-center gap-3 rounded-2xl border border-et-accent/25 bg-et-accent/8 px-5 py-3.5">
            <Sparkles className="h-5 w-5 shrink-0 text-et-accent" />
            <div>
              <p className="text-sm font-medium text-et-accent">
                Il viaggio è in corso —{" "}
                <span className="font-bold">
                  Giorno {phase.currentDay} di {phase.totalDays}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-et-accent/70">
                Buon viaggio! I giorni futuri si sbloccheranno automaticamente.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/8 px-5 py-3.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-300">
              Viaggio completato — tutti i contenuti sono disponibili.
            </p>
          </div>
        )
      ) : null}

      {/* ── Flash messages ── */}
      {checkoutFlash === "success" ? (
        <Flash variant="success">
          Pagamento ricevuto. La generazione parte in background.
        </Flash>
      ) : null}
      {checkoutFlash === "cancel" ? (
        <Flash variant="neutral">
          Checkout annullato. Puoi riprovare quando vuoi.
        </Flash>
      ) : null}
      {regenFlash === "success" ? (
        <Flash variant="success">
          Pagamento rigenerazione ricevuto. La nuova versione sarà creata in
          background.
        </Flash>
      ) : null}
      {regenFlash === "cancel" ? (
        <Flash variant="neutral">
          Pagamento rigenerazione annullato.
        </Flash>
      ) : null}
      {reactivateFlash === "success" ? (
        <Flash variant="success">
          Accesso riattivato! Puoi rileggere il tuo itinerario per i prossimi 30
          giorni.
        </Flash>
      ) : null}
      {reactivateFlash === "cancel" ? (
        <Flash variant="neutral">
          Riattivazione annullata. Puoi riprovare dalla schermata post-viaggio.
        </Flash>
      ) : null}
      {msg ? <Flash variant="neutral">{msg}</Flash> : null}

      {/* ── Controlli: Carosello + Rigenera + GPS ── */}
      {showControls ? (
        <section className="space-y-5 rounded-2xl border border-et-border bg-et-card p-5 sm:p-6">
          {/* Carosello versioni — pills orizzontali */}
          {trip.versions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-et-ink/45">
                Versioni generate
              </p>
              <div className="flex flex-wrap gap-2">
                {trip.versions.map((v) => {
                  const active = v.isActive;
                  return (
                    <button
                      key={v.versionNum}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (!active) void onSetActiveVersion(v.versionNum);
                      }}
                      className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 disabled:opacity-50 ${
                        active
                          ? "border-2 border-et-accent bg-et-accent/15 text-et-accent"
                          : "border border-et-border bg-et-deep text-et-ink/70 hover:border-et-accent/40 hover:text-et-ink"
                      }`}
                    >
                      v{v.versionNum}
                      {v.geoScore != null ? (
                        <span className="ml-1 text-xs opacity-70">
                          {v.geoScore.toFixed(1)}
                        </span>
                      ) : null}
                      {active ? (
                        <span className="ml-1 h-2 w-2 rounded-full bg-et-accent" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Rigenera + GPS — divisi in due righe */}
          <div className="flex flex-wrap items-center gap-3 border-t border-et-border pt-4">
            {trip.regen.atMax ? (
              <p className="text-sm text-et-ink/60">
                Hai raggiunto 7 versioni. Usa le pill qui sopra per navigare
                tra le versioni salvate.
              </p>
            ) : (
              <>
                {trip.regen.canStartGeneration ? (
                  <button
                    type="button"
                    onClick={() => void onGenerate()}
                    disabled={busy !== null}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-et-accent px-5 py-2.5 text-sm font-semibold text-et-accent-ink transition-colors duration-200 hover:bg-et-accent/90 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${busy === "gen" ? "animate-spin" : ""}`}
                    />
                    {busy === "gen"
                      ? "Generazione in corso…"
                      : "Rigenera itinerario"}
                  </button>
                ) : null}
                {trip.regen.needsPaidCheckout ? (
                  <button
                    type="button"
                    onClick={() => void onRegenCheckout()}
                    disabled={busy !== null}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-et-accent/50 bg-et-accent/10 px-5 py-2.5 text-sm font-semibold text-et-accent transition-colors duration-200 hover:bg-et-accent/20 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    {busy === "regen-pay"
                      ? "Reindirizzamento…"
                      : "Rigenera (€1,99)"}
                  </button>
                ) : null}
                <span className="text-xs text-et-ink/45">
                  Prossima: v{trip.regen.nextVersion}/7
                  {trip.regen.freeRegenFromPrefChange
                    ? " — gratuita (preferenze modificate)"
                    : trip.regen.needsPaidCheckout
                      ? " — a pagamento"
                      : " — gratuita"}
                </span>
              </>
            )}
          </div>

          {/* GPS */}
          <div className="flex flex-wrap items-center gap-3 border-t border-et-border pt-4">
            <button
              type="button"
              onClick={requestGeo}
              disabled={busy !== null}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-et-border px-4 py-2 text-sm text-et-ink/80 transition-colors duration-200 hover:border-et-accent/40 hover:text-et-accent disabled:opacity-50"
            >
              <Navigation className="h-4 w-4" />
              {busy === "geo" ? "Acquisizione…" : "Usa GPS"}
            </button>
            {geoLat != null && geoLng != null ? (
              <span className="flex items-center gap-1 text-xs text-et-accent/80">
                <MapPin className="h-3 w-3" />
                {geoLat.toFixed(4)}, {geoLng.toFixed(4)}
              </span>
            ) : (
              <span className="text-xs text-et-ink/40">
                Migliora &laquo;Cambia slot&raquo; con la tua posizione
              </span>
            )}
          </div>

          {/* Modifica preferenze */}
          <div className="border-t border-et-border pt-4">
            <button
              type="button"
              onClick={() => setPrefOpen((p) => !p)}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-et-border px-4 py-2 text-sm text-et-ink/70 transition-colors duration-200 hover:border-et-accent/40 hover:text-et-accent"
            >
              <Settings className="h-4 w-4" />
              {prefOpen ? "Chiudi preferenze" : "Modifica preferenze"}
              {trip.prefChangedAfterGen && trip.regen.freeRegenFromPrefChange ? (
                <span className="ml-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                  1 regen gratis
                </span>
              ) : null}
            </button>

            {prefOpen ? (
              <div className="mt-3 space-y-4 rounded-xl border border-et-border/60 bg-et-deep/60 p-4">
                <div>
                  <label
                    htmlFor="pref-style"
                    className="block text-xs font-semibold uppercase tracking-wider text-et-accent/88"
                  >
                    Stile (opz.)
                  </label>
                  <input
                    id="pref-style"
                    value={prefStyle}
                    onChange={(e) => setPrefStyle(e.target.value)}
                    maxLength={120}
                    placeholder="foodie, cultura…"
                    className="mt-1.5 w-full rounded-xl border border-et-border bg-et-deep px-3 py-2.5 text-sm text-et-ink placeholder:text-et-ink/40 outline-none focus:border-et-accent/50"
                  />
                </div>

                <fieldset>
                  <legend className="block text-xs font-semibold uppercase tracking-wider text-et-accent/88">
                    Budget
                  </legend>
                  <div className="mt-1.5 flex gap-2">
                    {(["economy", "moderate", "premium"] as const).map((lv) => {
                      const active = prefBudget === lv;
                      const lbl = BUDGET_LABELS[lv] ?? BUDGET_LABELS.moderate;
                      return (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => setPrefBudget(lv)}
                          className={[
                            "min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer",
                            "focus:outline-none focus:ring-2 focus:ring-et-accent/50 focus:ring-offset-1 focus:ring-offset-et-deep",
                            active
                              ? "border-et-accent bg-et-accent/15 text-et-accent"
                              : "border-et-border bg-et-deep text-et-ink/60 hover:border-et-accent/30 hover:text-et-ink/80",
                          ].join(" ")}
                        >
                          {lbl.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void onSavePreferences()}
                    disabled={busy !== null}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-et-accent px-5 py-2.5 text-sm font-semibold text-et-accent-ink transition-colors duration-200 hover:bg-et-accent/90 disabled:opacity-50"
                  >
                    {busy === "pref" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {busy === "pref" ? "Salvataggio…" : "Salva preferenze"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrefOpen(false)}
                    className="min-h-[44px] cursor-pointer rounded-xl border border-et-border px-4 py-2 text-sm text-et-ink/60 transition-colors duration-200 hover:text-et-ink"
                  >
                    Annulla
                  </button>
                </div>

                {!trip.prefChangedAfterGen ? (
                  <p className="text-xs text-et-ink/45">
                    Se modifichi le preferenze dopo la generazione, riceverai 1 rigenerazione gratuita per adattare l&apos;itinerario.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── Pagamento ── */}
      {!trip.isPaid ? (() => {
        const priceCents = trip.tripPriceCents;
        const creditCents = trip.userCreditBalanceCents;
        const discountCents = Math.min(creditCents, priceCents);
        const finalCents = priceCents - discountCents;
        const fullyByCredit = finalCents <= 0;
        const hasCredit = creditCents > 0;
        const fmt = (c: number) => `€${(c / 100).toFixed(2)}`;

        return (
          <section className="rounded-2xl border border-et-border bg-et-card p-6">
            <h2 className="font-display text-lg text-et-ink">
              Sblocca la generazione
            </h2>
            <p className="mt-2 max-w-xl text-sm text-et-ink/65">
              {fullyByCredit
                ? "Hai abbastanza crediti per attivare questo viaggio gratuitamente!"
                : "Completa il pagamento per avviare la creazione del tuo itinerario personalizzato."}
            </p>

            {hasCredit ? (
              <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/8 p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">
                    Hai {fmt(creditCents)} di crediti EasyTrip
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-et-ink/60">
                  <div className="flex justify-between">
                    <span>Prezzo viaggio</span>
                    <span className={discountCents > 0 ? "line-through text-et-ink/35" : ""}>
                      {fmt(priceCents)}
                    </span>
                  </div>
                  {discountCents > 0 ? (
                    <div className="flex justify-between text-emerald-400">
                      <span>Sconto crediti</span>
                      <span>−{fmt(discountCents)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-et-border/40 pt-1 text-sm font-semibold text-et-ink">
                    <span>Totale</span>
                    <span className={fullyByCredit ? "text-emerald-400" : ""}>
                      {fullyByCredit ? "Gratis" : fmt(finalCents)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onCheckout}
              disabled={busy !== null}
              className={[
                "mt-4 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors duration-200 disabled:opacity-50",
                fullyByCredit
                  ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  : "bg-et-accent text-et-accent-ink hover:bg-et-accent/90",
              ].join(" ")}
            >
              {fullyByCredit ? (
                <>
                  <Wallet className="h-4 w-4" />
                  {busy === "checkout" ? "Attivazione…" : "Usa i tuoi crediti — Gratis"}
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  {busy === "checkout"
                    ? "Reindirizzamento…"
                    : hasCredit
                      ? `Vai al pagamento — ${fmt(finalCents)}`
                      : "Vai al pagamento"}
                </>
              )}
            </button>

            {showDevShortcut ? (
              <div className="mt-6 border-t border-et-border pt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-et-ink/45">
                  Solo sviluppo locale
                </p>
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={busy !== null}
                  className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-et-border px-4 py-2 text-sm text-et-ink/80 transition-colors duration-200 hover:border-et-accent/40 hover:text-et-accent disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {busy === "gen" ? "Invio…" : "Avvia generazione (dev)"}
                </button>
                <p className="mt-3 max-w-md text-xs leading-relaxed text-et-ink/45">
                  Serve{" "}
                  <code className="rounded bg-et-deep px-1 py-0.5 text-et-ink/70">
                    npm run inngest:dev
                  </code>{" "}
                  in un secondo terminale.
                </p>
              </div>
            ) : null}
          </section>
        );
      })() : null}

      {/* ── Generazione in corso ── */}
      {trip.isPaid && !hasDays ? (
        <section className="rounded-2xl border border-dashed border-et-accent/35 bg-et-accent/5 p-8 text-center">
          <Loader2
            className="mx-auto h-8 w-8 animate-spin text-et-accent/60"
            aria-hidden
          />
          <h2 className="font-display mt-4 text-xl text-et-ink">
            Generazione in corso
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-et-ink/65">
            L&apos;AI sta creando il tuo itinerario. Questa pagina si aggiorna
            automaticamente.
          </p>
          <button
            type="button"
            onClick={() => {
              void refreshTrip();
              router.refresh();
            }}
            className="mt-6 cursor-pointer text-sm text-et-accent underline-offset-4 transition-colors duration-200 hover:underline"
          >
            Aggiorna ora
          </button>
        </section>
      ) : null}

      {/* ── Itinerario — Giorni ── */}
      {hasDays ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl text-et-ink">Itinerario</h2>
          <p className="text-sm text-et-ink/55">
            I contenuti si sbloccano giorno per giorno alla data del viaggio.
          </p>
          {DEV_PREVIEW_UNLOCK_CONTENT ? (
            <p
              className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90"
              role="status"
            >
              <strong className="font-semibold">Anteprima sviluppo</strong> —
              contenuti visibili anche prima dello sblocco.
            </p>
          ) : null}

          <ul className="mt-4 space-y-5">
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
                  className={`overflow-hidden rounded-2xl border transition-colors duration-200 ${
                    open
                      ? "border-et-border bg-et-card"
                      : "border-et-border/60 bg-et-deep/80 opacity-75"
                  }`}
                >
                  {/* Day header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-lg text-et-ink">
                        {day.title ?? `Giorno ${day.dayNumber}`}
                      </h3>
                      {day.zoneFocus ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-et-border bg-et-deep px-2.5 py-0.5 text-xs text-et-ink/60">
                          <Compass className="h-3 w-3" />
                          {day.zoneFocus}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-et-ink/50">
                      <span>{day.unlockDate}</span>
                      {!reallyUnlocked ? (
                        DEV_PREVIEW_UNLOCK_CONTENT ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-amber-100/90">
                            Anteprima
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-et-ink/15 bg-et-deep px-2 py-0.5 text-et-ink/45">
                            <Lock className="h-2.5 w-2.5" />
                            Bloccato
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-et-accent/30 bg-et-accent/10 px-2 py-0.5 text-et-accent">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Sbloccato
                        </span>
                      )}
                    </div>
                  </div>

                  {open ? (
                    <div className="space-y-4 px-5 pb-5">
                      {/* Day-of-week warning */}
                      {day.dowWarning ? (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/8 px-3.5 py-2.5">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/90" />
                          <p className="text-xs leading-relaxed text-amber-200/90">
                            {day.dowWarning}
                          </p>
                        </div>
                      ) : null}

                      {/* Local gem */}
                      {day.localGem ? (
                        <div className="flex items-start gap-2 rounded-xl border border-et-accent/20 bg-et-accent/5 px-3.5 py-2.5">
                          <Gem className="mt-0.5 h-4 w-4 shrink-0 text-et-accent/80" />
                          <p className="text-xs leading-relaxed text-et-accent/90">
                            <span className="font-semibold">
                              Consiglio da locale:
                            </span>{" "}
                            {day.localGem}
                          </p>
                        </div>
                      ) : null}

                      {/* Slots (morning / afternoon / evening) */}
                      {(
                        [
                          ["morning", morning],
                          ["afternoon", afternoon],
                          ["evening", evening],
                        ] as const
                      ).map(([key, slot]) => {
                        if (!slot) return null;
                        const Icon = SlotIcon[key];
                        const tipsKey = `${day.id}-${key}`;
                        const tipsOpen = expandedTips.has(tipsKey);
                        const isReplacing =
                          busy === `replace-${day.id}-${key}`;

                        return (
                          <div
                            key={key}
                            className="rounded-xl border border-et-border/70 bg-et-deep/40 p-4 transition-colors duration-200"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-et-accent/10">
                                  <Icon className="h-4.5 w-4.5 text-et-accent/80" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-et-ink/50">
                                      {slotLabel[key]}
                                    </span>
                                    <span className="text-xs text-et-ink/40">
                                      {slot.startTime} – {slot.endTime}
                                    </span>
                                    {slot.durationMin ? (
                                      <span className="rounded-full border border-et-accent/20 bg-et-accent/8 px-2 py-0.5 text-[10px] font-medium text-et-accent/80">
                                        {formatDuration(slot.durationMin)}
                                      </span>
                                    ) : null}
                                  </div>
                                  <a
                                    href={
                                      slot.googleMapsQuery
                                        ? googleMapsUrl(slot.googleMapsQuery)
                                        : googleSearchUrl(
                                            buildGoogleSearchQuery(
                                              slot.title,
                                              slot.place,
                                              trip.destination,
                                            ),
                                          )
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-et-accent underline-offset-4 transition-colors duration-200 hover:underline"
                                  >
                                    {slot.title}
                                    <MapPin className="h-3 w-3 opacity-50" />
                                  </a>
                                  <p className="mt-0.5 text-xs text-et-ink/55">
                                    {slot.place}
                                  </p>
                                  <p className="mt-1 text-sm leading-relaxed text-et-ink/70">
                                    {slot.why}
                                  </p>
                                  {slot.bookingLink ? (
                                    <a
                                      href={slot.bookingLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-500/8 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors duration-200 hover:border-amber-400/40 hover:bg-amber-500/15"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Prenota / Biglietti
                                    </a>
                                  ) : null}
                                </div>
                              </div>

                              {/* Cambia slot */}
                              <button
                                type="button"
                                onClick={() =>
                                  void onReplaceSlot(day.id, key)
                                }
                                disabled={busy !== null}
                                aria-label={`Cambia ${slotLabel[key]}`}
                                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-et-border text-et-ink/50 transition-colors duration-200 hover:border-et-accent/40 hover:text-et-accent disabled:opacity-40"
                              >
                                {isReplacing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Replace className="h-4 w-4" />
                                )}
                              </button>
                            </div>

                            {/* Tips collapsible */}
                            {slot.tips.length > 0 ? (
                              <div className="mt-2 border-t border-et-border/50 pt-2">
                                <button
                                  type="button"
                                  onClick={() => toggleTips(tipsKey)}
                                  className="inline-flex cursor-pointer items-center gap-1 text-xs text-et-ink/45 transition-colors duration-200 hover:text-et-ink/70"
                                >
                                  <Lightbulb className="h-3 w-3" />
                                  {slot.tips.length} consigli
                                  {tipsOpen ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </button>
                                {tipsOpen ? (
                                  <ul className="mt-1.5 space-y-0.5 text-xs text-et-ink/55">
                                    {slot.tips.map((tip, ti) => (
                                      <li key={ti} className="pl-4">
                                        {tip}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ) : null}

                            {/* Enriched replacement result panel */}
                            {replaceResult?.key ===
                              `${day.id}-${key}` ? (
                              <div className="mt-3 space-y-3 rounded-xl border-2 border-purple-400/30 bg-gradient-to-br from-purple-500/8 to-et-accent/5 p-4">
                                <div className="flex items-center justify-between">
                                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-300">
                                    <Replace className="h-3.5 w-3.5" />
                                    Sostituzione completata
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setReplaceResult(null)}
                                    aria-label="Chiudi dettagli sostituzione"
                                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-et-ink/40 transition-colors hover:bg-et-deep hover:text-et-ink/70"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <div className="rounded-lg border border-purple-400/20 bg-purple-500/8 px-3 py-2.5">
                                  <p className="flex items-start gap-2 text-xs leading-relaxed text-purple-100/90">
                                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-300" />
                                    <span>
                                      <strong className="font-semibold">
                                        Perch\u00e9 il cambio:
                                      </strong>{" "}
                                      {replaceResult.data.whyNotOriginal}
                                    </span>
                                  </p>
                                </div>

                                <div className="rounded-lg border border-et-accent/20 bg-et-accent/8 px-3 py-2.5">
                                  <p className="flex items-start gap-2 text-xs leading-relaxed text-et-accent/90">
                                    <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-et-accent" />
                                    <span>
                                      <strong className="font-semibold">
                                        Integrazione percorso:
                                      </strong>{" "}
                                      {replaceResult.data.geoContinuityNote}
                                    </span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 rounded-lg border border-et-border/60 bg-et-deep/60 px-3 py-2.5">
                                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-et-ink/45" />
                                  <p className="text-xs text-et-ink/65">
                                    <strong className="font-semibold text-et-ink/80">
                                      Percorso aggiornato:
                                    </strong>{" "}
                                    {replaceResult.data.dayRouteUpdated}
                                  </p>
                                </div>

                                {replaceResult.data.alternatives
                                  .length > 0 ? (
                                  <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-et-ink/45">
                                      Alternative (se il posto è pieno)
                                    </p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {replaceResult.data.alternatives.map(
                                        (alt, ai) => (
                                          <div
                                            key={ai}
                                            className="rounded-lg border border-et-border/60 bg-et-card/40 p-3"
                                          >
                                            <p className="text-sm font-semibold text-et-ink/85">
                                              {alt.name}
                                            </p>
                                            <p className="mt-0.5 flex items-center gap-1 text-xs text-et-ink/50">
                                              <MapPin className="h-3 w-3" />
                                              {alt.distance}
                                            </p>
                                            <p className="mt-1.5 text-xs leading-relaxed text-amber-200/85">
                                              {alt.note}
                                            </p>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {!hasAnySlot ? (
                        <p className="text-sm text-et-ink/50">
                          Contenuto in arrivo…
                        </p>
                      ) : null}

                      {/* Day tips */}
                      {day.dayTips ? (
                        <div className="flex items-start gap-2 text-sm text-et-ink/60">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-et-ink/40" />
                          <p className="leading-relaxed">{day.dayTips}</p>
                        </div>
                      ) : null}

                      {/* Restaurants */}
                      {day.restaurants && day.restaurants.length > 0 ? (
                        <div className="rounded-xl border border-et-border/70 bg-et-deep/40 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-et-ink/50">
                              <UtensilsCrossed className="h-3.5 w-3.5" />
                              Dove mangiare
                            </p>
                            <p className="text-xs text-et-ink/40">
                              Pranzo e cena separati
                            </p>
                          </div>

                          {(() => {
                            const lunch = day.restaurants.filter(
                              (r) => r.meal === "pranzo",
                            );
                            const dinner = day.restaurants.filter(
                              (r) => r.meal === "cena",
                            );

                            const Section = ({
                              title,
                              items,
                            }: {
                              title: string;
                              items: typeof day.restaurants;
                            }) => (
                              <div className="mt-4">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-et-ink/45">
                                    {title}
                                  </p>
                                  <span className="text-xs text-et-ink/35">
                                    {items.length} opzion{items.length === 1 ? "e" : "i"}
                                  </span>
                                </div>
                                <ul className="mt-2.5 space-y-2.5">
                                  {items.map((r, i) => (
                                    <li
                                      key={`${r.name}-${i}`}
                                      className="rounded-xl border border-et-border/60 bg-et-card/40 p-3"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <a
                                            href={googleSearchUrl(
                                              buildGoogleSearchQuery(
                                                r.name,
                                                r.distance || r.cuisine,
                                                trip.destination,
                                              ),
                                            )}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-sm font-semibold text-et-ink/90 underline-offset-4 transition-colors duration-200 hover:text-et-accent hover:underline"
                                          >
                                            {r.name}
                                            <ExternalLink className="h-3 w-3 opacity-50" />
                                          </a>
                                          <p className="mt-0.5 text-xs text-et-ink/55">
                                            {r.cuisine}
                                          </p>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                          {r.budgetHint ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-et-border bg-et-deep px-2 py-0.5 text-xs text-et-ink/60">
                                              <Wallet className="h-3 w-3" />
                                              {r.budgetHint}
                                            </span>
                                          ) : null}
                                          {r.distance ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-et-border bg-et-deep px-2 py-0.5 text-xs text-et-ink/60">
                                              <MapPin className="h-3 w-3" />
                                              {r.distance}
                                            </span>
                                          ) : null}
                                          {r.reservationNeeded ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100/90">
                                              <Clock className="h-3 w-3" />
                                              Prenotazione consigliata
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200/90">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Walk-in ok
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <p className="mt-2 text-sm leading-relaxed text-et-ink/70">
                                        {r.why}
                                      </p>

                                      {r.reservationNeeded && r.reservationTip ? (
                                        <div className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-100/90">
                                          <strong className="font-semibold">
                                            Tip prenotazione:
                                          </strong>{" "}
                                          {r.reservationTip}
                                        </div>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );

                            return (
                              <>
                                <Section title="Pranzo" items={lunch} />
                                <Section title="Cena" items={dinner} />
                              </>
                            );
                          })()}
                        </div>
                      ) : null}

                      {/* Interactive day route map */}
                      {(() => {
                        const SLOT_META: {
                          key: "morning" | "afternoon" | "evening";
                          slot: Slot | null;
                          label: string;
                          name: string;
                          color: string;
                        }[] = [
                          { key: "morning", slot: morning, label: "M", name: "Mattina", color: "#f97316" },
                          { key: "afternoon", slot: afternoon, label: "P", name: "Pomeriggio", color: "#3b82f6" },
                          { key: "evening", slot: evening, label: "S", name: "Sera", color: "#a855f7" },
                        ];
                        const markers = SLOT_META.flatMap((m) => {
                          if (!m.slot || m.slot.lat == null || m.slot.lng == null) return [];
                          return [{
                            label: m.label,
                            title: m.slot.title,
                            place: m.slot.place,
                            time: `${m.slot.startTime} – ${m.slot.endTime}`,
                            lat: m.slot.lat,
                            lng: m.slot.lng,
                            color: m.color,
                          }];
                        });

                        if (markers.length === 0) return null;

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-et-ink/50">
                              <Route className="h-3.5 w-3.5" />
                              <span>Percorso del giorno</span>
                            </div>
                            <DayRouteMap
                              markers={markers}
                              className="h-[280px] w-full overflow-hidden rounded-xl border border-et-border"
                            />
                            <div className="flex items-center gap-3">
                              {SLOT_META.map((m) =>
                                m.slot?.lat != null && m.slot?.lng != null ? (
                                  <span
                                    key={m.key}
                                    className="inline-flex items-center gap-1.5 text-[11px] text-et-ink/45"
                                  >
                                    <span
                                      className="inline-block h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: m.color }}
                                    />
                                    {m.name}
                                  </span>
                                ) : null,
                              )}
                              {day.mapCenterLat != null && day.mapCenterLng != null ? (
                                <a
                                  href={`https://www.google.com/maps?q=${day.mapCenterLat},${day.mapCenterLng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ml-auto inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 text-[11px] text-et-ink/40 transition-colors duration-200 hover:text-et-accent"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Google Maps
                                </a>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (() => {
                    const daysLeft = daysUntilUnlock(day.unlockDate);
                    return (
                      <div className="mx-5 mb-5 flex items-center gap-4 rounded-xl border border-et-border/50 bg-et-deep/60 px-4 py-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-et-border/60 bg-et-deep">
                          <Lock className="h-4.5 w-4.5 text-et-ink/35" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-et-ink/60">
                            Contenuti bloccati
                          </p>
                          <p className="mt-0.5 text-xs text-et-ink/40">
                            {daysLeft > 0 ? (
                              <>
                                <Clock className="mr-1 inline h-3 w-3 align-[-2px]" />
                                Si sblocca tra{" "}
                                <span className="font-semibold text-et-ink/55">
                                  {daysLeft} {daysLeft === 1 ? "giorno" : "giorni"}
                                </span>
                              </>
                            ) : (
                              "Si sblocca a breve…"
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ── Componente Flash riutilizzabile ── */

function Flash({
  variant,
  children,
}: {
  variant: "success" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    variant === "success"
      ? "border-et-accent/35 bg-et-accent/10 text-et-accent/95"
      : "border-et-border bg-et-card text-et-ink/80";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}
