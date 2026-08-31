import { z } from "zod";

export const aiProductResultSchema = z.object({
  category: z.string().trim().nullable(),

  title: z.string().trim().min(1),

  brand: z.string().trim().nullable(),

  model: z.string().trim().nullable(),

  description: z.string().trim().min(1),
});

export const analyzeListingConditionParamsSchema = z.object({
  listingId: z.uuid(),
});

export const aiConditionAnalysisSchema = z.object({
  score: z.number().min(0).max(100),

  summary: z.string().trim().min(1).max(1000),
});
