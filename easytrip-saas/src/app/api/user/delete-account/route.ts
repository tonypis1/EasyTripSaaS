import { container } from "@/server/di/container";

/**
 * Cancellazione account coordinata: Stripe → database → Clerk (diritto all'oblio).
 */
export async function POST(req: Request) {
  return container.controllers.userController.deleteAccount(req);
}
