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

export const toSupportCaseResponse = (supportCase) => {
  if (!supportCase) {
    return supportCase;
  }

  let participantRole = null;

  if (
    supportCase.order &&
    supportCase.participantUserId === supportCase.order.buyerId
  ) {
    participantRole = "BUYER";
  } else if (
    supportCase.order &&
    supportCase.participantUserId === supportCase.order.sellerId
  ) {
    participantRole = "SELLER";
  }

  return {
    ...supportCase,

    participantRole,

    order: supportCase.order
      ? {
          ...supportCase.order,

          listing: supportCase.order.listing
            ? toListingResponse(supportCase.order.listing)
            : null,
        }
      : null,
  };
};
