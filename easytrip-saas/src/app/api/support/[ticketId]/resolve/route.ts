import { container } from "@/server/di/container";

const supportController = container.controllers.supportController;

type Ctx = { params: Promise<{ ticketId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { ticketId } = await ctx.params;
  return supportController.resolve(ticketId);
}
