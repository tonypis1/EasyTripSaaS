import { describe, expect, it, vi } from "vitest";
import { SupportController } from "@/server/controllers/SupportController";
import type { SupportService } from "@/server/services/support/supportService";

function makeController(overrides: Record<string, unknown> = {}) {
  const supportService = {
    createTicket: vi.fn(),
    listMyTickets: vi.fn(),
    getTicket: vi.fn(),
    addMessage: vi.fn(),
    resolveTicket: vi.fn(),
    ...overrides,
  } as unknown as SupportService;

  return { controller: new SupportController(supportService), supportService };
}

function req(body: string) {
  return new Request("http://localhost/api/support/tickets", {
    method: "POST",
    body,
  });
}

describe("SupportController.create", () => {
  it("crea il ticket e risponde 201", async () => {
    const { controller, supportService } = makeController({
      createTicket: vi.fn().mockResolvedValue({ id: "t1" }),
    });

    const res = await controller.create(
      req(JSON.stringify({ subject: "Aiuto", message: "Non riesco a..." })),
    );

    expect(res.status).toBe(201);
    expect(supportService.createTicket).toHaveBeenCalled();
  });

  it("risponde 400 INVALID_JSON con un body non parsabile (prima mancava)", async () => {
    const { controller, supportService } = makeController();

    const res = await controller.create(req("not-json"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_JSON");
    expect(supportService.createTicket).not.toHaveBeenCalled();
  });
});

describe("SupportController.addMessage", () => {
  it("risponde 400 INVALID_JSON con un body non parsabile (prima mancava)", async () => {
    const { controller, supportService } = makeController();

    const res = await controller.addMessage("ticket1", req("not-json"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_JSON");
    expect(supportService.addMessage).not.toHaveBeenCalled();
  });
});
