"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  tripId: string;
  destination: string;
};

export function DeleteTripButton({ tripId, destination }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const ok = window.confirm(
      `Rimuovere «${destination}» dalla tua lista? I dati e i pagamenti restano conservati nel sistema (solo non li vedi più qui).`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        window.alert(json.error?.message ?? "Impossibile eliminare il viaggio");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onDelete();
      }}
      disabled={busy}
      title="Rimuove il viaggio dalla tua lista; storico e pagamenti restano nel database."
      className="shrink-0 rounded-lg border border-et-border/80 px-3 py-1.5 text-xs font-medium text-et-ink/70 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
    >
      {busy ? "Rimozione…" : "Cancella viaggio"}
    </button>
  );
}
