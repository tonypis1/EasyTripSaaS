import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { NextResponse } from "next/server";
import { BaseController } from "@/server/controllers/BaseController";
import { AppError } from "@/server/errors/AppError";

/** Sottoclasse minima per esercitare i metodi protetti `ok`/`fail`. */
class TestController extends BaseController {
  public ok200<T>(data: T) {
    return this.ok(data);
  }
  public fail400(error: unknown) {
    return this.fail(error, "TestController.op");
  }
}

const schema = z.object({ name: z.string().min(1), age: z.number().int() });

describe("BaseController.fail", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("mappa un ZodError su 400 VALIDATION_ERROR con i dettagli dei campi, e loggato a warn (non error)", async () => {
    const controller = new TestController();
    let zodError: unknown;
    try {
      schema.parse({ name: "", age: "not-a-number" });
    } catch (e) {
      zodError = e;
    }

    const res = controller.fail400(zodError) as NextResponse;
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details.fieldErrors).toHaveProperty("name");
    expect(json.error.details.fieldErrors).toHaveProperty("age");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("mantiene lo statusCode/codice di un AppError esistente e lo logga a warn per i 4xx", async () => {
    const controller = new TestController();
    const res = controller.fail400(
      new AppError("Trip non trovato", 404, "TRIP_NOT_FOUND"),
    ) as NextResponse;

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toEqual({ code: "TRIP_NOT_FOUND", message: "Trip non trovato" });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("mappa un errore sconosciuto su 500 INTERNAL_ERROR e lo logga a error", async () => {
    const controller = new TestController();
    const res = controller.fail400(new Error("boom")) as NextResponse;

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logga a error (non warn) un AppError 5xx", async () => {
    const controller = new TestController();
    const res = controller.fail400(
      new AppError("Checkout URL non disponibile", 502, "CHECKOUT_URL_MISSING"),
    ) as NextResponse;

    expect(res.status).toBe(502);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
