import { z } from "zod";

export const orderStatusSchema = z.enum([
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "SELLER_SHIPPING",
  "INSPECTION_PENDING",
  "INSPECTING",
  "NEEDS_REVIEW",
  "VERIFIED",
  "REJECTED",
  "SHIPPING_TO_BUYER",
  "COMPLETED",
  "CANCELLED",
]);

const adminStatusListSchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}, z.array(orderStatusSchema).min(1).optional());

export const adminOrdersQuerySchema = z.object({
  status: adminStatusListSchema,
});
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

export const completeInspectionSchema = z.object({
  params: orderIdSchema,

  body: z
    .object({
      result: z.enum(["PASSED", "FAILED", "NEEDS_REVIEW"]),

      verifiedCondition: z
        .enum(["LIKE_NEW", "GOOD", "FAIR", "POOR"])
        .optional(),

      verifiedScore: z.coerce
        .number()
        .min(0, "Score must be at least 0.")
        .max(100, "Score must not exceed 100.")
        .optional(),

      notes: z.string().trim().max(2000).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.result === "PASSED") {
        if (!data.verifiedCondition) {
          ctx.addIssue({
            code: "custom",
            path: ["verifiedCondition"],
            message: "Verified condition is required for a passed inspection.",
          });
        }

        if (data.verifiedScore === undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["verifiedScore"],
            message: "Verified score is required for a passed inspection.",
          });
        }
      }

      if (
        (data.result === "FAILED" || data.result === "NEEDS_REVIEW") &&
        !data.notes
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["notes"],
          message:
            "Notes are required for failed or review-required inspections.",
        });
      }
    }),
});

const shippingDetailsSchema = z.object({
  carrier: z.string().trim().min(2, "Carrier is required.").max(100),

  trackingNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .pipe(
      z
        .string()
        .min(5, "Tracking number is too short.")
        .max(100)
        .regex(/^[A-Z0-9-]+$/, "Invalid tracking number format."),
    ),
});

export const shipToAdminSchema = z.object({
  params: orderIdSchema,
  body: shippingDetailsSchema,
});

export const shipToBuyerSchema = z.object({
  params: orderIdSchema,
  body: shippingDetailsSchema,
});

export const shipToSellerSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),

  body: z.object({
    carrier: z.string().trim().min(2, "Carrier is required.").max(100),

    trackingNumber: z
      .string()
      .trim()
      .min(3, "Tracking number is required.")
      .max(150),
  }),
});
