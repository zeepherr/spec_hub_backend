import { randomUUID } from "crypto";
import createHttpError from "http-errors";

import {
  completeOrderInspection,
  createAdminToBuyerShipment,
  createAdminToSellerShipment,
  createOrder,
  createOrderInspection,
  createSellerToAdminShipment,
  findBuyerShipmentByOrderId,
  findInspectionById,
  findListingForOrder,
  findOrderById,
  findOrderForAdminReceipt,
  findOrderForBuyerShipment,
  findOrderForDeliveryConfirmation,
  findOrderForInspectionCompletion,
  findOrderForInspectionStart,
  findOrderForReturnToSeller,
  findOrderForSellerShipment,
  findOrdersByBuyer,
  findOrdersBySeller,
  findOrdersForAdmin,
  findReturnShipmentByOrderId,
  findSellerShipmentByOrderId,
  markBuyerShipmentDelivered,
  markListingRejected,
  markListingSold,
  markOrderAfterInspection,
  markOrderAsSellerShipping,
  markOrderAsShippingToBuyer,
  markOrderCompleted,
  markOrderInspecting,
  markOrderInspectionPending,
  markSellerShipmentDelivered,
  reserveActiveListing,
  runOrderTransaction,
} from "../services/order.service.js";

import { toListingResponse } from "../utils/listing.response.js";
import {
  toAdminRefundResponse,
  toBuyerPaymentResponse,
  toBuyerRefundResponse,
} from "../utils/order.helper.js";
import {
  adminOrdersQuerySchema,
  completeInspectionSchema,
  createOrderSchema,
  orderIdSchema,
  shipToAdminSchema,
  shipToBuyerSchema,
  shipToSellerSchema,
} from "../validations/order.schema.js";
import { releaseCheckoutPaymentIfReady } from "./checkoutSettlement.controller.js";
import { prepareAndExecuteCheckoutRefund } from "./refund.controller.js";

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

  const data = orders.map(
    ({ agreedPrice, listing, shipments, checkout, ...order }) => ({
      ...order,

      agreedPrice: Number(agreedPrice),

      listing: toListingResponse(listing),

      checkout: checkout
        ? {
            id: checkout.id,

            status: checkout.status,

            payment: toBuyerPaymentResponse(checkout.payment),

            /*
             * Refund belongs to the whole Checkout,
             * not one individual Order.
             */
            refund: toBuyerRefundResponse(checkout.refund),
          }
        : null,

      deliveryShipment: shipments[0] ?? null,
    }),
  );

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

  /*
   * Shipment directions
   */
  const sellerShipment =
    shipments.find((shipment) => shipment.shipmentType === "SELLER_TO_ADMIN") ??
    null;

  const buyerShipment =
    shipments.find((shipment) => shipment.shipmentType === "ADMIN_TO_BUYER") ??
    null;

  const returnShipment =
    shipments.find((shipment) => shipment.shipmentType === "ADMIN_TO_SELLER") ??
    null;

  /*
   * Safe public identities.
   */
  const safeBuyer = buyer
    ? {
        id: buyer.id,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
      }
    : null;

  const safeSeller = seller
    ? {
        id: seller.id,
        firstName: seller.firstName,
        lastName: seller.lastName,
      }
    : null;

  /*
   * Buyer delivery address.
   *
   * Seller must NEVER receive this.
   */
  const deliveryAddress =
    checkout?.shippingRecipientName &&
    checkout?.shippingPhone &&
    checkout?.shippingAddress
      ? {
          recipientName: checkout.shippingRecipientName,

          phone: checkout.shippingPhone,

          address: checkout.shippingAddress,
        }
      : null;

  /*
   * Inspection normalization.
   */
  const normalizedInspection = inspection
    ? {
        ...inspection,

        verifiedScore:
          inspection.verifiedScore === null
            ? null
            : Number(inspection.verifiedScore),
      }
    : null;

  /*
   * Buyer-safe inspection.
   *
   * Internal Admin notes are intentionally
   * not exposed to Buyer.
   */
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

  /*
   * ADMIN
   *
   * Full operational view.
   */
  if (isAdmin) {
    data = {
      ...commonData,

      buyer,
      seller,

      checkout: checkout
        ? {
            id: checkout.id,

            status: checkout.status,

            payment: checkout.payment
              ? {
                  ...checkout.payment,

                  refundedAmount: Number(checkout.payment.refundedAmount ?? 0),
                }
              : null,

            refund: toAdminRefundResponse(checkout.refund),
          }
        : null,

      deliveryAddress,

      /*
       * Admin sees every shipment direction.
       */
      shipments,

      inspection: normalizedInspection,
    };
  } else if (isSeller) {
    /*
     * SELLER
     */
    data = {
      ...commonData,

      buyer: safeBuyer,

      /*
       * Seller only needs confirmation that
       * payment existed.
       *
       * Refund amount/provider data is hidden.
       */
      buyerPayment: checkout?.payment
        ? {
            status: checkout.payment.status,

            paidAt: checkout.payment.paidAt,
          }
        : null,

      /*
       * Seller → Admin shipment.
       */
      sellerShipment,

      /*
       * Seller may see Buyer delivery progress
       * but NEVER Buyer tracking number/address.
       */
      buyerDelivery: buyerShipment
        ? {
            status: buyerShipment.status,

            shippedAt: buyerShipment.shippedAt,

            deliveredAt: buyerShipment.deliveredAt,
          }
        : null,

      /*
       * Rejected product coming back
       * from Admin to this Seller.
       */
      returnShipment,

      /*
       * Seller needs the failed inspection reason,
       * including Admin notes.
       */
      inspection: normalizedInspection,
    };
  } else {
    /*
     * BUYER
     */
    data = {
      ...commonData,

      seller: safeSeller,

      checkout: checkout
        ? {
            id: checkout.id,

            status: checkout.status,

            payment: toBuyerPaymentResponse(checkout.payment),

            refund: toBuyerRefundResponse(checkout.refund),
          }
        : null,

      deliveryAddress,

      /*
       * Buyer only sees shipment going to Buyer.
       */
      deliveryShipment: buyerShipment,

      /*
       * Buyer does NOT see internal Admin notes.
       */
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
      const sellerShipment =
        shipments.find(
          (shipment) => shipment.shipmentType === "SELLER_TO_ADMIN",
        ) ?? null;

      const buyerShipment =
        shipments.find(
          (shipment) => shipment.shipmentType === "ADMIN_TO_BUYER",
        ) ?? null;

      const returnShipment =
        shipments.find(
          (shipment) => shipment.shipmentType === "ADMIN_TO_SELLER",
        ) ?? null;

      return {
        ...order,

        agreedPrice: Number(agreedPrice),

        listing: toListingResponse(listing),

        /*
         * Seller → Admin
         */
        sellerShipment,

        /*
         * Seller cannot see Buyer tracking.
         */
        buyerDelivery: buyerShipment
          ? {
              status: buyerShipment.status,

              shippedAt: buyerShipment.shippedAt,

              deliveredAt: buyerShipment.deliveredAt,
            }
          : null,

        /*
         * Admin → Seller return.
         */
        returnShipment,

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

export const getAdminOrders = async (req, res, next) => {
  const { status: statuses } = adminOrdersQuerySchema.parse(req.query);

  const orders = await findOrdersForAdmin(statuses);

  const data = orders.map((order) => ({
    ...order,

    agreedPrice: Number(order.agreedPrice),

    listing: toListingResponse(order.listing),

    checkout: order.checkout
      ? {
          ...order.checkout,

          payment: order.checkout.payment
            ? {
                ...order.checkout.payment,

                amount: Number(order.checkout.payment.amount),

                refundedAmount: Number(
                  order.checkout.payment.refundedAmount ?? 0,
                ),
              }
            : null,

          refund: toAdminRefundResponse(order.checkout.refund),
        }
      : null,

    inspection: order.inspection
      ? {
          ...order.inspection,

          verifiedScore:
            order.inspection.verifiedScore !== null
              ? Number(order.inspection.verifiedScore)
              : null,
        }
      : null,
  }));

  return res.status(200).json({
    success: true,

    message: "Admin orders fetched successfully",

    data,
  });
};

export const receiveOrderFromSeller = async (req, res, next) => {
  const { orderId } = orderIdSchema.parse(req.params);

  try {
    const result = await runOrderTransaction(async (tx) => {
      const order = await findOrderForAdminReceipt(orderId, tx);

      if (!order) {
        throw createHttpError(404, "Order not found.");
      }

      if (order.status !== "SELLER_SHIPPING") {
        throw createHttpError(
          409,
          "This order is not waiting for Admin receipt.",
        );
      }

      const sellerShipment = order.shipments[0];

      if (!sellerShipment) {
        throw createHttpError(
          409,
          "Seller shipment information was not found.",
        );
      }

      if (
        sellerShipment.status !== "SHIPPED" &&
        sellerShipment.status !== "IN_TRANSIT"
      ) {
        throw createHttpError(
          409,
          "This shipment cannot be received in its current status.",
        );
      }

      // Conditional update prevents two Admin requests
      // from receiving the same parcel simultaneously.
      const orderUpdate = await markOrderInspectionPending(orderId, tx);

      if (orderUpdate.count !== 1) {
        throw createHttpError(
          409,
          "The order status has already changed. Please refresh and try again.",
        );
      }

      const deliveredAt = new Date();

      const shipmentUpdate = await markSellerShipmentDelivered(
        orderId,
        deliveredAt,
        tx,
      );

      if (shipmentUpdate.count !== 1) {
        throw createHttpError(409, "The shipment status has already changed.");
      }

      const updatedShipment = await findSellerShipmentByOrderId(orderId, tx);

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: "INSPECTION_PENDING",
        sellerShipment: updatedShipment,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Parcel received successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const startOrderInspection = async (req, res, next) => {
  const { orderId } = orderIdSchema.parse(req.params);

  const adminId = req.user.id;

  try {
    const result = await runOrderTransaction(async (tx) => {
      const order = await findOrderForInspectionStart(orderId, tx);

      if (!order) {
        throw createHttpError(404, "Order not found.");
      }

      if (order.inspection) {
        throw createHttpError(409, "Inspection has already been started.");
      }

      if (order.status !== "INSPECTION_PENDING") {
        throw createHttpError(409, "This order is not ready for inspection.");
      }

      // Conditional update prevents two Admins from
      // starting the same inspection simultaneously.
      const orderUpdate = await markOrderInspecting(orderId, tx);

      if (orderUpdate.count !== 1) {
        throw createHttpError(
          409,
          "The order status has already changed. Please refresh and try again.",
        );
      }

      const inspection = await createOrderInspection(
        {
          orderId,
          adminId,
          startedAt: new Date(),
        },
        tx,
      );

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: "INSPECTING",
        inspection: {
          ...inspection,

          verifiedScore:
            inspection.verifiedScore !== null
              ? Number(inspection.verifiedScore)
              : null,
        },
      };
    });

    return res.status(201).json({
      success: true,
      message: "Inspection started successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const completeInspection = async (req, res, next) => {
  const validation = completeInspectionSchema.parse({
    params: req.params,
    body: req.body,
  });

  const { orderId } = validation.params;
  const inspectionData = validation.body;

  const adminId = req.user.id;

  const statusByResult = {
    PASSED: "VERIFIED",
    FAILED: "REJECTED",
    NEEDS_REVIEW: "NEEDS_REVIEW",
  };

  const nextStatus = statusByResult[inspectionData.result];

  try {
    /*
     * Transaction contains DB state changes only.
     *
     * Stripe is NOT called inside this transaction.
     */
    const result = await runOrderTransaction(async (tx) => {
      const order = await findOrderForInspectionCompletion(orderId, tx);

      if (!order) {
        throw createHttpError(404, "Order not found.");
      }

      if (order.status !== "INSPECTING") {
        throw createHttpError(
          409,
          "This order is not currently being inspected.",
        );
      }

      if (!order.inspection) {
        throw createHttpError(409, "Inspection record was not found.");
      }

      if (order.inspection.adminId !== adminId) {
        throw createHttpError(
          403,
          "Only the assigned Admin can complete this inspection.",
        );
      }

      if (
        order.inspection.result !== "PENDING" ||
        order.inspection.completedAt
      ) {
        throw createHttpError(
          409,
          "This inspection has already been completed.",
        );
      }

      const completedAt = new Date();

      const inspectionUpdate = await completeOrderInspection(
        order.inspection.id,
        adminId,
        {
          ...inspectionData,
          completedAt,
        },
        tx,
      );

      if (inspectionUpdate.count !== 1) {
        throw createHttpError(
          409,
          "The inspection has already changed. Please refresh and try again.",
        );
      }

      const orderUpdate = await markOrderAfterInspection(
        orderId,
        nextStatus,
        completedAt,
        tx,
      );

      if (orderUpdate.count !== 1) {
        throw createHttpError(409, "The order status has already changed.");
      }

      /*
       * Failed Listing never returns to ACTIVE
       * automatically.
       */
      if (nextStatus === "REJECTED") {
        const listingUpdate = await markListingRejected(order.listingId, tx);

        if (listingUpdate.count !== 1) {
          throw createHttpError(409, "The listing status has already changed.");
        }
      }

      const inspection = await findInspectionById(order.inspection.id, tx);

      return {
        id: order.id,

        orderNumber: order.orderNumber,

        checkoutId: order.checkoutId,

        status: nextStatus,

        inspection: {
          ...inspection,

          verifiedScore:
            inspection.verifiedScore !== null
              ? Number(inspection.verifiedScore)
              : null,
        },
      };
    });

    /*
     * Inspection transaction has committed.
     *
     * Now:
     *
     * 1. Check whether every Checkout Order
     *    has finalized inspection.
     *
     * 2. Create one PENDING Refund if required.
     *
     * 3. Call Stripe outside Prisma transaction.
     */
    const refund = await prepareAndExecuteCheckoutRefund(result.checkoutId);

    const { checkoutId: _checkoutId, ...orderData } = result;

    return res.status(200).json({
      success: true,

      message: "Inspection completed successfully",

      data: {
        ...orderData,

        refund: refund
          ? {
              id: refund.id,

              amount: Number(refund.amount),

              currency: refund.currency,

              status: refund.status,

              failureCode: refund.failureCode ?? null,

              failureMessage: refund.failureMessage ?? null,
            }
          : null,
      },
    });
  } catch (error) {
    return next(error);
  }
};
export const shipOrderToBuyer = async (req, res, next) => {
  const validation = shipToBuyerSchema.parse({
    params: req.params,
    body: req.body,
  });

  const { orderId } = validation.params;
  const { carrier, trackingNumber } = validation.body;

  try {
    const result = await runOrderTransaction(async (tx) => {
      const order = await findOrderForBuyerShipment(orderId, tx);

      if (!order) {
        throw createHttpError(404, "Order not found.");
      }

      if (order.status !== "VERIFIED") {
        throw createHttpError(
          409,
          "Only verified orders can be shipped to the Buyer.",
        );
      }

      if (order.shipments.length > 0) {
        throw createHttpError(
          409,
          "Buyer shipping information has already been submitted.",
        );
      }

      const checkout = order.checkout;

      const hasCompleteAddress =
        checkout?.shippingRecipientName &&
        checkout?.shippingPhone &&
        checkout?.shippingAddress;

      if (!hasCompleteAddress) {
        throw createHttpError(409, "Buyer delivery address is incomplete.");
      }

      const orderUpdate = await markOrderAsShippingToBuyer(orderId, tx);

      if (orderUpdate.count !== 1) {
        throw createHttpError(
          409,
          "The order status has already changed. Please refresh and try again.",
        );
      }

      const shippedAt = new Date();

      const shipment = await createAdminToBuyerShipment(
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
        status: "SHIPPING_TO_BUYER",

        deliveryAddress: {
          recipientName: checkout.shippingRecipientName,

          phone: checkout.shippingPhone,

          address: checkout.shippingAddress,
        },

        deliveryShipment: shipment,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Order shipped to Buyer successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const confirmOrderDelivery = async (req, res, next) => {
  const { orderId } = orderIdSchema.parse(req.params);

  const buyerId = req.user.id;

  try {
    const result = await runOrderTransaction(async (tx) => {
      const order = await findOrderForDeliveryConfirmation(orderId, tx);

      if (!order) {
        throw createHttpError(404, "Order not found.");
      }

      if (order.buyerId !== buyerId) {
        throw createHttpError(403, "Only the Buyer can confirm this delivery.");
      }

      if (order.status !== "SHIPPING_TO_BUYER") {
        throw createHttpError(
          409,
          "This order is not awaiting delivery confirmation.",
        );
      }

      const deliveryShipment = order.shipments[0];

      if (!deliveryShipment) {
        throw createHttpError(409, "Buyer delivery shipment was not found.");
      }

      const allowedShipmentStatuses = ["SHIPPED", "IN_TRANSIT", "DELIVERED"];

      if (!allowedShipmentStatuses.includes(deliveryShipment.status)) {
        throw createHttpError(
          409,
          "This shipment cannot be confirmed as delivered.",
        );
      }

      if (order.listing.status !== "RESERVED") {
        throw createHttpError(
          409,
          "The listing is not in the expected reserved status.",
        );
      }

      const completedAt = new Date();

      /*
       * Order:
       *
       * SHIPPING_TO_BUYER
       * →
       * COMPLETED
       */
      const orderUpdate = await markOrderCompleted(
        orderId,
        buyerId,
        completedAt,
        tx,
      );

      if (orderUpdate.count !== 1) {
        throw createHttpError(
          409,
          "The order status has already changed. Please refresh and try again.",
        );
      }

      /*
       * Carrier integration may already
       * have marked this DELIVERED.
       */
      if (deliveryShipment.status !== "DELIVERED") {
        const shipmentUpdate = await markBuyerShipmentDelivered(
          orderId,
          completedAt,
          tx,
        );

        if (shipmentUpdate.count !== 1) {
          throw createHttpError(
            409,
            "The shipment status has already changed.",
          );
        }
      }

      /*
       * Successful sale:
       *
       * RESERVED
       * →
       * SOLD
       */
      const listingUpdate = await markListingSold(order.listingId, tx);

      if (listingUpdate.count !== 1) {
        throw createHttpError(409, "The listing status has already changed.");
      }

      /*
       * Payment settlement rules:
       *
       * All successful Orders must be COMPLETED.
       *
       * Rejected Orders are terminal but require
       * a SUCCEEDED Refund first.
       *
       * This function safely returns false if
       * another Order or Refund is not ready yet.
       */
      const paymentReleased = await releaseCheckoutPaymentIfReady(
        order.checkoutId,
        completedAt,
        tx,
      );

      const updatedShipment = await findBuyerShipmentByOrderId(orderId, tx);

      return {
        id: order.id,

        orderNumber: order.orderNumber,

        status: "COMPLETED",

        completedAt,

        listingStatus: "SOLD",

        deliveryShipment: updatedShipment,

        paymentReleased,
      };
    });

    return res.status(200).json({
      success: true,

      message: "Delivery confirmed successfully",

      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const returnOrderToSeller = async (req, res, next) => {
  const validation = shipToSellerSchema.parse({
    params: req.params,
    body: req.body,
  });

  const { orderId } = validation.params;

  const { carrier, trackingNumber } = validation.body;

  try {
    const result = await runOrderTransaction(async (tx) => {
      const order = await findOrderForReturnToSeller(orderId, tx);

      if (!order) {
        throw createHttpError(404, "Order not found.");
      }

      /*
       * Only rejected Orders can be returned
       * to their Seller.
       */
      if (order.status !== "REJECTED") {
        throw createHttpError(
          409,
          "Only rejected Orders can be returned to the Seller.",
        );
      }

      /*
       * Defensive integrity check.
       *
       * REJECTED Order must come from a failed
       * completed inspection.
       */
      if (
        !order.inspection ||
        order.inspection.result !== "FAILED" ||
        !order.inspection.completedAt
      ) {
        throw createHttpError(
          409,
          "This Order does not have a completed failed inspection.",
        );
      }

      /*
       * Listing must remain REJECTED.
       */
      if (order.listing.status !== "REJECTED") {
        throw createHttpError(
          409,
          "The Listing is not in the expected rejected status.",
        );
      }

      /*
       * Application-level duplicate guard.
       *
       * DB @@unique([orderId, shipmentType])
       * provides the final concurrency protection.
       */
      if (order.shipments.length > 0) {
        throw createHttpError(
          409,
          "Return shipping information has already been submitted.",
        );
      }

      /*
       * Admin needs a valid Seller destination
       * before creating the return shipment.
       */
      const sellerName =
        `${order.seller.firstName} ${order.seller.lastName}`.trim();

      const hasCompleteReturnAddress =
        sellerName && order.seller.phone && order.seller.address;

      if (!hasCompleteReturnAddress) {
        throw createHttpError(409, "Seller return address is incomplete.");
      }

      const shippedAt = new Date();

      const shipment = await createAdminToSellerShipment(
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

        /*
         * Order remains REJECTED.
         *
         * Return progress belongs to Shipment,
         * not OrderStatus.
         */
        status: "REJECTED",

        listingStatus: "REJECTED",

        returnAddress: {
          recipientName: sellerName,

          phone: order.seller.phone,

          address: order.seller.address,
        },

        returnShipment: shipment,
      };
    });

    return res.status(201).json({
      success: true,

      message: "Rejected product return shipment created successfully",

      data: result,
    });
  } catch (error) {
    /*
     * Composite unique constraint protects against
     * two Admins creating the same return shipment
     * concurrently.
     */
    if (error?.code === "P2002") {
      const shipment = await findReturnShipmentByOrderId(
        Number(req.params.orderId),
      );

      if (shipment) {
        return next(
          createHttpError(
            409,
            "Return shipping information has already been submitted.",
          ),
        );
      }
    }

    return next(error);
  }
};
