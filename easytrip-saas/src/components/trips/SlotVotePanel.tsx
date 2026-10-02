"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { CheckCircle2, Loader2, MapPin, Vote } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SlotProposalDto } from "@/lib/slot-vote";

type Outcome = { resolved: boolean; winnerIndex: number | null };

type Props = {
  tripId: string;
  proposal: SlotProposalDto;
  isOrganizer: boolean;
  /** Chiamata dopo un voto o una chiusura riusciti: il chiamante ricarica il viaggio. */
  onChanged: (outcome: Outcome) => void;
};

/** Votazione di gruppo su uno slot: opzioni con conteggio voti, voto del membro, chiusura anticipata per l'organizzatore. */
export function SlotVotePanel({
  tripId,
  proposal,
  isOrganizer,
  onChanged,
}: Props) {
  const t = useTranslations("app.trips.detail.slotVote");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Snapshot dell'ora al primo render: Date.now() nel corpo del componente non è puro.
  const [now] = useState(() => Date.now());

  const base = `/api/trips/${tripId}/slot-proposals/${proposal.id}`;
  const hoursLeft = proposal.expiresAt
    ? Math.ceil((new Date(proposal.expiresAt).getTime() - now) / 3_600_000)
    : null;

  async function call(
    action: "vote" | "close",
    body?: { optionIndex: number },
  ) {
    setBusy(action === "vote" ? `vote-${body?.optionIndex}` : "close");
    setError(null);
    try {
      const res = await fetch(`${base}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(t("errorGeneric"));
        return;
      }
      posthog.capture(
        action === "vote" ? "slot_vote_cast" : "slot_vote_closed",
        {
          tripId,
          proposalId: proposal.id,
          optionIndex: body?.optionIndex ?? null,
          resolved: Boolean(json.data?.resolved),
        },
      );
      onChanged({
        resolved: Boolean(json.data?.resolved),
        winnerIndex: json.data?.winnerIndex ?? null,
      });
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="mt-3 space-y-3 rounded-xl border-2 border-sky-400/30 bg-sky-500/6 p-4"
      data-testid="slot-vote-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-sky-300 uppercase">
          <Vote className="h-3.5 w-3.5" />
          {t("title")}
        </p>
        <p className="text-et-ink/55 text-xs">
          {t("progress", {
            voted: proposal.votedCount,
            total: proposal.totalMembers,
          })}
          {hoursLeft !== null
            ? ` · ${hoursLeft > 0 ? t("closesIn", { hours: hoursLeft }) : t("closesSoon")}`
            : ""}
        </p>
      </div>

      <div className="space-y-2" role="radiogroup" aria-label={t("title")}>
        {proposal.options.map((option) => {
          const selected = proposal.myVote === option.index;
          const votes = proposal.tally[option.index] ?? 0;
          const share =
            proposal.totalMembers > 0
              ? Math.round((votes / proposal.totalMembers) * 100)
              : 0;
          return (
            <button
              key={option.index}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy !== null}
              onClick={() => void call("vote", { optionIndex: option.index })}
              className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? "border-sky-400 bg-sky-500/15"
                  : "border-et-border/60 bg-et-card/40 hover:border-sky-400/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-et-ink/90 text-sm font-semibold">
                    {option.isCurrent ? `${t("keepCurrent")}: ` : ""}
                    {option.title}
                  </p>
                  <p className="text-et-ink/50 mt-0.5 flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[option.place, option.distance]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {option.note ? (
                    <p className="mt-1 text-xs leading-relaxed text-amber-200/85">
                      {option.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {busy === `vote-${option.index}` ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                  ) : selected ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-sky-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("yourVote")}
                    </span>
                  ) : null}
                  <span className="text-et-ink/60 text-xs">
                    {t("votes", { count: votes })}
                  </span>
                </div>
              </div>
              <div className="bg-et-border/50 mt-2 h-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-sky-400/70"
                  style={{ width: `${share}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {isOrganizer ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-et-ink/45 text-xs">{t("closeHint")}</p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void call("close")}
            className="text-et-ink/70 border-et-border inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "close" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {t("closeNow")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
