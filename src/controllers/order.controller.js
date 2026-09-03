import { randomUUID } from "crypto";
import createHttpError from "http-errors";

import {
  createOrder,
  findListingForOrder,
  reserveActiveListing,
  runOrderTransaction,
} from "../services/order.service.js";

import { createOrderSchema } from "../validations/order.schema.js";

// Creates a new order and reserves the listing for the buyer.
export const createNewOrder = async (req, res, next) => {
  const { listingId } = createOrderSchema.parse(req.body);

  const buyerId = req.user.id;

  const order = await runOrderTransaction(async (tx) => {
    const listing = await findListingForOrder(listingId, tx);

    if (!listing) {
      throw createHttpError(404, "Listing not found.");
    }

    if (listing.sellerId === buyerId) {
      throw createHttpError(403, "You cannot buy your own listing.");
    }

    if (listing.status !== "ACTIVE") {
      throw createHttpError(409, "This listing is no longer available.");
    }

    const reservation = await reserveActiveListing(listingId, tx);

    if (reservation.count !== 1) {
      throw createHttpError(409, "This listing is no longer available.");
    }

    const orderNumber = `ORD-${Date.now()}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    return await createOrder(
      {
        orderNumber,
        listingId: listing.id,
        buyerId,
        sellerId: listing.sellerId,
        agreedPrice: listing.price,
        status: "AWAITING_PAYMENT",
      },
      tx,
    );
  });

  return res.status(201).json({
    message: "Order created successfully",
    data: order,
  });
};
