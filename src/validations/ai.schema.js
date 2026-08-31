import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";

const fileSchema = z.object({
  buffer: z.instanceof(Buffer),

  size: z.number().max(5 * 1024 * 1024, "Image must not exceed 5MB"),

  originalname: z.string(),
});

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const aiProductResultSchema = z.object({
  category: z.string().trim().nullable(),

  title: z.string().trim().min(1),

  brand: z.string().trim().nullable(),

  model: z.string().trim().nullable(),

  description: z.string().trim().min(1),
});

export const validateProductImage = async (file) => {
  const result = fileSchema.safeParse(file);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten(),
    };
  }

  const detectedType = await fileTypeFromBuffer(result.data.buffer);

  if (!detectedType || !allowedMimeTypes.has(detectedType.mime)) {
    return {
      success: false,
      errors: {
        formErrors: [],
        fieldErrors: {
          file: ["Only JPEG, PNG, and WEBP images are allowed"],
        },
      },
    };
  }

  return {
    success: true,

    data: {
      ...result.data,
      mimetype: detectedType.mime,
      extension: detectedType.ext,
    },
  };
};

export const analyzeListingConditionParamsSchema = z.object({
  params: z.object({
    listingId: z.uuid(),
  }),
});

export const aiConditionAnalysisSchema = z.object({
  score: z.number().min(0).max(100),

  summary: z.string().trim().min(1).max(1000),
});
