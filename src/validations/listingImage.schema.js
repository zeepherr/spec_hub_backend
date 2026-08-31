import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";

import {
  MAX_IMAGE_SIZE,
  MAX_LISTING_IMAGES,
} from "../middlewares/upload.middleware.js";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const listingImageParamsSchema = z.object({
  params: z.object({
    listingId: z.uuid(),
  }),
});

const uploadedFileSchema = z.object({
  buffer: z.instanceof(Buffer),

  size: z
    .number()
    .positive()
    .max(MAX_IMAGE_SIZE, "Each image must not exceed 5MB"),

  originalname: z.string().min(1),
});

export const validateListingImages = async (files) => {
  if (!Array.isArray(files) || files.length === 0) {
    return {
      success: false,

      errors: {
        formErrors: [],
        fieldErrors: {
          images: ["At least one image is required"],
        },
      },
    };
  }

  if (files.length > MAX_LISTING_IMAGES) {
    return {
      success: false,

      errors: {
        formErrors: [],
        fieldErrors: {
          images: [`Maximum ${MAX_LISTING_IMAGES} images are allowed`],
        },
      },
    };
  }

  const validatedFiles = [];

  for (const file of files) {
    const basicValidation = uploadedFileSchema.safeParse(file);

    if (!basicValidation.success) {
      return {
        success: false,
        errors: basicValidation.error.flatten(),
      };
    }

    const detectedType = await fileTypeFromBuffer(file.buffer);

    if (!detectedType || !allowedImageTypes.has(detectedType.mime)) {
      return {
        success: false,

        errors: {
          formErrors: [],
          fieldErrors: {
            images: [`${file.originalname} must be JPEG, PNG, or WebP`],
          },
        },
      };
    }

    validatedFiles.push({
      ...file,

      detectedType: {
        ext: detectedType.ext,
        mime: detectedType.mime,
      },
    });
  }

  return {
    success: true,
    data: validatedFiles,
  };
};
