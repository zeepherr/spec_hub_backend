import { randomUUID } from "crypto";
import createHttpError from "http-errors";

import {
  createOrder,
  createSellerToAdminShipment,
  findListingForOrder,
  findOrderById,
  findOrderForSellerShipment,
  findOrdersByBuyer,
  findOrdersBySeller,
  markOrderAsSellerShipping,
  reserveActiveListing,
  runOrderTransaction,
} from "../services/order.service.js";

import { toListingResponse } from "../utils/listing.response.js";
import {
  createOrderSchema,
  orderIdSchema,
  shipToAdminSchema,
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

export const getOrderById = async (req, res, next) => {
  const { orderId } = orderIdSchema.parse(req.params);

  const order = await findOrderById(orderId);

  if (!order) {
    return next(createHttpError(404, "Order not found."));
  }

  const isBuyer = order.buyerId === req.user.id;
  const isSeller = order.sellerId === req.user.id;
  const isAdmin = req.user.role === "ADMIN";

  if (!isBuyer && !isSeller && !isAdmin) {
    return next(createHttpError(403, "You cannot access this order."));
  }

  const {
    buyerId,
    sellerId,
    agreedPrice,
    listing,
    buyer,
    seller,
    checkout,
    shipments,
    inspection,
    ...orderData
  } = order;

  const sellerShipment = shipments.find(
    (shipment) => shipment.shipmentType === "SELLER_TO_ADMIN",
  );

  const buyerShipment = shipments.find(
    (shipment) => shipment.shipmentType === "ADMIN_TO_BUYER",
  );

  const normalizedInspection = inspection
    ? {
        ...inspection,

        verifiedScore:
          inspection.verifiedScore === null
            ? null
            : Number(inspection.verifiedScore),
      }
    : null;

  const publicInspection = normalizedInspection
    ? {
        result: normalizedInspection.result,
        verifiedCondition: normalizedInspection.verifiedCondition,
        verifiedScore: normalizedInspection.verifiedScore,
        completedAt: normalizedInspection.completedAt,
      }
    : null;

  const commonData = {
    ...orderData,

    agreedPrice: Number(agreedPrice),

    listing: toListingResponse(listing),
  };

  let data;

  // Admin receives complete order information.
  if (isAdmin) {
    data = {
      ...commonData,

      buyer,
      seller,
      checkout,
      shipments,
      inspection: normalizedInspection,
    };
  }

  // Seller receives buyer-safe information
  // and the seller-to-admin shipment.
  else if (isSeller) {
    data = {
      ...commonData,

      buyer,

      sellerShipment: sellerShipment ?? null,

      buyerDelivery: buyerShipment
        ? {
            status: buyerShipment.status,
            shippedAt: buyerShipment.shippedAt,
            deliveredAt: buyerShipment.deliveredAt,
          }
        : null,

      inspection: normalizedInspection,
    };
  }

  // Buyer receives seller-safe information
  // and the admin-to-buyer shipment.
  else {
    data = {
      ...commonData,

      seller,
      checkout,

      deliveryShipment: buyerShipment ?? null,

      inspection: publicInspection,
    };
  }

  return res.status(200).json({
    success: true,
    message: "Order fetched successfully",
    data,
  });
};

export const getSellingOrders = async (req, res) => {
  const orders = await findOrdersBySeller(req.user.id);

  const data = orders.map(
    ({ agreedPrice, listing, shipments, inspection, ...order }) => {
      const sellerShipment = shipments.find(
        (shipment) => shipment.shipmentType === "SELLER_TO_ADMIN",
      );

      const buyerShipment = shipments.find(
        (shipment) => shipment.shipmentType === "ADMIN_TO_BUYER",
      );

      return {
        ...order,

        agreedPrice: Number(agreedPrice),

        listing: toListingResponse(listing),

        sellerShipment: sellerShipment ?? null,

        // Seller can see delivery progress,
        // but not the buyer shipment tracking number.
        buyerDelivery: buyerShipment
          ? {
              status: buyerShipment.status,
              shippedAt: buyerShipment.shippedAt,
              deliveredAt: buyerShipment.deliveredAt,
            }
          : null,

        inspection: inspection
          ? {
              ...inspection,
              verifiedScore:
                inspection.verifiedScore === null
                  ? null
                  : Number(inspection.verifiedScore),
            }
          : null,
      };
    },
  );

  return res.status(200).json({
    success: true,
    message: "Selling orders fetched successfully",
    data,
  });
};

export const shipOrderToAdmin = async (req, res, next) => {
  const validation = shipToAdminSchema.parse({
    params: req.params,
    body: req.body,
  });

  const { orderId } = validation.params;
  const { carrier, trackingNumber } = validation.body;

  const sellerId = req.user.id;

  try {
    const result = await runOrderTransaction(async (tx) => {
      const order = await findOrderForSellerShipment(orderId, tx);

      if (!order) {
        throw createHttpError(404, "Order not found.");
      }

      if (order.sellerId !== sellerId) {
        throw createHttpError(403, "You cannot ship this order.");
      }

      if (order.shipments.length > 0) {
        throw createHttpError(
          409,
          "Shipping information has already been submitted.",
        );
      }

      if (order.status !== "PAID") {
        throw createHttpError(409, "Only paid orders can be shipped to admin.");
      }

      const orderUpdate = await markOrderAsSellerShipping(
        orderId,
        sellerId,
        tx,
      );

      if (orderUpdate.count !== 1) {
        throw createHttpError(
          409,
          "The order status has already changed. Please refresh and try again.",
        );
      }

      const shippedAt = new Date();

      const shipment = await createSellerToAdminShipment(
        {
          orderId,
          carrier,
          trackingNumber,
          shippedAt,
        },
        tx,
      );

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: "SELLER_SHIPPING",
        shipment,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Shipping information submitted successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
