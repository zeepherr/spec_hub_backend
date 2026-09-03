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

export const shipToAdminSchema = z.object({
  params: orderIdSchema,

  body: z.object({
    carrier: z
      .string()
      .trim()
      .min(2, "Carrier must be at least 2 characters.")
      .max(100, "Carrier must not exceed 100 characters."),

    trackingNumber: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, "").toUpperCase())
      .pipe(
        z
          .string()
          .min(5, "Tracking number must be at least 5 characters.")
          .max(100, "Tracking number must not exceed 100 characters.")
          .regex(
            /^[A-Z0-9-]+$/,
            "Tracking number contains invalid characters.",
          ),
      ),
  }),
});
