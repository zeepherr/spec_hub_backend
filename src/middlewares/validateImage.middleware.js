import { fileTypeFromBuffer } from "file-type";
import createHttpError from "http-errors";

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const unsupportedImageError = () =>
  createHttpError(415, "Only JPEG, PNG, and WebP images are allowed.");

export const validateImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(createHttpError(400, "Image is required."));
    }

    const detectedType = await fileTypeFromBuffer(req.file.buffer);

    if (!detectedType || !allowedImageTypes.has(detectedType.mime)) {
      return next(unsupportedImageError());
    }

    req.file.detectedType = detectedType;

    return next();
  } catch (error) {
    return next(error);
  }
};

export const validateImages = async (req, res, next) => {
  try {
    if (!Array.isArray(req.files) || req.files.length === 0) {
      return next(createHttpError(400, "At least one image is required."));
    }

    for (const file of req.files) {
      const detectedType = await fileTypeFromBuffer(file.buffer);

      if (!detectedType || !allowedImageTypes.has(detectedType.mime)) {
        return next(unsupportedImageError());
      }

      file.detectedType = detectedType;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
