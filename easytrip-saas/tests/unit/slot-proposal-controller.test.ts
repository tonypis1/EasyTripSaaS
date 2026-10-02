import { describe, expect, it, vi } from "vitest";
import { SlotProposalController } from "@/server/controllers/SlotProposalController";
import { AppError } from "@/server/errors/AppError";
import type { SlotProposalService } from "@/server/services/trip/slotProposalService";

function makeController(overrides: Record<string, unknown> = {}) {
  const service = {
    open: vi.fn(),
    vote: vi.fn(),
    close: vi.fn(),
    ...overrides,
  } as unknown as SlotProposalService;

  return { controller: new SlotProposalController(service), service };
}

function req(body: unknown) {
  return new Request("http://localhost/api/x", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("SlotProposalController.vote", () => {
  it("inoltra tripId, proposalId e optionIndex al servizio e risponde 200", async () => {
    const outcome = { resolved: false, winnerIndex: null, proposal: null };
    const { controller, service } = makeController({
      vote: vi.fn().mockResolvedValue(outcome),
    });

    const res = await controller.vote("t1", "p1", req({ optionIndex: 2 }));

    expect(res.status).toBe(200);
    expect(service.vote).toHaveBeenCalledWith("t1", "p1", 2);
    expect((await res.json()).data).toEqual(outcome);
  });

  it.each([
    ["negativo", { optionIndex: -1 }],
    ["frazionario", { optionIndex: 1.5 }],
    ["oltre il massimo", { optionIndex: 4 }],
    ["non numerico", { optionIndex: "1" }],
    ["assente", {}],
  ])(
    "rifiuta un optionIndex %s con 400 senza toccare il servizio",
    async (_l, body) => {
      const { controller, service } = makeController();

      const res = await controller.vote("t1", "p1", req(body));

      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
      expect(service.vote).not.toHaveBeenCalled();
    },
  );

  it("risponde 400 INVALID_JSON con un body non parsabile", async () => {
    const { controller, service } = makeController();

    const res = await controller.vote("t1", "p1", req("not-json"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_JSON");
    expect(service.vote).not.toHaveBeenCalled();
  });

  it("propaga lo status e il codice degli AppError del servizio", async () => {
    const { controller } = makeController({
      vote: vi
        .fn()
        .mockRejectedValue(
          new AppError("La votazione non è aperta", 409, "PROPOSAL_NOT_OPEN"),
        ),
    });

    const res = await controller.vote("t1", "p1", req({ optionIndex: 1 }));

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("PROPOSAL_NOT_OPEN");
  });
});

describe("SlotProposalController.open / close", () => {
  it("open risponde con la proposta aperta", async () => {
    const dto = { id: "p1" };
    const { controller, service } = makeController({
      open: vi.fn().mockResolvedValue(dto),
    });

    const res = await controller.open("t1", "p1");

    expect(res.status).toBe(200);
    expect(service.open).toHaveBeenCalledWith("t1", "p1");
    expect((await res.json()).data).toEqual(dto);
  });

  it("open propaga 403 FORBIDDEN per chi non è organizzatore", async () => {
    const { controller } = makeController({
      open: vi
        .fn()
        .mockRejectedValue(
          new AppError("Solo l'organizzatore può farlo", 403, "FORBIDDEN"),
        ),
    });

    const res = await controller.open("t1", "p1");

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("close risponde con l'esito della chiusura anticipata", async () => {
    const outcome = { resolved: true, winnerIndex: 1, proposal: null };
    const { controller, service } = makeController({
      close: vi.fn().mockResolvedValue(outcome),
    });

    const res = await controller.close("t1", "p1");

    expect(res.status).toBe(200);
    expect(service.close).toHaveBeenCalledWith("t1", "p1");
    expect((await res.json()).data).toEqual(outcome);
  });
});
