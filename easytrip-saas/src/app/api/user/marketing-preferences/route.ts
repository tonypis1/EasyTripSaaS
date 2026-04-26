import { NextResponse } from "next/server";
import { container } from "@/server/di/container";
import { AppError } from "@/server/errors/AppError";

/**
 * GET: stato opt-in email marketing.
 * PATCH: aggiorna opt-in (GDPR — preferenze esplicite).
 */
export async function GET() {
  const auth = container.services.authService;
  try {
    const me = await auth.getOrCreateCurrentUser();
    return NextResponse.json({
      ok: true,
      marketingOptIn: me.marketingOptIn,
      marketingOptInAt: me.marketingOptInAt?.toISOString() ?? null,
    });
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

export async function PATCH(req: Request) {
  const auth = container.services.authService;
  const users = container.repositories.userRepository;
  let body: { marketingOptIn?: boolean };
  try {
    body = (await req.json()) as { marketingOptIn?: boolean };
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "JSON non valido" } },
      { status: 400 },
    );
  }

  if (typeof body.marketingOptIn !== "boolean") {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "Invia { \"marketingOptIn\": true|false }" },
      },
      { status: 400 },
    );
  }

  try {
    const me = await auth.getOrCreateCurrentUser();
    const updated = await users.updateMarketingOptIn(me.id, body.marketingOptIn);
    return NextResponse.json({
      ok: true,
      marketingOptIn: updated.marketingOptIn,
      marketingOptInAt: updated.marketingOptInAt?.toISOString() ?? null,
    });
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
