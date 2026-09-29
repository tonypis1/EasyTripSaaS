import { UserRepository } from "@/server/repositories/UserRepository";
import { TripRepository } from "@/server/repositories/TripRepository";
import { PaymentRepository } from "@/server/repositories/PaymentRepository";
import { SupportRepository } from "@/server/repositories/SupportRepository";
import { ExpenseRepository } from "@/server/repositories/ExpenseRepository";
import { ReferralRepository } from "@/server/repositories/ReferralRepository";
import { SlotProposalRepository } from "@/server/repositories/SlotProposalRepository";
import { AuthService } from "@/server/services/auth/authService";
import { TripService } from "@/server/services/trip/tripService";
import { SlotReplaceService } from "@/server/services/trip/slotReplaceService";
import { LiveSuggestService } from "@/server/services/trip/liveSuggestService";
import { SlotProposalService } from "@/server/services/trip/slotProposalService";
import { SlotProposalResolver } from "@/server/services/trip/slotProposalResolver";
import { GeoScoreService } from "@/server/services/trip/geoScoreService";
import { BillingService } from "@/server/services/billing/billingService";
import { SupportService } from "@/server/services/support/supportService";
import { ExpenseService } from "@/server/services/expense/expenseService";
import { ReferralService } from "@/server/services/referral/referralService";
import { UserDataService } from "@/server/services/privacy/userDataService";
import { TripController } from "@/server/controllers/TripController";
import { BillingController } from "@/server/controllers/BillingController";
import { SupportController } from "@/server/controllers/SupportController";
import { ExpenseController } from "@/server/controllers/ExpenseController";
import { ReferralController } from "@/server/controllers/ReferralController";
import { SlotProposalController } from "@/server/controllers/SlotProposalController";
import { UserController } from "@/server/controllers/UserController";

const userRepository = new UserRepository();
const tripRepository = new TripRepository();
const paymentRepository = new PaymentRepository();
const supportRepository = new SupportRepository();
const expenseRepository = new ExpenseRepository();
const referralRepository = new ReferralRepository();
const slotProposalRepository = new SlotProposalRepository();

const authService = new AuthService(userRepository);
const tripService = new TripService(authService, tripRepository);
const geoScoreService = new GeoScoreService(tripRepository);
const slotReplaceService = new SlotReplaceService(
  slotProposalRepository,
  geoScoreService,
);
const liveSuggestService = new LiveSuggestService();
const billingService = new BillingService(
  authService,
  tripRepository,
  paymentRepository,
);
const supportService = new SupportService(
  authService,
  supportRepository,
  tripRepository,
);
const expenseService = new ExpenseService(
  authService,
  expenseRepository,
  tripRepository,
);
const referralService = new ReferralService(authService, referralRepository);
const slotProposalService = new SlotProposalService(
  authService,
  slotProposalRepository,
  new SlotProposalResolver(slotProposalRepository, geoScoreService),
);
const userDataService = new UserDataService();

const tripController = new TripController(
  tripService,
  authService,
  slotReplaceService,
  liveSuggestService,
);
const billingController = new BillingController(billingService);
const supportController = new SupportController(supportService);
const expenseController = new ExpenseController(expenseService);
const referralController = new ReferralController(referralService);
const slotProposalController = new SlotProposalController(slotProposalService);
const userController = new UserController(authService, userDataService);

export const container = {
  repositories: {
    userRepository,
    tripRepository,
    paymentRepository,
    supportRepository,
    expenseRepository,
    referralRepository,
    slotProposalRepository,
  },
  services: {
    authService,
    tripService,
    slotReplaceService,
    liveSuggestService,
    billingService,
    supportService,
    expenseService,
    referralService,
    slotProposalService,
    geoScoreService,
    userDataService,
  },
  controllers: {
    tripController,
    billingController,
    supportController,
    expenseController,
    referralController,
    slotProposalController,
    userController,
  },
} as const;
