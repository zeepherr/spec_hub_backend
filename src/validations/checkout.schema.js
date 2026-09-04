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
// Validates one or more listings selected by the buyer for checkout.
export const createCheckoutSchema = z.object({
  // listingIds: z
  //   .array(z.uuid())
  //   .min(1, "At least one listing is required.")
  //   .refine((listingIds) => new Set(listingIds).size === listingIds.length, {
  //     message: "Duplicate listings are not allowed.",
  //   }),
  listingIds: checkoutListingIdsSchema,
  shippingAddress: shippingAddressSchema,
});

export const checkoutQuoteSchema = z.object({
  listingIds: checkoutListingIdsSchema,
});
