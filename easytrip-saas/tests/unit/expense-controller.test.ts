import { describe, expect, it, vi } from "vitest";
import { ExpenseController } from "@/server/controllers/ExpenseController";
import { AppError } from "@/server/errors/AppError";
import type { ExpenseService } from "@/server/services/expense/expenseService";

function makeController(overrides: Record<string, unknown> = {}) {
  const expenseService = {
    addExpense: vi.fn(),
    listExpenses: vi.fn(),
    deleteExpense: vi.fn(),
    getBalances: vi.fn(),
    ...overrides,
  } as unknown as ExpenseService;

  return { controller: new ExpenseController(expenseService), expenseService };
}

function req(body: unknown) {
  return new Request("http://localhost/api/trips/t1/expenses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("ExpenseController.create", () => {
  it("crea la spesa e risponde 201", async () => {
    const { controller, expenseService } = makeController({
      addExpense: vi.fn().mockResolvedValue({ id: "exp1" }),
    });

    const res = await controller.create(
      "t1",
      req({ amount: 10, description: "Pranzo", category: "cibo" }),
    );

    expect(res.status).toBe(201);
    expect(expenseService.addExpense).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ amount: 10, description: "Pranzo" }),
    );
  });

  it("risponde 400 VALIDATION_ERROR con un importo negativo (ZodError → 400)", async () => {
    const { controller, expenseService } = makeController();

    const res = await controller.create(
      "t1",
      req({ amount: -5, description: "x", category: "cibo" }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(expenseService.addExpense).not.toHaveBeenCalled();
  });

  it("risponde 400 INVALID_JSON con un body non parsabile", async () => {
    const { controller } = makeController();
    const badReq = new Request("http://localhost/api/trips/t1/expenses", {
      method: "POST",
      body: "not-json",
    });

    const res = await controller.create("t1", badReq);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_JSON");
  });
});

describe("ExpenseController.list", () => {
  it("ritorna la lista spese", async () => {
    const { controller } = makeController({
      listExpenses: vi.fn().mockResolvedValue([{ id: "exp1" }]),
    });

    const res = await controller.list("t1");

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([{ id: "exp1" }]);
  });
});

describe("ExpenseController.remove", () => {
  it("risponde 404 se la spesa non esiste", async () => {
    const { controller } = makeController({
      deleteExpense: vi
        .fn()
        .mockRejectedValue(
          new AppError("Spesa non trovata", 404, "EXPENSE_NOT_FOUND"),
        ),
    });

    const res = await controller.remove("t1", "exp1");

    expect(res.status).toBe(404);
  });

  it("elimina la spesa con successo", async () => {
    const { controller } = makeController({
      deleteExpense: vi.fn().mockResolvedValue({ deleted: true }),
    });

    const res = await controller.remove("t1", "exp1");

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ deleted: true });
  });
});

describe("ExpenseController.balances", () => {
  it("ritorna saldi e settlement", async () => {
    const { controller } = makeController({
      getBalances: vi.fn().mockResolvedValue({ members: [], settlements: [] }),
    });

    const res = await controller.balances("t1");

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ members: [], settlements: [] });
  });
});
