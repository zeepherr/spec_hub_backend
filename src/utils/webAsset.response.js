import { getR2PublicUrl } from "../services/r2.storage.service.js";

export const toWebAssetResponse = (webAsset) => {
  return {
    id: webAsset?.id ?? 1,

    coverImageUrl: getR2PublicUrl(webAsset?.coverImageKey),

    promotionImageUrl: getR2PublicUrl(webAsset?.promotionImageKey),

    homeImageUrl: getR2PublicUrl(webAsset?.homeImageKey),

    bannerImageUrl: getR2PublicUrl(webAsset?.bannerImageKey),

    updatedAt: webAsset?.updatedAt ?? null,
  };
};
