import { z } from "zod";

export const aiProductResultSchema = z.object({
  category: z.string().trim().nullable(),

  title: z.string().trim().min(1),

  brand: z.string().trim().nullable(),

  model: z.string().trim().nullable(),

  description: z.string().trim().min(1),
});

const availableMarketPriceSchema = z.object({
  available: z.literal(true),

  recommendedPrice: z.number().int().positive().max(999999999),

  minimumPrice: z.number().int().positive().max(999999999),

  maximumPrice: z.number().int().positive().max(999999999),

  currency: z.literal("THB"),

  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),

  comparablesFound: z.number().int().nonnegative(),

  basis: z.enum([
    "EXACT_SECOND_HAND",
    "SIMILAR_SECOND_HAND",
    "RETAIL_DEPRECIATION",
  ]),

  referenceRetailPrice: z.number().int().positive().max(999999999).nullable(),

  note: z.string().trim().min(1).max(300),
});

const unavailableMarketPriceSchema = z.object({
  available: z.literal(false),
});

const aiMarketPriceSchema = z.discriminatedUnion("available", [
  availableMarketPriceSchema,
  unavailableMarketPriceSchema,
]);

export const aiProductMarketResearchSchema = aiProductResultSchema
  .extend({
    marketPrice: aiMarketPriceSchema,
  })
  .superRefine((result, ctx) => {
    if (!result.marketPrice.available) {
      return;
    }

    const { minimumPrice, recommendedPrice, maximumPrice } = result.marketPrice;

    if (minimumPrice > recommendedPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["marketPrice", "recommendedPrice"],
        message:
          "Recommended price must be greater than or equal to minimum price.",
      });
    }

    if (recommendedPrice > maximumPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["marketPrice", "recommendedPrice"],
        message:
          "Recommended price must be less than or equal to maximum price.",
      });
    }
    if (
      result.marketPrice.basis === "RETAIL_DEPRECIATION" &&
      result.marketPrice.referenceRetailPrice === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["marketPrice", "referenceRetailPrice"],
        message: "Reference retail price is required for retail depreciation.",
      });
    }

    if (
      result.marketPrice.basis !== "RETAIL_DEPRECIATION" &&
      result.marketPrice.referenceRetailPrice !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["marketPrice", "referenceRetailPrice"],
        message:
          "Reference retail price must be null for second-hand comparable pricing.",
      });
    }

    if (
      result.marketPrice.basis === "EXACT_SECOND_HAND" &&
      result.marketPrice.comparablesFound < 3
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["marketPrice", "comparablesFound"],
        message:
          "Exact second-hand pricing requires at least 3 comparable listings.",
      });
    }

    if (
      result.marketPrice.basis === "SIMILAR_SECOND_HAND" &&
      result.marketPrice.comparablesFound < 1
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["marketPrice", "comparablesFound"],
        message:
          "Similar second-hand pricing requires at least 1 comparable listing.",
      });
    }
  });

export const analyzeListingConditionParamsSchema = z.object({
  listingId: z.uuid(),
});

export const aiConditionAnalysisSchema = z.object({
  score: z.number().min(0).max(100),

  summary: z.string().trim().min(1).max(1000),
});
