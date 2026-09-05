import { z } from "zod";

export const refundIdSchema = z.object({
  refundId: z.coerce
    .number()
    .int("Refund ID must be an integer.")
    .positive("Refund ID must be positive."),
});
