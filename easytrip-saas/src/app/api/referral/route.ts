import { container } from "@/server/di/container";

const referralController = container.controllers.referralController;

export async function GET() {
  return referralController.getMyReferralData();
}
