import { getR2PublicUrl } from "../services/r2.storage.service.js";

export const toListingImageResponse = (image) => {
  const { imageKey, ...rest } = image;

  return {
    ...rest,
    imageUrl: getR2PublicUrl(imageKey),
  };
};
