import { UserRepository } from "@/server/repositories/UserRepository";
import { TripRepository } from "@/server/repositories/TripRepository";
import { PaymentRepository } from "@/server/repositories/PaymentRepository";
import { AuthService } from "@/server/services/auth/authService";
import { TripService } from "@/server/services/trip/tripService";
import { BillingService } from "@/server/services/billing/billingService";

const userRepository = new UserRepository();
const tripRepository = new TripRepository();
const paymentRepository = new PaymentRepository();

const authService = new AuthService(userRepository);
const tripService = new TripService(authService, tripRepository);
const billingService = new BillingService(
  authService,
  tripRepository,
  paymentRepository
);

export const container = {
  repositories: {
    userRepository,
    tripRepository,
    paymentRepository,
  },
  services: {
    authService,
    tripService,
    billingService,
  },
} as const;

