import { randomUUID } from "crypto";
import createHttpError from "http-errors";

import { MAX_LISTING_IMAGES } from "../middlewares/upload.middleware.js";
import { findListingForConditionAnswers } from "../services/listing.service.js";
import {
  countListingImages,
  createListingImages,
} from "../services/listingImage.service.js";
import { deleteFromR2, uploadToR2 } from "../services/r2.storage.service.js";
import { toListingImageResponse } from "../utils/listingImage.response.js";
import { listingImageParamsSchema } from "../validations/listingImage.schema.js";

const cleanupUploadedImages = async (uploadedKeys) => {
  for (const key of uploadedKeys) {
    try {
      await deleteFromR2(key);
    } catch (error) {
      console.error("Failed to cleanup R2 image:", key, error);
    }
  }
};

export const uploadListingImages = async (req, res, next) => {
  const uploadedKeys = [];

  try {
    const { listingId } = listingImageParamsSchema.parse(req.params);
    const files = req.files;

    if (!Array.isArray(files) || files.length === 0) {
      return next(createHttpError(400, "At least one image is required."));
    }

    const listing = await findListingForConditionAnswers(listingId);

    if (!listing) {
      return next(createHttpError(404, "Listing not found."));
    }

    if (listing.sellerId !== req.user.id) {
      return next(
        createHttpError(403, "You cannot upload images to this listing."),
      );
    }

    if (listing.status !== "DRAFT") {
      return next(
        createHttpError(
          400,
          "Images can only be modified while the listing is a draft.",
        ),
      );
    }

    const existingImageCount = await countListingImages(listingId);

    if (existingImageCount + files.length > MAX_LISTING_IMAGES) {
      return next(
        createHttpError(
          400,
          `A listing can have a maximum of ${MAX_LISTING_IMAGES} images.`,
        ),
      );
    }

    const imageRecords = [];

    for (const [index, file] of files.entries()) {
      const key = `listings/${listingId}/${randomUUID()}.${file.detectedType.ext}`;
      const uploaded = await uploadToR2({
        buffer: file.buffer,
        key,
        contentType: file.detectedType.mime,
      });

      uploadedKeys.push(uploaded.key);
      imageRecords.push({
        listingId,
        imageKey: uploaded.key,
        sortOrder: existingImageCount + index,
        isCover: existingImageCount === 0 && index === 0,
      });
    }

    const savedImages = await createListingImages(imageRecords);

    return res.status(201).json({
      success: true,
      message: "Listing images uploaded successfully",
      data: savedImages.map(toListingImageResponse),
    });
  } catch (error) {
    await cleanupUploadedImages(uploadedKeys);
    return next(error);
  }
};
