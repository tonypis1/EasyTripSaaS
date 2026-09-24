import { container } from "@/server/di/container";
import { auth } from "@clerk/nextjs/server";
import { checkoutLimiter, enforceRateLimit } from "@/lib/rate-limit";

const billingController = container.controllers.billingController;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { ok: false, error: { message: "Non autenticato" } },
      { status: 401 },
    );
  }

  const rl = await enforceRateLimit(checkoutLimiter, `checkout:${userId}`);
  if (rl) return rl;

  return billingController.createCheckout(req);
}
