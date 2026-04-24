"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("app.trips.delete");
  const [busyCancel, setBusyCancel] = useState(false);
  const [busyArchive, setBusyArchive] = useState(false);
  const [result, setResult] = useState<CancelResult | null>(null);
  const [archived, setArchived] = useState(false);

  const hasStarted = new Date(startDate) <= new Date();
  const canCancel = !hasStarted && status !== "cancelled";

  async function onCancel() {
    const message = isPaid
      ? t("cancelConfirmPaid", { destination })
      : t("cancelConfirmFree", { destination });

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
        window.alert(json.error?.message ?? t("cancelErrorFallback"));
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
    // Se il viaggio è ancora cancellabile, avvisiamo che archiviare NON genera
    // crediti: così l'utente ha una scelta consapevole tra i due flussi.
    const hint = canCancel ? t("archiveHint") : "";
    const message = t("archiveConfirm", { destination, hint });

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
        window.alert(json.error?.message ?? t("archiveErrorFallback"));
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
          {t("creditGranted", { amount: result.creditAmount.toFixed(2) })}
        </span>
      </div>
    );
  }

  if (archived) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5">
        <EyeOff className="h-3.5 w-3.5 text-sky-400" />
        <span className="text-xs font-medium text-sky-300">{t("archived")}</span>
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
          title={isPaid ? t("cancelTooltipPaid") : t("cancelTooltipFree")}
          className="border-et-border/80 text-et-ink/70 min-h-[44px] shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition duration-200 hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
        >
          {busyCancel ? (
            <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <X className="mr-1 inline h-3 w-3" />
              {t("cancelButton")}
            </>
          )}
        </button>
      ) : hasStarted && status !== "cancelled" ? (
        <span
          title={t("notCancellableTooltip")}
          className="border-et-border/40 text-et-ink/30 shrink-0 cursor-not-allowed rounded-lg border px-3 py-1.5 text-xs"
        >
          <X className="mr-1 inline h-3 w-3" />
          {t("notCancellable")}
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
        title={t("archiveTooltip")}
        className="border-et-border/50 text-et-ink/45 min-h-[44px] shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition duration-200 hover:border-amber-400/40 hover:bg-amber-500/8 hover:text-amber-300 disabled:opacity-50"
      >
        {busyArchive ? (
          <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <EyeOff className="mr-1 inline h-3 w-3" />
            {t("archiveButton")}
          </>
        )}
      </button>
    </div>
  );
}
