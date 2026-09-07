import { z } from "zod";

export const shippingAddressSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, "Recipient name is required.")
    .max(150),

  phone: z
    .string()
    .trim()
    .min(8, "Phone number is required.")
    .max(30)
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone number format."),

  address: z.string().trim().min(10, "Delivery address is required.").max(500),
});

export const checkoutListingIdsSchema = z
  .array(z.uuid())
  .min(1, "At least one Listing is required.")
  .superRefine((listingIds, ctx) => {
    if (new Set(listingIds).size !== listingIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate Listing IDs are not allowed.",
      });
    }
  });

const setupServiceRequestedSchema = z.boolean().optional().default(false);

// Creates the final Checkout.
export const createCheckoutSchema = z.object({
  listingIds: checkoutListingIdsSchema,
  setupServiceRequested: setupServiceRequestedSchema,
  shippingAddress: shippingAddressSchema,
});

// Calculates pricing without creating a Checkout.
export const checkoutQuoteSchema = z.object({
  listingIds: checkoutListingIdsSchema,
  setupServiceRequested: setupServiceRequestedSchema,
});
