import createHttpError from "http-errors";

import {
  findCheckoutForSettlement,
  markCheckoutPaymentReleased,
} from "../services/order.service.js";

/*
 * Final Order states for Checkout settlement.
 *
 * COMPLETED:
 * Verified product reached the Buyer.
 *
 * REJECTED:
 * Product failed inspection and will not be
 * delivered to the Buyer.
 */
const FINAL_ORDER_STATUSES = ["COMPLETED", "REJECTED"];

/*
 * Releases the remaining Payment only when
 * the whole Checkout is financially settled.
 *
 * Returns:
 *
 * true  → Payment is RELEASED or was already RELEASED
 * false → Checkout is not ready for release
 *
 * Business logic belongs here, not in the service layer.
 */
export const releaseCheckoutPaymentIfReady = async (
  checkoutId,
  releasedAt = new Date(),
  db,
) => {
  const checkout = await findCheckoutForSettlement(checkoutId, db);

  if (!checkout) {
    throw createHttpError(
      500,
      "Checkout was not found while settling the Payment.",
    );
  }

  if (!checkout.payment) {
    throw createHttpError(
      500,
      "Payment record was not found for this Checkout.",
    );
  }

  /*
   * Idempotent result.
   */
  if (checkout.payment.status === "RELEASED") {
    return true;
  }

  if (checkout.orders.length === 0) {
    throw createHttpError(500, "Checkout does not contain any Orders.");
  }

  /*
   * Every Order must be terminal.
   *
   * Examples that still block settlement:
   *
   * PAID
   * SELLER_SHIPPING
   * INSPECTION_PENDING
   * INSPECTING
   * NEEDS_REVIEW
   * VERIFIED
   * SHIPPING_TO_BUYER
   */
  const allOrdersFinal = checkout.orders.every((order) =>
    FINAL_ORDER_STATUSES.includes(order.status),
  );

  if (!allOrdersFinal) {
    return false;
  }

  const rejectedOrders = checkout.orders.filter(
    (order) => order.status === "REJECTED",
  );

  const completedOrders = checkout.orders.filter(
    (order) => order.status === "COMPLETED",
  );

  /*
   * If at least one Order was rejected,
   * its Refund must succeed before any
   * remaining seller Payment can be released.
   */
  if (rejectedOrders.length > 0) {
    if (!checkout.refund || checkout.refund.status !== "SUCCEEDED") {
      return false;
    }

    /*
     * Every product was rejected.
     *
     * There is no successful product sale
     * to release to a Seller.
     *
     * Payment remains REFUNDED or
     * PARTIALLY_REFUNDED depending on
     * retained checking fee.
     */
    if (completedOrders.length === 0) {
      return false;
    }

    /*
     * Mixed Checkout:
     *
     * Some products rejected/refunded,
     * some products successfully completed.
     */
    if (checkout.payment.status !== "PARTIALLY_REFUNDED") {
      return false;
    }
  } else {
    /*
     * No rejected products.
     *
     * Normal Checkout settlement.
     */
    if (checkout.payment.status !== "PAID") {
      return false;
    }
  }

  const paymentUpdate = await markCheckoutPaymentReleased(
    checkoutId,
    releasedAt,
    db,
  );

  if (paymentUpdate.count === 1) {
    return true;
  }

  /*
   * Another request may have released it
   * concurrently.
   */
  const currentCheckout = await findCheckoutForSettlement(checkoutId, db);

  if (currentCheckout?.payment?.status === "RELEASED") {
    return true;
  }

  throw createHttpError(409, "Payment settlement state has already changed.");
};
