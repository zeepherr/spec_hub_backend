import createHttpError from "http-errors";
import { randomUUID } from "node:crypto";

import {
  clearWebAssetImage,
  findWebAsset,
  upsertWebAssetImage,
} from "../services/webAsset.service.js";

import { deleteFromR2, uploadToR2 } from "../services/r2.storage.service.js";

import { toWebAssetResponse } from "../utils/webAsset.response.js";
import { webAssetSlotSchema } from "../validations/webAsset.schema.js";

const WEB_ASSET_FIELD_BY_SLOT = Object.freeze({
  cover: "coverImageKey",
  promotion: "promotionImageKey",
  home: "homeImageKey",
  banner: "bannerImageKey",
});

/*
 * GET /api/web-assets
 *
 * Public route used by homepage and authentication pages.
 */
export const getWebAssets = async (req, res, next) => {
  try {
    const webAsset = await findWebAsset();

    return res.status(200).json({
      success: true,
      message: "Website images fetched successfully.",
      data: toWebAssetResponse(webAsset),
    });
  } catch (error) {
    return next(error);
  }
};

/*
 * PUT /api/admin/web-assets/:slot
 *
 * Admin uploads or replaces one website image.
 */
export const replaceWebAssetImage = async (req, res, next) => {
  let uploadedKey = null;

  try {
    const { slot } = webAssetSlotSchema.parse(req.params);

    if (!req.file) {
      throw createHttpError(400, "Image is required.");
    }

    const imageField = WEB_ASSET_FIELD_BY_SLOT[slot];

    const existingWebAsset = await findWebAsset();

    const previousImageKey = existingWebAsset?.[imageField] ?? null;

    const imageKey =
      `web-assets/${slot}/` + `${randomUUID()}.${req.file.detectedType.ext}`;

    const uploadedImage = await uploadToR2({
      buffer: req.file.buffer,
      key: imageKey,
      contentType: req.file.detectedType.mime,
    });

    uploadedKey = uploadedImage.key;

    const updatedWebAsset = await upsertWebAssetImage({
      imageField,
      imageKey: uploadedImage.key,
      updatedById: req.user.id,
    });

    /*
     * Database now points to the new image.
     * Do not remove it if old-image cleanup fails.
     */
    uploadedKey = null;

    if (previousImageKey && previousImageKey !== uploadedImage.key) {
      try {
        await deleteFromR2(previousImageKey);
      } catch (cleanupError) {
        console.error(
          "Failed to remove previous website image:",
          previousImageKey,
          cleanupError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `${slot} image updated successfully.`,
      data: toWebAssetResponse(updatedWebAsset),
    });
  } catch (error) {
    /*
     * R2 upload succeeded but database update failed.
     */
    if (uploadedKey) {
      try {
        await deleteFromR2(uploadedKey);
      } catch (cleanupError) {
        console.error(
          "Failed to cleanup new website image:",
          uploadedKey,
          cleanupError,
        );
      }
    }

    return next(error);
  }
};

/*
 * DELETE /api/admin/web-assets/:slot
 *
 * Clears one image without deleting the singleton row.
 */
export const deleteWebAssetImage = async (req, res, next) => {
  try {
    const { slot } = webAssetSlotSchema.parse(req.params);

    const imageField = WEB_ASSET_FIELD_BY_SLOT[slot];

    const existingWebAsset = await findWebAsset();

    const previousImageKey = existingWebAsset?.[imageField] ?? null;

    if (!previousImageKey) {
      return res.status(200).json({
        success: true,
        message: `${slot} image is already empty.`,
        data: toWebAssetResponse(existingWebAsset),
      });
    }

    /*
     * Remove the database reference first.
     * The frontend will stop displaying the image immediately.
     */
    const updatedWebAsset = await clearWebAssetImage({
      imageField,
      updatedById: req.user.id,
    });

    try {
      await deleteFromR2(previousImageKey);
    } catch (cleanupError) {
      /*
       * The database is already safe.
       * The remaining R2 file is only an orphan.
       */
      console.error(
        "Failed to remove website image from R2:",
        previousImageKey,
        cleanupError,
      );
    }

    return res.status(200).json({
      success: true,
      message: `${slot} image deleted successfully.`,
      data: toWebAssetResponse(updatedWebAsset),
    });
  } catch (error) {
    return next(error);
  }
};
