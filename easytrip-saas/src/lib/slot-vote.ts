import { z } from "zod";
import { DaySlotSchema } from "@/lib/itinerary-model-schema";

/**
 * Group voting sulle alternative di uno slot: regola di decisione, forma delle
 * opzioni e DTO condiviso tra server e client. Pure e senza dipendenze server.
 */

/** Ore di voto prima che un job chiuda la proposta con l'opzione in testa. */
export const SLOT_VOTE_WINDOW_HOURS = 24;

/** Indice dell'opzione "mantieni l'attuale": il contenuto dello slot al momento della proposta. */
export const KEEP_CURRENT_INDEX = 0;

export const SLOT_KEYS = ["morning", "afternoon", "evening"] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

/** Opzione votabile: uno slot completo (applicabile senza altre chiamate AI) più il contesto mostrato ai votanti. */
export const SlotProposalOptionSchema = z.object({
  slot: DaySlotSchema,
  distance: z.string().nullable(),
  note: z.string().nullable(),
});
export type SlotProposalOption = z.infer<typeof SlotProposalOptionSchema>;

/** Contenuto attuale + 1-3 alternative. */
export const SlotProposalOptionsSchema = z
  .array(SlotProposalOptionSchema)
  .min(2)
  .max(4);

export type VoteDecision = {
  done: boolean;
  /** Indice dell'opzione vincente (null finché la votazione è aperta). */
  winnerIndex: number | null;
  reason: "majority" | "all_voted" | "forced" | null;
};

/** Voti per opzione; gli indici fuori range vengono ignorati. */
export function tallyVotes(
  optionCount: number,
  votes: { optionIndex: number }[],
): number[] {
  const tally = new Array<number>(optionCount).fill(0);
  for (const v of votes) {
    if (v.optionIndex >= 0 && v.optionIndex < optionCount) {
      tally[v.optionIndex] += 1;
    }
  }
  return tally;
}

/**
 * In testa vince chi ha più voti. A parità si preferisce lasciare le cose
 * come sono (opzione 0); se anche lo 0 non è tra i primi, la prima
 * alternativa in elenco. Senza voti: si mantiene l'attuale.
 */
function leaderOf(tally: number[]): number {
  const max = Math.max(...tally);
  if (max === 0) return KEEP_CURRENT_INDEX;
  if (tally[KEEP_CURRENT_INDEX] === max) return KEEP_CURRENT_INDEX;
  return tally.indexOf(max);
}

/**
 * Decide se la votazione è conclusa.
 * - "auto" (dopo ogni voto): si chiude appena un'opzione ha la maggioranza
 *   STRETTA di tutti i membri (i voti mancanti non possono più ribaltarla),
 *   oppure hanno votato tutti.
 * - "force" (organizzatore o scadenza della finestra): si chiude sempre con
 *   l'opzione in testa.
 */
export function decideVote(params: {
  optionCount: number;
  votes: { optionIndex: number }[];
  totalMembers: number;
  mode: "auto" | "force";
}): VoteDecision {
  const tally = tallyVotes(params.optionCount, params.votes);

  if (params.mode === "force") {
    return { done: true, winnerIndex: leaderOf(tally), reason: "forced" };
  }

  const majority = tally.findIndex((count) => count * 2 > params.totalMembers);
  if (majority !== -1) {
    return { done: true, winnerIndex: majority, reason: "majority" };
  }

  const cast = tally.reduce((sum, count) => sum + count, 0);
  if (cast >= params.totalMembers) {
    return { done: true, winnerIndex: leaderOf(tally), reason: "all_voted" };
  }

  return { done: false, winnerIndex: null, reason: null };
}

/** Proposta aperta al voto, come la vede il client. */
export type SlotProposalDto = {
  id: string;
  dayId: string;
  slotKey: SlotKey;
  expiresAt: string | null;
  options: {
    index: number;
    title: string;
    place: string;
    distance: string | null;
    note: string | null;
    isCurrent: boolean;
  }[];
  /** Voti per opzione (stesso ordine di `options`). */
  tally: number[];
  votedCount: number;
  totalMembers: number;
  /** Opzione votata dal membro corrente (null se non ha ancora votato). */
  myVote: number | null;
};

export function toSlotProposalDto(params: {
  proposal: {
    id: string;
    dayId: string;
    slotKey: string;
    expiresAt: Date | null;
    options: unknown;
    votes: { memberId: string; optionIndex: number }[];
  };
  totalMembers: number;
  myMemberId: string | null;
}): SlotProposalDto | null {
  const parsed = SlotProposalOptionsSchema.safeParse(params.proposal.options);
  if (!parsed.success) return null;
  const slotKey = SLOT_KEYS.find((k) => k === params.proposal.slotKey);
  if (!slotKey) return null;

  const options = parsed.data;
  const votes = params.proposal.votes;
  return {
    id: params.proposal.id,
    dayId: params.proposal.dayId,
    slotKey,
    expiresAt: params.proposal.expiresAt?.toISOString() ?? null,
    options: options.map((o, index) => ({
      index,
      title: o.slot.title,
      place: o.slot.place,
      distance: o.distance,
      note: o.note,
      isCurrent: index === KEEP_CURRENT_INDEX,
    })),
    tally: tallyVotes(options.length, votes),
    votedCount: votes.length,
    totalMembers: params.totalMembers,
    myVote:
      votes.find((v) => v.memberId === params.myMemberId)?.optionIndex ?? null,
  };
}
