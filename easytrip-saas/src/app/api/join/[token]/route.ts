import { container } from "@/server/di/container";
import {
  enforceRateLimit,
  getClientIp,
  joinGetLimiter,
  joinPostLimiter,
} from "@/lib/rate-limit";

const tripController = container.controllers.tripController;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const rl = await enforceRateLimit(
    joinGetLimiter,
    `join_get:${getClientIp(req)}:${token.slice(0, 12)}`,
  );
  if (rl) return rl;
  return tripController.getTripByToken(token);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const rl = await enforceRateLimit(
    joinPostLimiter,
    `join_post:${getClientIp(req)}:${token.slice(0, 12)}`,
  );
  if (rl) return rl;
  return tripController.joinTripByToken(token);
}
