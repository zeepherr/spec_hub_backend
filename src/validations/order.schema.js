import { z } from "zod";

// Validates the listing selected by the buyer when creating an order.
export const createOrderSchema = z.object({
  listingId: z.uuid(),
});

export const orderIdSchema = z.object({
  orderId: z.coerce
    .number()
    .int("Order ID must be an integer.")
    .positive("Order ID must be positive."),
});
