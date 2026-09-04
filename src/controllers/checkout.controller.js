import { randomUUID } from "crypto";
import createHttpError from "http-errors";

import {
  createCheckoutRecord,
  createOrdersForCheckout,
  findListingsForCheckout,
  reserveActiveListings,
  runCheckoutTransaction,
} from "../services/checkout.service.js";

import {
  calculateCheckoutPricing,
  formatCheckoutPricing,
} from "../services/checkoutPricing.service.js";
import {
  checkoutQuoteSchema,
  createCheckoutSchema,
} from "../validations/checkout.schema.js";

const getCheckoutListingError = (listings, listingIds, buyerId) => {
  if (listings.length !== listingIds.length) {
    return createHttpError(404, "One or more Listings were not found.");
  }

  const buyerOwnedListing = listings.find(
    (listing) => listing.sellerId === buyerId,
  );

  if (buyerOwnedListing) {
    return createHttpError(403, "You cannot purchase your own Listing.");
  }

  const unavailableListing = listings.find(
    (listing) => listing.status !== "ACTIVE",
  );

  if (unavailableListing) {
    return createHttpError(
      409,
      `"${unavailableListing.title}" is no longer available.`,
    );
  }

  return null;
};

// Creates one checkout containing one or more separate orders.
export const quoteCheckout = async (req, res, next) => {
  try {
    const { listingIds } = checkoutQuoteSchema.parse(req.body);

    const buyerId = req.user.id;

    const listings = await findListingsForCheckout(listingIds);

    const listingError = getCheckoutListingError(listings, listingIds, buyerId);

    if (listingError) {
      return next(listingError);
    }

    const pricing = calculateCheckoutPricing(listings);

    return res.status(200).json({
      success: true,
      message: "Checkout quote calculated successfully",
      data: formatCheckoutPricing(pricing),
    });
  } catch (error) {
    return next(error);
  }
};

export const createCheckout = async (req, res, next) => {
  try {
    const { listingIds, shippingAddress } = createCheckoutSchema.parse(
      req.body,
    );

    const buyerId = req.user.id;

    /*
     * Preliminary validation gives the Buyer a clearer
     * error before starting the transaction.
     */
    const listings = await findListingsForCheckout(listingIds);

    const listingError = getCheckoutListingError(listings, listingIds, buyerId);

    if (listingError) {
      return next(listingError);
    }

    const result = await runCheckoutTransaction(async (tx) => {
      /*
       * Atomic reservation protects against two Buyers
       * purchasing the same Listing simultaneously.
       */
      const reservation = await reserveActiveListings(listingIds, tx);

      if (reservation.count !== listingIds.length) {
        throw createHttpError(
          409,
          "One or more Listings are no longer available.",
        );
      }

      /*
       * Read the final locked prices again.
       * This is the authoritative checkout calculation.
       */
      const lockedListings = await findListingsForCheckout(listingIds, tx);

      const pricing = calculateCheckoutPricing(lockedListings);

      const checkout = await createCheckoutRecord(
        {
          buyerId,
          shippingAddress,
          pricing,
        },
        tx,
      );

      const ordersToCreate = lockedListings.map((listing) => ({
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

      const orders = await createOrdersForCheckout(ordersToCreate, tx);

      return {
        checkout,
        orders,
        pricing,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Checkout created successfully",
      data: {
        ...result.checkout,
        pricing: formatCheckoutPricing(result.pricing),
        orders: result.orders,
      },
    });
  } catch (error) {
    return next(error);
  }
};
