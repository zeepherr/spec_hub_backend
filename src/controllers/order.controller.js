import { randomUUID } from "crypto";
import createHttpError from "http-errors";

import {
  createOrder,
  findListingForOrder,
  findOrderById,
  findOrdersByBuyer,
  reserveActiveListing,
  runOrderTransaction,
} from "../services/order.service.js";

import { toListingResponse } from "../utils/listing.response.js";
import {
  createOrderSchema,
  orderIdSchema,
} from "../validations/order.schema.js";

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

export const getBuyingOrders = async (req, res) => {
  const orders = await findOrdersByBuyer(req.user.id);

  const data = orders.map(({ agreedPrice, listing, shipments, ...order }) => ({
    ...order,

    agreedPrice: Number(agreedPrice),

    listing: toListingResponse(listing),

    deliveryShipment: shipments[0] ?? null,
  }));

  return res.status(200).json({
    success: true,
    message: "Buying orders fetched successfully",
    data,
  });
};

export const getBuyerOrderById = async (req, res, next) => {
  const { orderId } = orderIdSchema.parse(req.params);

  const order = await findOrderById(orderId);

  if (!order) {
    return next(createHttpError(404, "Order not found."));
  }

  if (order.buyerId !== req.user.id) {
    return next(createHttpError(403, "You cannot access this order."));
  }

  const {
    buyerId,
    sellerId,
    agreedPrice,
    listing,
    shipments,
    inspection,
    ...orderData
  } = order;

  return res.status(200).json({
    success: true,
    message: "Order fetched successfully",
    data: {
      ...orderData,

      agreedPrice: Number(agreedPrice),

      listing: toListingResponse(listing),

      seller: orderData.seller,

      deliveryShipment: shipments[0] ?? null,

      inspection: inspection
        ? {
            ...inspection,
            verifiedScore:
              inspection.verifiedScore === null
                ? null
                : Number(inspection.verifiedScore),
          }
        : null,
    },
  });
};
