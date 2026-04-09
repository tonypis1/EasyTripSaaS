import { container } from "@/server/di/container";
import { NextResponse } from "next/server";
import {
  enforceRateLimit,
  getClientIp,
  referralTrackLimiter,
} from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rl = await enforceRateLimit(
    referralTrackLimiter,
    `ref_track:${getClientIp(req)}`,
  );
  if (rl) return rl;

  try {
    const body = await req.json();
    const referralCode = typeof body.referralCode === "string" ? body.referralCode.trim() : "";

    if (!referralCode) {
      return NextResponse.json(
        { ok: false, error: { message: "Codice referral mancante" } },
        { status: 400 },
      );
    }

    const authService = container.services.authService;
    const referralService = container.services.referralService;

    const user = await authService.getOrCreateCurrentUser();
    await referralService.trackSignup(referralCode, user.id, user.email);

    return NextResponse.json({ ok: true, data: { tracked: true } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Errore";
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json(
      { ok: false, error: { message: msg } },
      { status },
    );
  }
}
