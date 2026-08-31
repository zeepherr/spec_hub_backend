import multer from "multer";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_LISTING_IMAGES = 5;
const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
  },
});

export const listingImageUpload = multer({
  storage,

  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: MAX_LISTING_IMAGES,
  },
});
