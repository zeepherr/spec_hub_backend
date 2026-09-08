import { toListingResponse } from "./listing.response.js";

export const toSupportCaseResponse = (supportCase) => {
  if (!supportCase) {
    return supportCase;
  }

  return {
    ...supportCase,

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
