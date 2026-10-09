import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `User.language` decide la lingua delle email (inviate anche a utente
 * offline). Deve seguire la lingua in cui l'utente usa davvero l'app: prima
 * quella dell'URL della pagina (`x-easytrip-locale`, dal middleware), poi il
 * cookie NEXT_LOCALE. Regressione: con il solo cookie, che next-intl non
 * scrive quando l'URL è nella lingua del browser, un utente che naviga in
 * italiano restava `de` e riceveva le email in tedesco.
 */

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  header: vi.fn<(name: string) => string | null>(),
  cookie: vi.fn<(name: string) => { value: string } | undefined>(),
}));

vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.currentUser }));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.header }),
  cookies: async () => ({ get: mocks.cookie }),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { AuthService } from "@/server/services/auth/authService";
import type { UserRepository } from "@/server/repositories/UserRepository";

function makeService(storedLanguage: string) {
  const repo = {
    upsertByClerkId: vi.fn().mockResolvedValue({
      id: "u1",
      clerkUserId: "clerk_1",
      language: storedLanguage,
    }),
    updateLanguageByClerkId: vi
      .fn()
      .mockImplementation(async (_id: string, language: string) => ({
        id: "u1",
        clerkUserId: "clerk_1",
        language,
      })),
  };
  return {
    repo,
    service: new AuthService(repo as unknown as UserRepository),
  };
}

function withRequest(opts: { urlLocale?: string; cookie?: string }) {
  mocks.header.mockImplementation((name) =>
    name === "x-easytrip-locale" ? (opts.urlLocale ?? null) : null,
  );
  mocks.cookie.mockImplementation((name) =>
    name === "NEXT_LOCALE" && opts.cookie ? { value: opts.cookie } : undefined,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUser.mockResolvedValue({
    id: "clerk_1",
    firstName: "Antonio",
    lastName: "P",
    emailAddresses: [{ emailAddress: "antonio@example.com" }],
  });
});

describe("AuthService.getOrCreateCurrentUser — lingua del profilo", () => {
  it("pagina in italiano senza cookie: riallinea un profilo rimasto in tedesco", async () => {
    withRequest({ urlLocale: "it" });
    const { service, repo } = makeService("de");

    const user = await service.getOrCreateCurrentUser();

    expect(repo.updateLanguageByClerkId).toHaveBeenCalledWith("clerk_1", "it");
    expect(user.language).toBe("it");
  });

  it("la lingua dell'URL prevale su un cookie non ancora aggiornato", async () => {
    withRequest({ urlLocale: "it", cookie: "de" });
    const { service, repo } = makeService("de");

    await service.getOrCreateCurrentUser();

    expect(repo.upsertByClerkId).toHaveBeenCalledWith(
      expect.objectContaining({ language: "it" }),
    );
    expect(repo.updateLanguageByClerkId).toHaveBeenCalledWith("clerk_1", "it");
  });

  it("chiamate /api (senza lingua nell'URL): usa il cookie NEXT_LOCALE", async () => {
    withRequest({ cookie: "fr" });
    const { service, repo } = makeService("it");

    await service.getOrCreateCurrentUser();

    expect(repo.updateLanguageByClerkId).toHaveBeenCalledWith("clerk_1", "fr");
  });

  it("senza URL né cookie non tocca la lingua salvata", async () => {
    withRequest({});
    const { service, repo } = makeService("de");

    const user = await service.getOrCreateCurrentUser();

    expect(repo.updateLanguageByClerkId).not.toHaveBeenCalled();
    expect(user.language).toBe("de");
  });

  it("lingua già allineata: nessun update", async () => {
    withRequest({ urlLocale: "it", cookie: "it" });
    const { service, repo } = makeService("it");

    await service.getOrCreateCurrentUser();

    expect(repo.updateLanguageByClerkId).not.toHaveBeenCalled();
  });
});
