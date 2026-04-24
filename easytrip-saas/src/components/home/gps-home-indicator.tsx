"use client";

import { useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";

const GPS_AI_CONSENT_KEY = "easytrip_gps_ai_consent_v1";

type Props = {
  latestTripId: string | null;
};

function getGpsConsentSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(GPS_AI_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function GpsHomeIndicator(props: Props) {
  const consent = useSyncExternalStore(
    () => () => {
      /* sessionStorage: valore letto al mount; nuova navigazione rimonta il componente */
    },
    getGpsConsentSnapshot,
    () => false,
  );

  if (!props.latestTripId) {
    return (
      <div className="border-et-border bg-et-card text-et-ink/65 rounded-2xl border p-4 text-sm">
        Crea un itinerario per usare il GPS e la sostituzione slot sul percorso.
      </div>
    );
  }

  const tripHref = `/app/trips/${props.latestTripId}`;

  if (consent) {
    return (
      <div className="border-et-accent/35 bg-et-accent/10 flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="text-et-accent font-semibold">GPS attivo</span>
          <span className="text-et-ink/70">
            {" "}
            — suggerimenti e sostituzione slot basati sulla posizione.
          </span>
        </div>
        <Link
          href={tripHref}
          className="text-et-accent shrink-0 text-sm font-semibold underline-offset-2 hover:underline"
        >
          Apri ultimo viaggio →
        </Link>
      </div>
    );
  }

  return (
    <div className="border-et-border bg-et-card flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-et-ink/70 text-sm">
        GPS non attivato: nella pagina viaggio puoi abilitare la posizione per
        suggerimenti live e sostituire uno slot.
      </p>
      <Link
        href={tripHref}
        className="border-et-border text-et-ink hover:border-et-accent/40 hover:bg-et-accent/10 inline-flex shrink-0 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition"
      >
        Attiva dal viaggio
      </Link>
    </div>
  );
}
