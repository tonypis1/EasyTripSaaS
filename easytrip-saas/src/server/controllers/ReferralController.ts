import { BaseController } from "@/server/controllers/BaseController";
import { ReferralService } from "@/server/services/referral/referralService";

export class ReferralController extends BaseController {
  constructor(private readonly referralService: ReferralService) {
    super();
  }

  async getMyReferralData() {
    try {
      const data = await this.referralService.getMyReferralData();
      return this.ok(data);
    } catch (error) {
      return this.fail(error, "ReferralController.getMyReferralData");
    }
  }
}
