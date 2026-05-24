import { NextResponse } from "next/server";
import { container } from "@/server/di/container";
import { AppError } from "@/server/errors/AppError";
import { DELETE_ACCOUNT_CONFIRM_PHRASES } from "@/lib/user/delete-account-confirm-phrases";

/**
 * Cancellazione account coordinata: Stripe → database → Clerk (diritto all’oblio).
 */
export async function POST(req: Request) {
  let body: { confirm?: string };
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { message: "JSON non valido", code: "INVALID_JSON" },
      },
      { status: 400 },
    );
  }

  const trimmed = body.confirm?.trim() ?? "";
  if (!DELETE_ACCOUNT_CONFIRM_PHRASES.has(trimmed)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message:
            "Frase di conferma non valida. Digita la formula esatta mostrata nella pagina, nella tua lingua.",
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
