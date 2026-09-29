import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { SlotProposalRepository } from "@/server/repositories/SlotProposalRepository";
import { SlotProposalResolver } from "@/server/services/trip/slotProposalResolver";
import { SlotProposalService } from "@/server/services/trip/slotProposalService";
import type { AuthService } from "@/server/services/auth/authService";

const run = !!process.env.DATABASE_URL;

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

describe.skipIf(!run)("Group voting sugli slot (integration)", () => {
  const repo = new SlotProposalRepository();
  const resolver = new SlotProposalResolver(repo);
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  let tripId: string;
  let dayId: string;
  let userIds: string[] = [];
  let currentUserId: string;

  // AuthService finto: restituisce l'utente "loggato" scelto dal test.
  const auth = {
    getOrCreateCurrentUser: async () => ({ id: currentUserId }),
  } as unknown as AuthService;
  const service = new SlotProposalService(auth, repo, resolver);

  const asUser = (i: number) => {
    currentUserId = userIds[i];
  };

  async function dayMorning() {
    const day = await prisma.day.findUniqueOrThrow({ where: { id: dayId } });
    return day.morning as { title: string } | null;
  }

  async function freshDraft() {
    await prisma.day.update({
      where: { id: dayId },
      data: { morning: slot("Attuale") },
    });
    return repo.createDraft({ dayId, slotKey: "morning", options });
  }

  beforeAll(async () => {
    const names = ["Anna", "Bob", "Chiara"];
    const users = await Promise.all(
      names.map((name) =>
        prisma.user.create({
          data: {
            clerkUserId: `int_vote_${name}_${suffix}`,
            email: `int_vote_${name}_${suffix}@example.com`,
            name,
          },
        }),
      ),
    );
    userIds = users.map((u) => u.id);

    const trip = await prisma.trip.create({
      data: {
        organizerId: userIds[0],
        destination: "Roma",
        startDate: new Date(Date.UTC(2026, 5, 1)),
        endDate: new Date(Date.UTC(2026, 5, 3)),
        accessExpiresAt: new Date(Date.UTC(2026, 11, 31)),
        tripType: "gruppo",
        status: "active",
      },
    });
    tripId = trip.id;

    await Promise.all(
      userIds.map((userId, i) =>
        prisma.tripMember.create({
          data: { tripId, userId, role: i === 0 ? "org" : "member" },
        }),
      ),
    );

    const version = await prisma.tripVersion.create({
      data: { tripId, versionNum: 1, isActive: true },
    });
    const day = await prisma.day.create({
      data: {
        tripVersionId: version.id,
        dayNumber: 1,
        unlockDate: new Date(Date.UTC(2026, 5, 1)),
        morning: slot("Attuale"),
      },
    });
    dayId = day.id;
  });

  afterAll(async () => {
    if (tripId) {
      await prisma.trip
        .delete({ where: { id: tripId } })
        .catch(() => undefined);
    }
    await prisma.user
      .deleteMany({ where: { id: { in: userIds } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it("createDraft tiene una sola bozza per slot e annulla la votazione aperta precedente", async () => {
    const first = await freshDraft();
    asUser(0);
    await service.open(tripId, first.id);

    const second = await repo.createDraft({
      dayId,
      slotKey: "morning",
      options,
    });

    const reloaded = await prisma.slotProposal.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(reloaded.status).toBe("cancelled");
    expect(second.status).toBe("draft");

    const alive = await prisma.slotProposal.count({
      where: {
        dayId,
        slotKey: "morning",
        status: { in: ["draft", "open"] },
      },
    });
    expect(alive).toBe(1);
  });

  it("solo l'organizzatore può aprire la votazione; un estraneo non può votare", async () => {
    const draft = await freshDraft();

    asUser(1);
    await expect(service.open(tripId, draft.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    asUser(0);
    const dto = await service.open(tripId, draft.id);
    expect(dto.expiresAt).not.toBeNull();

    const stranger = await prisma.user.create({
      data: {
        clerkUserId: `int_vote_stranger_${suffix}`,
        email: `int_vote_stranger_${suffix}@example.com`,
      },
    });
    try {
      currentUserId = stranger.id;
      await expect(service.vote(tripId, draft.id, 1)).rejects.toMatchObject({
        code: "NOT_MEMBER",
      });
    } finally {
      await prisma.user.delete({ where: { id: stranger.id } });
    }
  });

  it("la maggioranza applica l'alternativa allo slot e il voto è modificabile prima", async () => {
    const draft = await freshDraft();
    asUser(0);
    await service.open(tripId, draft.id);

    // Bob vota, poi cambia idea: resta un solo voto per membro.
    asUser(1);
    await service.vote(tripId, draft.id, 2);
    const changed = await service.vote(tripId, draft.id, 1);
    expect(changed.resolved).toBe(false);
    expect(
      await prisma.slotVote.count({ where: { proposalId: draft.id } }),
    ).toBe(1);

    // Con 3 membri la maggioranza è 2: il secondo voto per "Alt 1" chiude.
    asUser(2);
    const outcome = await service.vote(tripId, draft.id, 1);
    expect(outcome).toMatchObject({ resolved: true, winnerIndex: 1 });

    expect((await dayMorning())?.title).toBe("Alt 1");
    // Lo slot applicato è un vero oggetto jsonb, non una stringa JSON doppiamente serializzata.
    const [stored] = await prisma.$queryRaw<{ type: string }[]>`
      SELECT jsonb_typeof("morning") AS type FROM "Day" WHERE "id" = ${dayId}`;
    expect(stored.type).toBe("object");
    const closed = await prisma.slotProposal.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(closed.status).toBe("resolved");
    expect(closed.winnerIndex).toBe(1);

    // Una votazione chiusa non accetta altri voti.
    asUser(0);
    await expect(service.vote(tripId, draft.id, 2)).rejects.toMatchObject({
      code: "PROPOSAL_NOT_OPEN",
    });
  });

  it("voti simultanei che innescano la stessa decisione applicano lo slot una volta sola", async () => {
    const draft = await freshDraft();
    asUser(0);
    await service.open(tripId, draft.id);

    // Due chiusure concorrenti sulla stessa proposta (es. voto decisivo + cron):
    // solo una deve vincere la transizione open -> resolved.
    const loaded = await repo.findWithContext(draft.id);
    if (!loaded) throw new Error("proposta non trovata");
    const results = await Promise.all([
      resolver.finalize(loaded, 1),
      resolver.finalize(loaded, 2),
      resolver.finalize(loaded, 1),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const closed = await prisma.slotProposal.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(closed.status).toBe("resolved");
    // Lo slot corrisponde all'opzione vincitrice registrata, non a un'altra.
    const expected = options[closed.winnerIndex ?? 0].slot.title;
    expect((await dayMorning())?.title).toBe(expected);
  });

  it("l'organizzatore può chiudere in anticipo: pareggio o nessun voto mantengono l'attuale", async () => {
    const draft = await freshDraft();
    asUser(0);
    await service.open(tripId, draft.id);

    asUser(1);
    await service.vote(tripId, draft.id, 1);
    asUser(0);
    await service.vote(tripId, draft.id, 2); // 1-1: pareggio

    const outcome = await service.close(tripId, draft.id);
    expect(outcome).toMatchObject({ resolved: true, winnerIndex: 1 });
    // 1 voto ciascuno per Alt 1 e Alt 2, nessuno per l'attuale -> vince la prima alternativa.
    expect((await dayMorning())?.title).toBe("Alt 1");

    const empty = await freshDraft();
    await service.open(tripId, empty.id);
    const kept = await service.close(tripId, empty.id);
    expect(kept.winnerIndex).toBe(0);
    expect((await dayMorning())?.title).toBe("Attuale");
  });

  it("resolveExpired chiude le votazioni scadute con l'opzione in testa, ignorando quelle ancora valide", async () => {
    const expired = await freshDraft();
    asUser(0);
    await service.open(tripId, expired.id);
    asUser(1);
    await service.vote(tripId, expired.id, 2);

    // Simula il trascorrere delle 24h.
    await prisma.slotProposal.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const live = await prisma.slotProposal.create({
      data: {
        dayId,
        slotKey: "evening",
        status: "open",
        options,
        openedAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const resolved = await resolver.resolveExpired(new Date());
    expect(resolved).toBe(1);

    expect((await dayMorning())?.title).toBe("Alt 2");
    expect(
      (await prisma.slotProposal.findUniqueOrThrow({ where: { id: live.id } }))
        .status,
    ).toBe("open");
  });

  it("i voti e le proposte spariscono in cascata con il viaggio", async () => {
    const draft = await freshDraft();
    asUser(0);
    await service.open(tripId, draft.id);
    asUser(1);
    await service.vote(tripId, draft.id, 1);

    const throwaway = await prisma.trip.create({
      data: {
        organizerId: userIds[0],
        destination: "Milano",
        startDate: new Date(Date.UTC(2026, 6, 1)),
        endDate: new Date(Date.UTC(2026, 6, 2)),
        accessExpiresAt: new Date(Date.UTC(2026, 11, 31)),
        tripType: "gruppo",
        status: "active",
      },
    });
    const version = await prisma.tripVersion.create({
      data: { tripId: throwaway.id, versionNum: 1, isActive: true },
    });
    const day = await prisma.day.create({
      data: {
        tripVersionId: version.id,
        dayNumber: 1,
        unlockDate: new Date(Date.UTC(2026, 6, 1)),
      },
    });
    const member = await prisma.tripMember.create({
      data: { tripId: throwaway.id, userId: userIds[0], role: "org" },
    });
    const proposal = await prisma.slotProposal.create({
      data: { dayId: day.id, slotKey: "morning", options },
    });
    await prisma.slotVote.create({
      data: { proposalId: proposal.id, memberId: member.id, optionIndex: 1 },
    });

    await prisma.trip.delete({ where: { id: throwaway.id } });

    expect(
      await prisma.slotProposal.count({ where: { id: proposal.id } }),
    ).toBe(0);
    expect(
      await prisma.slotVote.count({ where: { proposalId: proposal.id } }),
    ).toBe(0);
  });
});
