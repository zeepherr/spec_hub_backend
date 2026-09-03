import { z } from "zod";

// Validates the checkout selected by the buyer when starting payment.
export const createCheckoutPaymentSchema = z.object({
  checkoutId: z.number().int().positive(),
});
export const paymentSessionSchema = z.object({
  sessionId: z.string().trim().min(1),
});
