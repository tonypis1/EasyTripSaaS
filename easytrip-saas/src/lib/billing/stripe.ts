import Stripe from "stripe";
import { config } from "@/config/unifiedConfig";

export const stripe = new Stripe(config.billing.stripeSecretKey);

