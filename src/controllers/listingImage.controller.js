import { randomUUID } from "crypto";

import {
  countListingImages,
  createListingImages,
} from "../services/listingImage.service.js";

import { findListingForConditionAnswers } from "../services/listing.service.js";

import { deleteFromR2, uploadToR2 } from "../services/r2.storage.service.js";

import {
  listingImageParamsSchema,
  validateListingImages,
} from "../validations/listingImage.schema.js";

import { MAX_LISTING_IMAGES } from "../middlewares/upload.middleware.js";
import { toListingImageResponse } from "../utils/listingImage.response.js";
export const uploadListingImages = async (req, res, next) => {
  /*
   * Keep uploaded R2 keys so we can clean them
   * if something later fails.
   */
  const uploadedKeys = [];

  try {
    /*
    |--------------------------------------------------------------------------
    | 1. Validate listingId
    |--------------------------------------------------------------------------
    */

    const paramsValidation = listingImageParamsSchema.safeParse({
      params: req.params,
    });

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid listing id",
        errors: paramsValidation.error.flatten(),
      });
    }

    const { listingId } = paramsValidation.data.params;

    /*
    |--------------------------------------------------------------------------
    | 2. Validate uploaded images
    |--------------------------------------------------------------------------
    */

    const imageValidation = await validateListingImages(req.files);

    if (!imageValidation.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid listing images",
        errors: imageValidation.errors,
      });
    }

    const files = imageValidation.data;

    /*
    |--------------------------------------------------------------------------
    | 3. Find listing
    |--------------------------------------------------------------------------
    */

    const listing = await findListingForConditionAnswers(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        code: "LISTING_NOT_FOUND",
        message: "Listing not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 4. Ownership
    |--------------------------------------------------------------------------
    */

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You cannot upload images to this listing",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 5. Only DRAFT
    |--------------------------------------------------------------------------
    */

    if (listing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        code: "LISTING_NOT_EDITABLE",
        message: "Images can only be modified while the listing is a draft",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 6. Check total image limit
    |--------------------------------------------------------------------------
    */

    const existingImageCount = await countListingImages(listingId);

    if (existingImageCount + files.length > MAX_LISTING_IMAGES) {
      return res.status(400).json({
        success: false,
        code: "IMAGE_LIMIT_EXCEEDED",
        message: `A listing can have a maximum of ${MAX_LISTING_IMAGES} images`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 7. Upload images to R2
    |--------------------------------------------------------------------------
    */

    const imageRecords = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];

      const key =
        `listings/${listingId}/` + `${randomUUID()}.${file.detectedType.ext}`;

      const uploaded = await uploadToR2({
        buffer: file.buffer,
        key,
        contentType: file.detectedType.mime,
      });

      uploadedKeys.push(uploaded.key);

      /*
       * First image becomes cover only when
       * listing currently has no images.
       */
      const isCover = existingImageCount === 0 && index === 0;

      imageRecords.push({
        listingId,

        imageKey: uploaded.key,

        sortOrder: existingImageCount + index,

        isCover,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 8. Save image records to DB
    |--------------------------------------------------------------------------
    */

    let savedImages;

    try {
      savedImages = await createListingImages(imageRecords);
    } catch (error) {
      /*
       * R2 succeeded but DB failed.
       *
       * Clean all newly uploaded R2 objects.
       */

      for (const key of uploadedKeys) {
        try {
          await deleteFromR2(key);
        } catch (cleanupError) {
          console.error("Failed to cleanup R2 image:", key, cleanupError);
        }
      }

      return next(error);
    }

    /*
    |--------------------------------------------------------------------------
    | 9. Return images with public URLs
    |--------------------------------------------------------------------------
    */

    return res.status(201).json({
      success: true,

      message: "Listing images uploaded successfully",

      data: savedImages.map(toListingImageResponse),
    });
  } catch (error) {
    /*
     * If R2 upload fails halfway:
     *
     * Example:
     * image1 ✅
     * image2 ✅
     * image3 ❌
     *
     * Remove image1 + image2 from R2.
     */

    for (const key of uploadedKeys) {
      try {
        await deleteFromR2(key);
      } catch (cleanupError) {
        console.error("Failed to cleanup R2 image:", key, cleanupError);
      }
    }

    next(error);
  }
};
