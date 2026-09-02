import { z } from "zod";

// Validates one or more listings selected by the buyer for checkout.
export const createCheckoutSchema = z.object({
  listingIds: z
    .array(z.uuid())
    .min(1, "At least one listing is required.")
    .refine((listingIds) => new Set(listingIds).size === listingIds.length, {
      message: "Duplicate listings are not allowed.",
    }),
});
