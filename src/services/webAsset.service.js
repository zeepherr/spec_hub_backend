import { prisma } from "../lib/prisma.js";

export const WEB_ASSET_ID = 1;

const webAssetSelect = {
  id: true,
  coverImageKey: true,
  promotionImageKey: true,
  homeImageKey: true,
  bannerImageKey: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
};

export const findWebAsset = (db = prisma) => {
  return db.webAsset.findUnique({
    where: {
      id: WEB_ASSET_ID,
    },
    select: webAssetSelect,
  });
};

export const upsertWebAssetImage = (
  { imageField, imageKey, updatedById },
  db = prisma,
) => {
  return db.webAsset.upsert({
    where: {
      id: WEB_ASSET_ID,
    },

    create: {
      id: WEB_ASSET_ID,
      [imageField]: imageKey,
      updatedById,
    },

    update: {
      [imageField]: imageKey,
      updatedById,
    },

    select: webAssetSelect,
  });
};

export const clearWebAssetImage = (
  { imageField, updatedById },
  db = prisma,
) => {
  return db.webAsset.upsert({
    where: {
      id: WEB_ASSET_ID,
    },

    create: {
      id: WEB_ASSET_ID,
      [imageField]: null,
      updatedById,
    },

    update: {
      [imageField]: null,
      updatedById,
    },

    select: webAssetSelect,
  });
};
