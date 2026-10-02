import { describe, expect, it } from "vitest";
import {
  decideVote,
  tallyVotes,
  toSlotProposalDto,
  SlotProposalOptionsSchema,
} from "@/lib/slot-vote";

const votes = (...indices: number[]) =>
  indices.map((optionIndex) => ({ optionIndex }));

function slot(title: string) {
  return {
    title,
    place: "Centro",
    why: "Bello",
    startTime: "10:00",
    endTime: "12:00",
    durationMin: 120,
    googleMapsQuery: `${title} Roma`,
    bookingLink: null,
    tips: ["Vai presto"],
    lat: 41.9,
    lng: 12.45,
  };
}

const options = [
  { slot: slot("Attuale"), distance: null, note: null },
  { slot: slot("Alt 1"), distance: "200m", note: "Aperto fino alle 20" },
  { slot: slot("Alt 2"), distance: "350m", note: "Chiuso il lunedì" },
];

describe("tallyVotes", () => {
  it("conta i voti per opzione e ignora indici fuori range", () => {
    expect(tallyVotes(3, votes(0, 1, 1, 2, 7, -1))).toEqual([1, 2, 1]);
  });
});

describe("decideVote — modalità auto (dopo ogni voto)", () => {
  it("resta aperta finché nessuna opzione ha la maggioranza stretta e mancano voti", () => {
    expect(
      decideVote({
        optionCount: 3,
        votes: votes(1, 2),
        totalMembers: 4,
        mode: "auto",
      }),
    ).toEqual({ done: false, winnerIndex: null, reason: null });
  });

  it("si chiude appena un'opzione ha la maggioranza STRETTA di tutti i membri, anche se non hanno votato tutti", () => {
    // 3 su 4 membri: gli altri non possono più ribaltare il risultato
    const d = decideVote({
      optionCount: 3,
      votes: votes(1, 1, 1),
      totalMembers: 4,
      mode: "auto",
    });
    expect(d).toEqual({ done: true, winnerIndex: 1, reason: "majority" });
  });

  it("metà esatta NON è maggioranza (2 su 4 con 2 voti mancanti resta aperta)", () => {
    expect(
      decideVote({
        optionCount: 3,
        votes: votes(1, 1),
        totalMembers: 4,
        mode: "auto",
      }).done,
    ).toBe(false);
  });

  it("con 3 membri bastano 2 voti concordi", () => {
    expect(
      decideVote({
        optionCount: 3,
        votes: votes(2, 2),
        totalMembers: 3,
        mode: "auto",
      }),
    ).toEqual({ done: true, winnerIndex: 2, reason: "majority" });
  });

  it("con 2 membri un solo voto non basta, due voti concordi sì", () => {
    expect(
      decideVote({
        optionCount: 3,
        votes: votes(1),
        totalMembers: 2,
        mode: "auto",
      }).done,
    ).toBe(false);
    expect(
      decideVote({
        optionCount: 3,
        votes: votes(1, 1),
        totalMembers: 2,
        mode: "auto",
      }),
    ).toEqual({ done: true, winnerIndex: 1, reason: "majority" });
  });

  it("quando hanno votato tutti senza maggioranza, in caso di parità vince 'mantieni l'attuale'", () => {
    const d = decideVote({
      optionCount: 3,
      votes: votes(0, 0, 1, 1),
      totalMembers: 4,
      mode: "auto",
    });
    expect(d).toEqual({ done: true, winnerIndex: 0, reason: "all_voted" });
  });

  it("parità tra due alternative (senza lo 0): vince la prima in elenco", () => {
    const d = decideVote({
      optionCount: 3,
      votes: votes(1, 2),
      totalMembers: 2,
      mode: "auto",
    });
    expect(d).toEqual({ done: true, winnerIndex: 1, reason: "all_voted" });
  });

  it("tutti votati con un'alternativa in testa senza maggioranza stretta: vince la più votata", () => {
    const d = decideVote({
      optionCount: 3,
      votes: votes(0, 1, 1, 2, 2),
      totalMembers: 5,
      mode: "auto",
    });
    // 1 e 2 a pari merito (2 voti) e lo 0 ne ha 1: vince la prima alternativa
    expect(d).toEqual({ done: true, winnerIndex: 1, reason: "all_voted" });
  });
});

