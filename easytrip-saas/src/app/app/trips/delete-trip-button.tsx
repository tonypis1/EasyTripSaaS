"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard, EyeOff, Loader2, X } from "lucide-react";

type Props = {
  tripId: string;
  destination: string;
  isPaid: boolean;
  startDate: string;
  status: string;
};

type CancelResult = {
  creditAmount: number;
  creditExpiresAt: string;
};

export function DeleteTripButton({
  tripId,
  destination,
  isPaid,
  startDate,
  status,
}: Props) {
  const router = useRouter();
  const [busyCancel, setBusyCancel] = useState(false);
  const [busyArchive, setBusyArchive] = useState(false);
  const [result, setResult] = useState<CancelResult | null>(null);
  const [archived, setArchived] = useState(false);

  const hasStarted = new Date(startDate) <= new Date();
  const canCancel = !hasStarted && status !== "cancelled";

  async function onCancel() {
    const message = isPaid
      ? `Cancellare «${destination}»?\n\nL'importo pagato verrà convertito in credito EasyTrip (valido 365 giorni) da usare per il prossimo viaggio.`
      : `Cancellare «${destination}» dalla tua lista?`;

    if (!window.confirm(message)) return;

    setBusyCancel(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { creditAmount?: number; creditExpiresAt?: string };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        window.alert(
          json.error?.message ?? "Impossibile cancellare il viaggio",
        );
        return;
      }

      const credit = json.data?.creditAmount ?? 0;
      if (credit > 0) {
        setResult({
          creditAmount: credit,
          creditExpiresAt: json.data?.creditExpiresAt ?? "",
        });
        setTimeout(() => router.refresh(), 4000);
      } else {
        router.refresh();
      }
    } finally {
      setBusyCancel(false);
    }
  }

  async function onArchive() {
    const hint = canCancel
      ? `\n\n⚠️ Nota: questa azione nasconde il viaggio ma NON genera crediti.\nPer cancellare il viaggio e ricevere crediti EasyTrip, usa invece «Cancella viaggio».`
      : "";

    const message =
      `Nascondere «${destination}» dall'elenco?\n\nIl viaggio verrà rimosso dalla tua lista. Tutti i dati e i pagamenti resteranno salvati nel sistema.${hint}`;

    if (!window.confirm(message)) return;

    setBusyArchive(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/archive`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { archived?: boolean };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        window.alert(
          json.error?.message ?? "Impossibile nascondere il viaggio",
        );
        return;
      }
      setArchived(true);
      setTimeout(() => router.refresh(), 2000);
    } finally {
      setBusyArchive(false);
    }
  }

  if (result) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5">
        <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-medium text-emerald-300">
          €{result.creditAmount.toFixed(2)} accreditati
        </span>
      </div>
    );
  }

  if (archived) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5">
        <EyeOff className="h-3.5 w-3.5 text-sky-400" />
        <span className="text-xs font-medium text-sky-300">
          Nascosto dall&apos;elenco
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {canCancel ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void onCancel();
          }}
          disabled={busyCancel || busyArchive}
          title={
            isPaid
              ? "Cancella il viaggio e ricevi credito EasyTrip"
              : "Cancella il viaggio dalla tua lista"
          }
          className="shrink-0 min-h-[44px] cursor-pointer rounded-lg border border-et-border/80 px-3 py-1.5 text-xs font-medium text-et-ink/70 transition duration-200 hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
        >
          {busyCancel ? (
            <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <X className="mr-1 inline h-3 w-3" />
              Cancella viaggio
            </>
          )}
        </button>
      ) : hasStarted && status !== "cancelled" ? (
        <span
          title="Non puoi cancellare un viaggio già iniziato"
          className="shrink-0 rounded-lg border border-et-border/40 px-3 py-1.5 text-xs text-et-ink/30 cursor-not-allowed"
        >
          <X className="mr-1 inline h-3 w-3" />
          Non cancellabile
        </span>
      ) : null}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onArchive();
        }}
        disabled={busyCancel || busyArchive}
        title="Nasconde il viaggio dall'elenco (nessun dato cancellato)"
        className="shrink-0 min-h-[44px] cursor-pointer rounded-lg border border-et-border/50 px-3 py-1.5 text-xs font-medium text-et-ink/45 transition duration-200 hover:border-amber-400/40 hover:bg-amber-500/8 hover:text-amber-300 disabled:opacity-50"
      >
        {busyArchive ? (
          <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <EyeOff className="mr-1 inline h-3 w-3" />
            Elimina dall&apos;elenco
          </>
        )}
      </button>
    </div>
  );
}
