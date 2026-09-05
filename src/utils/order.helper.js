import createHttpError from "http-errors";
import {
  createPendingRefund,
  findCheckoutForRefund,
  findRefundByCheckoutId,
} from "../services/checkoutRefund.service.js";

export const toMinorUnits = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw createHttpError(500, "Invalid monetary amount.");
  }

  return Math.round(numericAmount * 100);
};

const calculateCheckoutRefund = (checkout) => {
  if (checkout.orders.length === 0) {
    throw createHttpError(500, "Checkout does not contain any Orders.");
  }

  /*
   * Refund must wait until every Order has reached
   * a final inspection result.
   *
   * NEEDS_REVIEW is intentionally NOT final.
   */
  const allOrdersFinalized = checkout.orders.every((order) =>
    ["VERIFIED", "REJECTED"].includes(order.status),
  );

  if (!allOrdersFinalized) {
    return {
      ready: false,
      refundable: false,
      amount: 0,
      allRejected: false,
    };
  }

  const rejectedOrders = checkout.orders.filter(
    (order) => order.status === "REJECTED",
  );

  /*
   * Every Order passed inspection.
   * No refund is required.
   */
  if (rejectedOrders.length === 0) {
    return {
      ready: true,
      refundable: false,
      amount: 0,
      allRejected: false,
    };
  }

  const rejectedProductsTotalInMinorUnits = rejectedOrders.reduce(
    (total, order) => {
      return total + toMinorUnits(order.agreedPrice);
    },
    0,
  );

  const allRejected = rejectedOrders.length === checkout.orders.length;

  /*
   * Delivery fee is refunded only if every product
   * in the Checkout was rejected.
   *
   * Product checking fee is never refunded.
   */
  const deliveryRefundInMinorUnits = allRejected
    ? toMinorUnits(checkout.deliveryFee)
    : 0;

  const refundAmountInMinorUnits =
    rejectedProductsTotalInMinorUnits + deliveryRefundInMinorUnits;

  return {
    ready: true,
    refundable: refundAmountInMinorUnits > 0,

    amount: refundAmountInMinorUnits / 100,

    allRejected,
  };
};

export const prepareCheckoutRefund = async (checkoutId) => {
  const checkout = await findCheckoutForRefund(checkoutId);

  if (!checkout) {
    throw createHttpError(
      500,
      "Checkout was not found while preparing the refund.",
    );
  }

  const calculation = calculateCheckoutRefund(checkout);

  /*
   * Some Orders are still waiting for inspection,
   * or NEEDS_REVIEW.
   */
  if (!calculation.ready) {
    return null;
  }

  /*
   * All products passed inspection.
   */
  if (!calculation.refundable) {
    return null;
  }

  /*
   * Idempotency at application level.
   */
  if (checkout.refund) {
    return checkout.refund;
  }

  const existingRefund = await findRefundByCheckoutId(checkout.id);

  if (existingRefund) {
    return existingRefund;
  }

  if (!checkout.payment) {
    throw createHttpError(
      500,
      "Payment record was not found for this Checkout.",
    );
  }

  /*
   * At this point no refund has been executed yet.
   * Therefore the original Payment should still be PAID.
   */
  if (checkout.payment.status !== "PAID") {
    throw createHttpError(409, "This Payment is not eligible for refund.");
  }

  const refundAmountInMinorUnits = toMinorUnits(calculation.amount);
  const paymentAmountInMinorUnits = toMinorUnits(checkout.payment.amount);

  if (
    refundAmountInMinorUnits <= 0 ||
    refundAmountInMinorUnits > paymentAmountInMinorUnits
  ) {
    throw createHttpError(500, "Calculated refund amount is invalid.");
  }

  try {
    return await createPendingRefund({
      checkoutId: checkout.id,
      paymentId: checkout.payment.id,
      amount: calculation.amount,
      currency: checkout.currency,

      reason: calculation.allRejected
        ? "All products failed inspection."
        : "One or more products failed inspection.",
    });
  } catch (error) {
    /*
     * checkoutId and paymentId are UNIQUE.
     *
     * If two inspection requests finish at nearly
     * the same time, the database protects us from
     * creating duplicate Refund records.
     */
    if (error?.code === "P2002") {
      const refund = await findRefundByCheckoutId(checkout.id);

      if (refund) {
        return refund;
      }
    }

    throw error;
  }
};

export const toBuyerRefundResponse = (refund) => {
  if (!refund) {
    return null;
  }

  return {
    id: refund.id,

    amount: Number(refund.amount),
    currency: refund.currency,
    status: refund.status,

    processedAt: refund.processedAt,
    failedAt: refund.failedAt,
  };
};

export const toAdminRefundResponse = (refund) => {
  if (!refund) {
    return null;
  }

  return {
    ...refund,

    amount: Number(refund.amount),
  };
};

export const toBuyerPaymentResponse = (payment) => {
  if (!payment) {
    return null;
  }

  return {
    status: payment.status,

    paidAt: payment.paidAt,

    refundedAmount:
      payment.refundedAmount == null ? 0 : Number(payment.refundedAmount),

    refundedAt: payment.refundedAt,
  };
};
