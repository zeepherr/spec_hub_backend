import { z } from "zod";

// Validates the order selected by the buyer when starting payment.
export const createCheckoutSchema = z.object({
  orderId: z.number().int().positive(),
});
