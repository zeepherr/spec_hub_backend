import { prisma } from "../lib/prisma.js";

export const countListingImages = (listingId) => {
  return prisma.listingImage.count({
    where: {
      listingId,
    },
  });
};

export const createListingImages = (images) => {
  return prisma.$transaction(
    images.map((image) =>
      prisma.listingImage.create({
        data: image,
      }),
    ),
  );
};

export const findListingImageById = (listingId, imageId) => {
  return prisma.listingImage.findFirst({
    where: {
      id: imageId,
      listingId,
    },
  });
};

export const deleteListingImageById = (imageId) => {
  return prisma.listingImage.delete({
    where: {
      id: imageId,
    },
  });
};
