import { z } from "zod";
import { SubscriptionPlan } from "../../../generated/prisma/enums";

export const initiatePaymentSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
  plan: z.enum([SubscriptionPlan.PRO, SubscriptionPlan.TEAM]),
});

export const executePaymentSchema = z.object({
  paymentID: z.string().min(1, "paymentID is required"),
});

export const callbackQuerySchema = z.object({
  paymentID: z.string().optional(),
  status: z.string().optional(),
});

export const PaymentValidation = {
  initiatePaymentSchema,
  executePaymentSchema,
  callbackQuerySchema,
};
