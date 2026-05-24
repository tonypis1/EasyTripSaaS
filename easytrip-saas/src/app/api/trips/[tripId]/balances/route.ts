import { container } from "@/server/di/container";

const expenseController = container.controllers.expenseController;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  return expenseController.balances(tripId);
}
