import { randomUUID } from "crypto";
import createHttpError from "http-errors";

import {
  createCheckoutRecord,
  createOrdersForCheckout,
  findListingsForCheckout,
  reserveActiveListings,
  runCheckoutTransaction,
} from "../services/checkout.service.js";

import { createCheckoutSchema } from "../validations/checkout.schema.js";

// Creates one checkout containing one or more separate orders.
export const createCheckout = async (req, res, next) => {
  const { listingIds, shippingAddress } = createCheckoutSchema.parse(req.body);

  const buyerId = req.user.id;

  const listings = await findListingsForCheckout(listingIds);

  if (listings.length !== listingIds.length) {
    return next(createHttpError(404, "One or more listings were not found."));
  }

  const ownListing = listings.some((listing) => listing.sellerId === buyerId);

  if (ownListing) {
    return next(createHttpError(403, "You cannot buy your own listing."));
  }

  const unavailableListing = listings.some(
    (listing) => listing.status !== "ACTIVE",
  );

  if (unavailableListing) {
    return next(
      createHttpError(409, "One or more listings are no longer available."),
    );
  }

  let result;

  try {
    result = await runCheckoutTransaction(async (tx) => {
      const reservation = await reserveActiveListings(listingIds, tx);

      if (reservation.count !== listingIds.length) {
        throw createHttpError(
          409,
          "One or more listings are no longer available.",
        );
      }

      const checkout = await createCheckoutRecord(buyerId, shippingAddress, tx);

      const ordersData = listings.map((listing) => ({
        orderNumber: `ORD-${Date.now()}-${randomUUID()
          .slice(0, 8)
          .toUpperCase()}`,
        checkoutId: checkout.id,
        listingId: listing.id,
        buyerId,
        sellerId: listing.sellerId,
        agreedPrice: listing.price,
        status: "AWAITING_PAYMENT",
        lockedAt: new Date(),
      }));

      const orders = await createOrdersForCheckout(ordersData, tx);

      return {
        ...checkout,
        orders,
      };
    });
  } catch (error) {
    return next(error);
  }

  return res.status(201).json({
    message: "Checkout created successfully",
    data: result,
  });
};
