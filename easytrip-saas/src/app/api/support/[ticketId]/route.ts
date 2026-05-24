import { container } from "@/server/di/container";

const supportController = container.controllers.supportController;

type Ctx = { params: Promise<{ ticketId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { ticketId } = await ctx.params;
  return supportController.getById(ticketId);
}

export async function POST(req: Request, ctx: Ctx) {
  const { ticketId } = await ctx.params;
  return supportController.addMessage(ticketId, req);
}