describe("decideVote — modalità force (organizzatore / scadenza)", () => {
  it("chiude con l'opzione in testa", () => {
    expect(
      decideVote({
        optionCount: 3,
        votes: votes(2, 2, 1),
        totalMembers: 6,
        mode: "force",
      }),
    ).toEqual({ done: true, winnerIndex: 2, reason: "forced" });
  });

  it("senza alcun voto mantiene l'attuale", () => {
    expect(
      decideVote({ optionCount: 3, votes: [], totalMembers: 4, mode: "force" }),
    ).toEqual({ done: true, winnerIndex: 0, reason: "forced" });
  });

  it("a parità con l'attuale in testa lo mantiene", () => {
    expect(
      decideVote({
        optionCount: 3,
        votes: votes(0, 1),
        totalMembers: 4,
        mode: "force",
      }).winnerIndex,
    ).toBe(0);
  });
});

describe("decideVote — proprietà", () => {
  it("una maggioranza raggiunta non può essere ribaltata dai voti successivi (1500 sequenze casuali)", () => {
    let seed = 11;
    const rand = () =>
      (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

    for (let i = 0; i < 1500; i++) {
      const totalMembers = 2 + Math.floor(rand() * 6);
      const optionCount = 2 + Math.floor(rand() * 3);
      const all = Array.from({ length: totalMembers }, () => ({
        optionIndex: Math.floor(rand() * optionCount),
      }));

      let firstWinner: number | null = null;
      for (let n = 1; n <= all.length && firstWinner === null; n++) {
        const d = decideVote({
          optionCount,
          votes: all.slice(0, n),
          totalMembers,
          mode: "auto",
        });
        if (d.done) firstWinner = d.winnerIndex;
      }

      // Con tutti i voti la votazione è sempre chiusa e, se si era chiusa prima, l'esito è identico.
      const final = decideVote({
        optionCount,
        votes: all,
        totalMembers,
        mode: "auto",
      });
      expect(final.done).toBe(true);
      expect(final.winnerIndex).toBe(firstWinner);
    }
  });
});

describe("SlotProposalOptionsSchema", () => {
  it("accetta contenuto attuale + alternative e rifiuta liste troppo corte", () => {
    expect(SlotProposalOptionsSchema.safeParse(options).success).toBe(true);
    expect(
      SlotProposalOptionsSchema.safeParse(options.slice(0, 1)).success,
    ).toBe(false);
  });

  it("rifiuta un bookingLink con schema pericoloso nell'opzione (stessa guardia degli slot)", () => {
    const bad = [
      options[0],
      {
        ...options[1],
        slot: { ...slot("X"), bookingLink: "javascript:alert(1)" },
      },
    ];
    expect(SlotProposalOptionsSchema.safeParse(bad).success).toBe(false);
  });
});

describe("toSlotProposalDto", () => {
  const proposal = {
    id: "p1",
    dayId: "d1",
    slotKey: "morning",
    expiresAt: new Date("2026-09-29T12:00:00Z"),
    options,
    votes: [
      { memberId: "m1", optionIndex: 1 },
      { memberId: "m2", optionIndex: 1 },
      { memberId: "m3", optionIndex: 0 },
    ],
  };

  it("espone opzioni, conteggi e il voto del membro corrente", () => {
    const dto = toSlotProposalDto({
      proposal,
      totalMembers: 5,
      myMemberId: "m3",
    });

    expect(dto?.tally).toEqual([1, 2, 0]);
    expect(dto?.votedCount).toBe(3);
    expect(dto?.totalMembers).toBe(5);
    expect(dto?.myVote).toBe(0);
    expect(dto?.options.map((o) => o.title)).toEqual([
      "Attuale",
      "Alt 1",
      "Alt 2",
    ]);
    expect(dto?.options.map((o) => o.isCurrent)).toEqual([true, false, false]);
    expect(dto?.expiresAt).toBe("2026-09-29T12:00:00.000Z");
  });

  it("myVote è null se il membro non ha ancora votato (o non è identificato)", () => {
    expect(
      toSlotProposalDto({ proposal, totalMembers: 5, myMemberId: "m9" })
        ?.myVote,
    ).toBeNull();
    expect(
      toSlotProposalDto({ proposal, totalMembers: 5, myMemberId: null })
        ?.myVote,
    ).toBeNull();
  });

  it("ritorna null per opzioni corrotte o slotKey sconosciuta invece di rompere la pagina", () => {
    expect(
      toSlotProposalDto({
        proposal: { ...proposal, options: "corrotto" },
        totalMembers: 5,
        myMemberId: "m1",
      }),
    ).toBeNull();
    expect(
      toSlotProposalDto({
        proposal: { ...proposal, slotKey: "night" },
        totalMembers: 5,
        myMemberId: "m1",
      }),
    ).toBeNull();
  });
});
