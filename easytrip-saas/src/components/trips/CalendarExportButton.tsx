"use client";

import { useCallback, useState } from "react";
import posthog from "posthog-js";
import { Calendar, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { icsFilenameForDestination } from "@/lib/ics-export";

type CalendarExportButtonProps = {
  tripId: string;
  destination: string;
};

/** Scarica l'itinerario come file .ics (GET /api/trips/[tripId]/calendar.ics), importabile in Google/Apple/Outlook Calendar. */
export function CalendarExportButton({
  tripId,
  destination,
}: CalendarExportButtonProps) {
  const t = useTranslations("app.trips.detail.calendarExport");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2500);
  }, []);

  const handleExport = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/trips/${tripId}/calendar.ics`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("calendar export failed");

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      // Stesso nome del file servito dal server (Content-Disposition).
      anchor.download = icsFilenameForDestination(destination);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Firefox e Safari avviano il download dopo il click: revocare l'URL
      // subito può annullarlo.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);

      posthog.capture("trip_calendar_exported", {
        trip_id: tripId,
        destination,
      });
      showFeedback(t("downloadDone"));
    } catch {
      showFeedback(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }, [busy, destination, showFeedback, t, tripId]);

  const statusMessage = busy ? t("preparing") : feedback;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={busy}
        aria-label={t("buttonLabel")}
        title={t("buttonLabel")}
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1.5 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/16 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}
        <span>{t("buttonLabel")}</span>
      </button>
      {statusMessage ? (
        <span className="text-xs font-medium text-sky-300">
          {statusMessage}
        </span>
      ) : null}
    </div>
  );
}
