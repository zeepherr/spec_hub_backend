import { toListingImageResponse } from "./listingImage.response.js";

export const toListingResponse = (listing) => {
  const { images, ...rest } = listing;

  if (!Array.isArray(images)) {
    return rest;
  }

  return {
    ...rest,
    images: images.map(toListingImageResponse),
  };
};
