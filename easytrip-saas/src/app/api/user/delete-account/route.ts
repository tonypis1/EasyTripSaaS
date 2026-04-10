import { NextResponse } from "next/server";
import { container } from "@/server/di/container";
import { AppError } from "@/server/errors/AppError";

const CONFIRM_PHRASE = "DELETE_MY_ACCOUNT";

/**
 * Cancellazione account coordinata: Stripe → database → Clerk (diritto all’oblio).
 */
export async function POST(req: Request) {
  let body: { confirm?: string };
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: { message: "JSON non valido", code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  if (body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: `Invia { "confirm": "${CONFIRM_PHRASE}" } per confermare la cancellazione definitiva.`,
          code: "CONFIRMATION_REQUIRED",
        },
      },
      { status: 400 },
    );
  }

  const auth = container.services.authService;
  const privacy = container.services.userDataService;

  try {
    const user = await auth.getOrCreateCurrentUser();
    await privacy.deleteAccountForUser({
      prismaUserId: user.id,
      clerkUserId: user.clerkUserId,
      stripeCustomerId: user.stripeCustomerId,
    });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: { message: e.message, code: e.code } },
        { status: e.statusCode },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true, deleted: true });
}
