import { container } from "@/server/di/container";

const expenseController = container.controllers.expenseController;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  return expenseController.list(tripId);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  return expenseController.create(tripId, req);
}
