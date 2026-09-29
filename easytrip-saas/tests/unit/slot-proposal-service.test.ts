import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlotProposalService } from "@/server/services/trip/slotProposalService";
import { SlotProposalResolver } from "@/server/services/trip/slotProposalResolver";
import type {
  SlotProposalRepository,
  SlotProposalWithContext,
} from "@/server/repositories/SlotProposalRepository";
import type { AuthService } from "@/server/services/auth/authService";
import type { GeoScoreService } from "@/server/services/trip/geoScoreService";

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
  { slot: slot("Alt 1"), distance: "200m", note: "Aperto" },
  { slot: slot("Alt 2"), distance: "350m", note: "Chiuso lun" },
];

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    dayId: "d1",
    slotKey: "morning",
    status: "open",
    options,
    winnerIndex: null,
    expiresAt: new Date("2026-09-30T12:00:00Z"),
    votes: [] as { memberId: string; optionIndex: number }[],
    day: {
      id: "d1",
      tripVersionId: "ver1",
      tripVersion: {
        tripId: "trip1",
        trip: { organizerId: "org", deletedAt: null },
      },
    },
    ...overrides,
  };
}

function setup(
  opts: {
    userId?: string;
    memberId?: string | null;
    proposal?: ReturnType<typeof proposal> | null;
    members?: number;
    votes?: { memberId: string; optionIndex: number }[];
  } = {},
) {
  const repo = {
    findMember: vi
      .fn()
      .mockResolvedValue(
        opts.memberId === null ? null : { id: opts.memberId ?? "m-org" },
      ),
    countMembers: vi.fn().mockResolvedValue(opts.members ?? 4),
    findWithContext: vi
      .fn()
      .mockResolvedValue(
        opts.proposal === undefined ? proposal() : opts.proposal,
      ),
    open: vi.fn().mockResolvedValue(true),
    upsertVote: vi.fn().mockResolvedValue({}),
    listVotes: vi.fn().mockResolvedValue(opts.votes ?? []),
    resolve: vi.fn().mockResolvedValue(true),
    listExpiredOpen: vi.fn().mockResolvedValue([]),
  };
  const authService = {
    getOrCreateCurrentUser: vi
      .fn()
      .mockResolvedValue({ id: opts.userId ?? "org" }),
  } as unknown as AuthService;

  return {
    repo,
    service: new SlotProposalService(
      authService,
      repo as unknown as SlotProposalRepository,
    ),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("SlotProposalService — accesso", () => {
  it("403 NOT_MEMBER se l'utente non è membro del viaggio", async () => {
    const { service, repo } = setup({ memberId: null });

    await expect(service.vote("trip1", "p1", 1)).rejects.toMatchObject({
      code: "NOT_MEMBER",
      statusCode: 403,
    });
    expect(repo.upsertVote).not.toHaveBeenCalled();
  });

  it("404 se la proposta appartiene a un altro viaggio (id manipolato nell'URL)", async () => {
    const { service, repo } = setup();

    await expect(service.vote("altro-trip", "p1", 1)).rejects.toMatchObject({
      code: "PROPOSAL_NOT_FOUND",
      statusCode: 404,
    });
    expect(repo.upsertVote).not.toHaveBeenCalled();
  });

  it("404 se la proposta non esiste o il viaggio è stato eliminato", async () => {
    await expect(
      setup({ proposal: null }).service.vote("trip1", "p1", 1),
    ).rejects.toMatchObject({ code: "PROPOSAL_NOT_FOUND" });

    const deleted = proposal({
      day: {
        id: "d1",
        tripVersion: {
          tripId: "trip1",
          trip: { organizerId: "org", deletedAt: new Date() },
        },
      },
    });
    await expect(
      setup({ proposal: deleted }).service.vote("trip1", "p1", 1),
    ).rejects.toMatchObject({ code: "PROPOSAL_NOT_FOUND" });
  });
});

describe("SlotProposalService.open", () => {
  it("l'organizzatore apre una bozza: finestra di 24h", async () => {
    const { service, repo } = setup({
      proposal: proposal({ status: "draft", expiresAt: null }),
    });

    const dto = await service.open("trip1", "p1");

    const [, now, expiresAt] = repo.open.mock.calls[0] as [string, Date, Date];
    expect(expiresAt.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(dto.options.map((o) => o.title)).toEqual([
      "Attuale",
      "Alt 1",
      "Alt 2",
    ]);
    expect(dto.totalMembers).toBe(4);
    expect(dto.votedCount).toBe(0);
  });

  it("un membro non organizzatore non può aprirla (403 FORBIDDEN)", async () => {
    const { service, repo } = setup({
      userId: "u2",
      memberId: "m2",
      proposal: proposal({ status: "draft" }),
    });

    await expect(service.open("trip1", "p1")).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(repo.open).not.toHaveBeenCalled();
  });

  it("è idempotente se la proposta è già aperta", async () => {
    const { service, repo } = setup();

    const dto = await service.open("trip1", "p1");

    expect(dto.id).toBe("p1");
    expect(repo.open).not.toHaveBeenCalled();
  });

  it("409 se la proposta è già chiusa o annullata", async () => {
    for (const status of ["resolved", "cancelled"]) {
      const { service } = setup({ proposal: proposal({ status }) });
      await expect(service.open("trip1", "p1")).rejects.toMatchObject({
        code: "PROPOSAL_CLOSED",
        statusCode: 409,
      });
    }
  });

  it("400 se il viaggio ha meno di 2 membri (nessuno con cui votare)", async () => {
    const { service } = setup({
      members: 1,
      proposal: proposal({ status: "draft" }),
    });

    await expect(service.open("trip1", "p1")).rejects.toMatchObject({
      code: "NOT_ENOUGH_MEMBERS",
      statusCode: 400,
    });
  });
});

describe("SlotProposalService.vote", () => {
  it("un voto non decisivo registra il voto e ritorna lo stato aggiornato senza chiudere", async () => {
    const { service, repo } = setup({
      userId: "u2",
      memberId: "m2",
      votes: [{ memberId: "m2", optionIndex: 1 }],
    });

    const out = await service.vote("trip1", "p1", 1);

    expect(repo.upsertVote).toHaveBeenCalledWith("p1", "m2", 1);
    expect(out.resolved).toBe(false);
    expect(out.proposal?.tally).toEqual([0, 1, 0]);
    expect(out.proposal?.myVote).toBe(1);
    expect(repo.resolve).not.toHaveBeenCalled();
  });

  it("la maggioranza stretta chiude la votazione e APPLICA l'alternativa vincente allo slot", async () => {
    const { service, repo } = setup({
      userId: "u3",
      memberId: "m3",
      members: 4,
      votes: [
        { memberId: "m1", optionIndex: 2 },
        { memberId: "m2", optionIndex: 2 },
        { memberId: "m3", optionIndex: 2 },
      ],
    });

    const out = await service.vote("trip1", "p1", 2);

    expect(out).toEqual({ resolved: true, winnerIndex: 2, proposal: null });
    const args = repo.resolve.mock.calls[0][0];
    expect(args.winnerIndex).toBe(2);
    expect(args.apply.dayId).toBe("d1");
    expect(args.apply.slotKey).toBe("morning");
    expect(JSON.parse(args.apply.slotJson).title).toBe("Alt 2");
  });

  it("se vince 'mantieni l'attuale' chiude senza modificare lo slot", async () => {
    const { service, repo } = setup({
      userId: "u2",
      memberId: "m2",
      members: 2,
      votes: [
        { memberId: "m1", optionIndex: 0 },
        { memberId: "m2", optionIndex: 0 },
      ],
    });

    const out = await service.vote("trip1", "p1", 0);

    expect(out.winnerIndex).toBe(0);
    expect(repo.resolve.mock.calls[0][0].apply).toBeNull();
  });

  it("quando hanno votato tutti senza maggioranza e c'è parità, mantiene l'attuale", async () => {
    const { service, repo } = setup({
      userId: "u4",
      memberId: "m4",
      members: 4,
      votes: [
        { memberId: "m1", optionIndex: 0 },
        { memberId: "m2", optionIndex: 0 },
        { memberId: "m3", optionIndex: 1 },
        { memberId: "m4", optionIndex: 1 },
      ],
    });

    const out = await service.vote("trip1", "p1", 1);

    expect(out.winnerIndex).toBe(0);
    expect(repo.resolve.mock.calls[0][0].apply).toBeNull();
  });

  it("409 se la votazione non è aperta (bozza, chiusa o annullata)", async () => {
    for (const status of ["draft", "resolved", "cancelled"]) {
      const { service, repo } = setup({
        userId: "u2",
        memberId: "m2",
        proposal: proposal({ status }),
      });
      await expect(service.vote("trip1", "p1", 1)).rejects.toMatchObject({
        code: "PROPOSAL_NOT_OPEN",
        statusCode: 409,
      });
      expect(repo.upsertVote).not.toHaveBeenCalled();
    }
  });

  it("400 se l'opzione non esiste in questa proposta", async () => {
    const { service, repo } = setup({ userId: "u2", memberId: "m2" });

    await expect(service.vote("trip1", "p1", 3)).rejects.toMatchObject({
      code: "INVALID_OPTION",
      statusCode: 400,
    });
    expect(repo.upsertVote).not.toHaveBeenCalled();
  });

  it("500 PROPOSAL_CORRUPT se le opzioni salvate non sono valide (mai applicare contenuto non validato)", async () => {
    const { service } = setup({
      userId: "u2",
      memberId: "m2",
      proposal: proposal({ options: "corrotto" }),
    });

    await expect(service.vote("trip1", "p1", 1)).rejects.toMatchObject({
      code: "PROPOSAL_CORRUPT",
      statusCode: 500,
    });
  });
});

describe("SlotProposalService.close", () => {
  it("l'organizzatore chiude subito con l'opzione in testa e la applica", async () => {
    const { service, repo } = setup({
      proposal: proposal({
        votes: [
          { memberId: "m2", optionIndex: 1 },
          { memberId: "m3", optionIndex: 1 },
          { memberId: "m4", optionIndex: 2 },
        ],
      }),
      members: 6,
    });

    const out = await service.close("trip1", "p1");

    expect(out).toEqual({ resolved: true, winnerIndex: 1, proposal: null });
    expect(JSON.parse(repo.resolve.mock.calls[0][0].apply.slotJson).title).toBe(
      "Alt 1",
    );
  });

  it("senza voti mantiene l'attuale", async () => {
    const { service, repo } = setup();

    const out = await service.close("trip1", "p1");

    expect(out.winnerIndex).toBe(0);
    expect(repo.resolve.mock.calls[0][0].apply).toBeNull();
  });

  it("un membro non organizzatore non può chiudere (403 FORBIDDEN)", async () => {
    const { service, repo } = setup({ userId: "u2", memberId: "m2" });

    await expect(service.close("trip1", "p1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(repo.resolve).not.toHaveBeenCalled();
  });
});

describe("SlotProposalResolver.resolveExpired", () => {
  it("chiude le votazioni scadute con l'opzione in testa e ritorna quante ne ha chiuse", async () => {
    const { repo } = setup();
    const resolver = new SlotProposalResolver(
      repo as unknown as SlotProposalRepository,
    );
    repo.listExpiredOpen.mockResolvedValue([
      proposal({ id: "a", votes: [{ memberId: "m1", optionIndex: 2 }] }),
      proposal({ id: "b", votes: [] }),
    ]);

    const n = await resolver.resolveExpired(new Date("2026-10-01T00:00:00Z"));

    expect(n).toBe(2);
    expect(repo.resolve.mock.calls[0][0].winnerIndex).toBe(2);
    expect(repo.resolve.mock.calls[1][0].winnerIndex).toBe(0);
  });

  it("non conta le proposte già chiuse da un altro processo (resolve → false)", async () => {
    const { repo } = setup();
    const resolver = new SlotProposalResolver(
      repo as unknown as SlotProposalRepository,
    );
    repo.listExpiredOpen.mockResolvedValue([proposal()]);
    repo.resolve.mockResolvedValue(false);

    expect(await resolver.resolveExpired()).toBe(0);
  });

  it("un errore su una proposta non blocca le altre", async () => {
    const { repo } = setup();
    const resolver = new SlotProposalResolver(
      repo as unknown as SlotProposalRepository,
    );
    repo.listExpiredOpen.mockResolvedValue([
      proposal({ id: "rotta", options: "corrotto" }),
      proposal({ id: "buona" }),
    ]);

    expect(await resolver.resolveExpired()).toBe(1);
    expect(repo.resolve).toHaveBeenCalledTimes(1);
    expect(repo.resolve.mock.calls[0][0].proposalId).toBe("buona");
  });
});

describe("SlotProposalResolver — GeoScore", () => {
  // Il fixture omette i campi Prisma dei voti che il resolver non legge.
  const asContext = (p: ReturnType<typeof proposal>) =>
    p as unknown as SlotProposalWithContext;

  function resolverWithGeo() {
    const { repo } = setup();
    const geoScore = {
      refreshForVersion: vi.fn().mockResolvedValue(8.1),
    } as unknown as GeoScoreService;
    const resolver = new SlotProposalResolver(
      repo as unknown as SlotProposalRepository,
      geoScore,
    );
    return { repo, geoScore, resolver };
  }

  it("ricalcola il GeoScore della versione quando un'alternativa viene applicata allo slot", async () => {
    const { geoScore, resolver } = resolverWithGeo();

    await resolver.finalize(asContext(proposal()), 1);

    expect(geoScore.refreshForVersion).toHaveBeenCalledWith("ver1");
  });

  it("non lo ricalcola se si mantiene lo slot attuale (nulla è cambiato)", async () => {
    const { geoScore, resolver } = resolverWithGeo();

    await resolver.finalize(asContext(proposal()), 0);

    expect(geoScore.refreshForVersion).not.toHaveBeenCalled();
  });

  it("non lo ricalcola se un altro processo ha già chiuso la proposta (resolve → false)", async () => {
    const { repo, geoScore, resolver } = resolverWithGeo();
    repo.resolve.mockResolvedValue(false);

    expect(await resolver.finalize(asContext(proposal()), 1)).toBe(false);
    expect(geoScore.refreshForVersion).not.toHaveBeenCalled();
  });

  it("funziona anche senza GeoScoreService (parametro opzionale)", async () => {
    const { repo } = setup();
    const resolver = new SlotProposalResolver(
      repo as unknown as SlotProposalRepository,
    );

    expect(await resolver.finalize(asContext(proposal()), 2)).toBe(true);
  });
});
