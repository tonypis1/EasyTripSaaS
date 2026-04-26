import { NextResponse } from "next/server";
import { container } from "@/server/di/container";
import { AppError } from "@/server/errors/AppError";
import { routing, type AppLocale } from "@/i18n/routing";

/**
 * GET: lingua preferita corrente dell'utente.
 * PATCH: aggiorna la lingua preferita (sincronizzata dal LocaleSwitcher).
 *
 * Body PATCH: { "language": "it" | "en" | "es" | "fr" | "de" }
 */
export async function GET() {
  const auth = container.services.authService;
  try {
    const me = await auth.getOrCreateCurrentUser();
    return NextResponse.json({ ok: true, language: me.language });
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 401) {
      return NextResponse.json(
        { ok: false, error: { message: "Non autenticato", code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    throw e;
  }
}

function isSupportedLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value)
  );
}

export async function PATCH(req: Request) {
  const auth = container.services.authService;
  const users = container.repositories.userRepository;

  let body: { language?: unknown };
  try {
    body = (await req.json()) as { language?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "JSON non valido" } },
      { status: 400 },
    );
  }

  if (!isSupportedLocale(body.language)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: `Lingua non supportata. Valori ammessi: ${routing.locales.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  try {
    const me = await auth.getOrCreateCurrentUser();
    const updated = await users.updateLanguageByClerkId(
      me.clerkUserId,
      body.language,
    );
    return NextResponse.json({ ok: true, language: updated.language });
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 401) {
      return NextResponse.json(
        { ok: false, error: { message: "Non autenticato", code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    throw e;
  }
}
