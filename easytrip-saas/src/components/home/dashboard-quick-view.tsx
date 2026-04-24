"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type HomeTripRow = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  currentVersion: number;
  versions: {
    versionNum: number;
    isActive: boolean;
    generatedAt: string;
    geoScore: string | null;
  }[];
};

/**
 * DD/MM/YYYY da stringa `YYYY-MM-DD` senza `Date`/locale: stesso output su SSR e client
 * (evita hydration mismatch tra Node e browser con `toLocaleDateString("it-IT")`).
 */
function formatTripDayIt(isoDate: string): string {
  const datePart = isoDate.split("T")[0] ?? "";
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** Data/ora da ISO per `title` — solo parsing stringa, niente `toLocaleString`. */
function formatGeneratedAtLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, yy, mo, da, hh, mm] = match;
  return `${da}/${mo}/${yy}, ${hh}:${mm}`;
}

function TripVersionCarousel(props: {
  tripId: string;
  versions: HomeTripRow["versions"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("home.dashboard");

  if (props.versions.length === 0) {
    return <p className="text-et-ink/50 mt-2 text-xs">{t("noVersions")}</p>;
  }

  return (
    <div className="relative mt-3">
      <div
        ref={ref}
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {props.versions.map((v) => (
          <Link
            key={v.versionNum}
            href={`/app/trips/${props.tripId}`}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
              v.isActive
                ? "border-et-accent/50 bg-et-accent/15 text-et-accent"
                : "border-et-border text-et-ink/70 hover:border-et-accent/30 bg-black/15"
            }`}
            title={t("generatedAt", {
              when: formatGeneratedAtLabel(v.generatedAt),
            })}
          >
            v{v.versionNum}
            {v.geoScore != null ? ` · ${v.geoScore}` : ""}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DashboardQuickView(props: { trips: HomeTripRow[] }) {
  const t = useTranslations("home.dashboard");

  if (props.trips.length === 0) {
    return (
      <div className="border-et-border bg-et-card rounded-3xl border p-6">
        <p className="text-et-ink/80 text-sm font-semibold">
          {t("emptyTitle")}
        </p>
        <p className="text-et-ink/60 mt-2 text-sm">{t("emptyBody")}</p>
      </div>
    );
  }

  const statusLabel = (s: string): string => {
    if (
      s === "pending" ||
      s === "active" ||
      s === "expired" ||
      s === "cancelled"
    ) {
      return t(`status.${s}`);
    }
    return s;
  };

  return (
    <div className="border-et-border bg-et-card rounded-3xl border p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-et-accent/88 text-xs font-semibold tracking-[0.2em] uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-et-ink mt-1 text-xl font-normal tracking-tight sm:text-2xl">
            {t("title")}
          </h2>
        </div>
        <Link
          href="/app/trips"
          className="text-et-accent text-sm font-semibold hover:underline"
        >
          {t("viewAll")}
        </Link>
      </div>
      <ul className="mt-6 space-y-6">
        {props.trips.map((tr) => (
          <li
            key={tr.id}
            className="border-et-border rounded-2xl border bg-black/10 p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link
                  href={`/app/trips/${tr.id}`}
                  className="text-et-ink hover:text-et-accent text-lg font-semibold transition"
                >
                  {tr.destination}
                </Link>
                <p className="text-et-ink/60 mt-1 text-sm">
                  {formatTripDayIt(tr.startDate)} —{" "}
                  {formatTripDayIt(tr.endDate)} ·{" "}
                  <span className="text-et-ink/80">
                    {statusLabel(tr.status)}
                  </span>
                </p>
              </div>
              <span className="text-et-ink/50 shrink-0 text-xs">
                {t("carouselLabel", { version: tr.currentVersion })}
              </span>
            </div>
            <TripVersionCarousel tripId={tr.id} versions={tr.versions} />
          </li>
        ))}
      </ul>
    </div>
  );
}
