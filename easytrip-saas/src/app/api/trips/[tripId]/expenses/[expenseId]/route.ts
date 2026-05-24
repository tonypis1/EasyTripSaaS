import { container } from "@/server/di/container";

const expenseController = container.controllers.expenseController;

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tripId: string; expenseId: string }> },
) {
  const { tripId, expenseId } = await params;
  return expenseController.remove(tripId, expenseId);
}
