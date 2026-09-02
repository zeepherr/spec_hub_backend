import { z } from "zod";

// Validates the checkout selected by the buyer when starting payment.
export const createCheckoutPaymentSchema = z.object({
  checkoutId: z.number().int().positive(),
});
