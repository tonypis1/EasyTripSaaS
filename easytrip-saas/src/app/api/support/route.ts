import { container } from "@/server/di/container";

const supportController = container.controllers.supportController;

export async function GET() {
  return supportController.list();
}

export async function POST(req: Request) {
  return supportController.create(req);
}
