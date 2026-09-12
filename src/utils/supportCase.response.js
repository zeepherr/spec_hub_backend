import { toListingResponse } from "./listing.response.js";

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
