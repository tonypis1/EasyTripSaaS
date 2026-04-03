import { UserRepository } from "@/server/repositories/UserRepository";
import { TripRepository } from "@/server/repositories/TripRepository";
import { PaymentRepository } from "@/server/repositories/PaymentRepository";
import { AuthService } from "@/server/services/auth/authService";
import { TripService } from "@/server/services/trip/tripService";
import { SlotReplaceService } from "@/server/services/trip/slotReplaceService";
import { BillingService } from "@/server/services/billing/billingService";
import { TripController } from "@/server/controllers/TripController";
import { BillingController } from "@/server/controllers/BillingController";

const userRepository = new UserRepository();
const tripRepository = new TripRepository();
const paymentRepository = new PaymentRepository();

const authService = new AuthService(userRepository);
const tripService = new TripService(authService, tripRepository);
const slotReplaceService = new SlotReplaceService();
const billingService = new BillingService(
  authService,
  tripRepository,
  paymentRepository
);

const tripController = new TripController(
  tripService,
  authService,
  slotReplaceService
);
const billingController = new BillingController(billingService);

export const container = {
  repositories: {
    userRepository,
    tripRepository,
    paymentRepository,
  },
  services: {
    authService,
    tripService,
    slotReplaceService,
    billingService,
  },
  controllers: {
    tripController,
    billingController,
  },
} as const;
