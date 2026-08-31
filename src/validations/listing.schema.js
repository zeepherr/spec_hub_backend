import { z } from "zod";

export const createListingSchema = z.object({
  categoryId: z.coerce.number().int().positive(),

  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(150, "Title must not exceed 150 characters"),

  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(3000, "Description must not exceed 3000 characters"),

  brand: z.string().trim().min(1, "Brand is required").max(100),

  model: z.string().trim().min(1, "Model is required").max(150),

  price: z.coerce.number().positive("Price must be greater than 0"),

  location: z.string().trim().min(2, "Location is required").max(150),
});

export const listingIdSchema = z.object({
  listingId: z.uuid(),
});

export const updateListingSchema = z.object({
  params: z.object({
    listingId: z.uuid(),
  }),

  body: z
    .object({
      categoryId: z.coerce.number().int().positive().optional(),

      title: z.string().trim().min(5).max(150).optional(),

      description: z.string().trim().min(10).max(3000).optional(),

      brand: z.string().trim().min(1).max(100).optional(),

      model: z.string().trim().min(1).max(150).optional(),

      price: z.coerce.number().positive().optional(),

      location: z.string().trim().min(2).max(150).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});
