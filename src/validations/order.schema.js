import { z } from "zod";

// Validates the listing selected by the buyer when creating an order.
export const createOrderSchema = z.object({
  listingId: z.uuid(),
});
