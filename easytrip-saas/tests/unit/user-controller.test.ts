import { describe, expect, it, vi } from "vitest";
import { UserController } from "@/server/controllers/UserController";
import { AppError } from "@/server/errors/AppError";
import type { AuthService } from "@/server/services/auth/authService";
import type { UserDataService } from "@/server/services/privacy/userDataService";

function makeController(
  authOverrides: Record<string, unknown> = {},
  dataOverrides: Record<string, unknown> = {},
) {
  const authService = {
    getOrCreateCurrentUser: vi.fn().mockResolvedValue({
      id: "user1",
      clerkUserId: "clerk_1",
      stripeCustomerId: "cus_1",
    }),
    ...authOverrides,
  } as unknown as AuthService;

  const userDataService = {
    exportAllDataForUserId: vi
      .fn()
      .mockResolvedValue({ user: { id: "user1" } }),
    deleteAccountForUser: vi.fn().mockResolvedValue(undefined),
    ...dataOverrides,
  } as unknown as UserDataService;

  return {
    controller: new UserController(authService, userDataService),
    authService,
    userDataService,
  };
}

describe("UserController.exportData", () => {
  it("risponde 200 con i dati e l'header Content-Disposition", async () => {
    const { controller } = makeController();
    const res = await controller.exportData();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="easytrip-data-export-user1.json"',
    );
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ user: { id: "user1" } });
  });

  it("risponde 401 in formato {ok:false} (non un 500 non gestito) se l'utente non è autenticato", async () => {
    const { controller } = makeController({
      getOrCreateCurrentUser: vi
        .fn()
        .mockRejectedValue(
          new AppError("Non autenticato", 401, "UNAUTHORIZED"),
        ),
    });

    const res = await controller.exportData();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Non autenticato" },
    });
  });
});

describe("UserController.deleteAccount", () => {
  function req(body: unknown) {
    return new Request("http://localhost/api/user/delete-account", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("cancella l'account con la frase di conferma corretta", async () => {
    const { controller, userDataService } = makeController();

    const res = await controller.deleteAccount(
      req({ confirm: "Cancella account" }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, data: { deleted: true } });
    expect(userDataService.deleteAccountForUser).toHaveBeenCalledWith({
      prismaUserId: "user1",
      clerkUserId: "clerk_1",
      stripeCustomerId: "cus_1",
    });
  });

  it("accetta le frasi di conferma nelle altre lingue supportate", async () => {
    const { controller } = makeController();
    const res = await controller.deleteAccount(
      req({ confirm: "Delete account" }),
    );
    expect(res.status).toBe(200);
  });

  it("risponde 400 CONFIRMATION_REQUIRED con una frase di conferma errata", async () => {
    const { controller, userDataService } = makeController();

    const res = await controller.deleteAccount(
      req({ confirm: "non è la frase giusta" }),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("CONFIRMATION_REQUIRED");
    expect(userDataService.deleteAccountForUser).not.toHaveBeenCalled();
  });

  it("risponde 400 VALIDATION_ERROR se manca il campo confirm (ZodError → 400)", async () => {
    const { controller } = makeController();

    const res = await controller.deleteAccount(req({}));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("risponde 400 INVALID_JSON con un body non parsabile", async () => {
    const { controller } = makeController();
    const badReq = new Request("http://localhost/api/user/delete-account", {
      method: "POST",
      body: "not-json",
    });

    const res = await controller.deleteAccount(badReq);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_JSON");
  });
});
