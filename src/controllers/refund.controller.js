import createHttpError from "http-errors";

import { createStripeRefund } from "../providers/stripe.provider.js";

import {
  createPendingRefund,
  findCheckoutForRefund,
  findRefundByCheckoutId,
  findRefundById,
  markRefundFailed,
  markRefundProcessing,
  markRefundSucceeded,
  runRefundTransaction,
  updatePaymentAfterRefund,
} from "../services/refund.service.js";
import { toMinorUnits } from "../utils/order.helper.js";
import { releaseCheckoutPaymentIfReady } from "./checkoutSettlement.controller.js";

// Calculates the Checkout-level refund.
//
// Business rules:
//
// Rejected product price → refunded
// Checking fee           → never refunded
// Delivery fee           → refunded only if ALL Orders rejected
const calculateCheckoutRefund = (checkout) => {
  if (checkout.orders.length === 0) {
    throw createHttpError(500, "Checkout does not contain any Orders.");
  }

  /*
   * Refund calculation must wait until every
   * Order has a final inspection result.
   *
   * NEEDS_REVIEW is intentionally not final.
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
   * Every product passed.
   */
  if (rejectedOrders.length === 0) {
    return {
      ready: true,
      refundable: false,
      amount: 0,
      allRejected: false,
    };
  }

  const rejectedProductTotalInMinorUnits = rejectedOrders.reduce(
    (total, order) => {
      return total + toMinorUnits(order.agreedPrice);
    },
    0,
  );

  const allRejected = rejectedOrders.length === checkout.orders.length;

  const deliveryRefundInMinorUnits = allRejected
    ? toMinorUnits(checkout.deliveryFee)
    : 0;

  const refundAmountInMinorUnits =
    rejectedProductTotalInMinorUnits + deliveryRefundInMinorUnits;

  return {
    ready: true,

    refundable: refundAmountInMinorUnits > 0,

    amount: refundAmountInMinorUnits / 100,

    allRejected,
  };
};

// Creates the local PENDING Refund record only when
// every Order in the Checkout has been finalized.
const prepareCheckoutRefund = async (checkoutId) => {
  const checkout = await findCheckoutForRefund(checkoutId);

  if (!checkout) {
    throw createHttpError(
      500,
      "Checkout was not found while preparing the Refund.",
    );
  }

  const calculation = calculateCheckoutRefund(checkout);

  /*
   * Another Order still needs inspection.
   */
  if (!calculation.ready) {
    return null;
  }

  /*
   * All Orders passed inspection.
   */
  if (!calculation.refundable) {
    return null;
  }

  /*
   * Existing Refund wins.
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
   * Refund has not started yet.
   */
  if (checkout.payment.status !== "PAID") {
    throw createHttpError(409, "This Payment is not eligible for Refund.");
  }

  const refundAmountInMinorUnits = toMinorUnits(calculation.amount);

  const paymentAmountInMinorUnits = toMinorUnits(checkout.payment.amount);

  if (
    refundAmountInMinorUnits <= 0 ||
    refundAmountInMinorUnits > paymentAmountInMinorUnits
  ) {
    throw createHttpError(500, "Calculated Refund amount is invalid.");
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
     * Two Admin requests may finish different
     * inspections almost simultaneously.
     *
     * Database UNIQUE constraints protect
     * against duplicate Refund records.
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

// Finalizes a Stripe-confirmed successful Refund
// and updates Payment atomically.
const finalizeSuccessfulRefund = async ({ refundId, providerRef }) => {
  const refund = await findRefundById(refundId);

  if (!refund) {
    throw createHttpError(404, "Refund record was not found.");
  }

  if (refund.providerRef && refund.providerRef !== providerRef) {
    throw createHttpError(
      409,
      "Stripe Refund reference does not match the stored Refund.",
    );
  }

  /*
   * Stripe may retry the same webhook.
   *
   * Even if local Refund is already SUCCEEDED,
   * run the Checkout settlement check again.
   *
   * This also recovers from a process crash that
   * happened after Refund success but before
   * Payment release.
   */
  if (refund.status === "SUCCEEDED") {
    await releaseCheckoutPaymentIfReady(refund.checkoutId);

    return refund;
  }

  if (!refund.payment) {
    throw createHttpError(500, "Payment record was not found for the Refund.");
  }

  const refundAmountInMinorUnits = toMinorUnits(refund.amount);

  const paymentAmountInMinorUnits = toMinorUnits(refund.payment.amount);

  const alreadyRefundedInMinorUnits = toMinorUnits(
    refund.payment.refundedAmount,
  );

  const newRefundedAmountInMinorUnits =
    alreadyRefundedInMinorUnits + refundAmountInMinorUnits;

  if (
    newRefundedAmountInMinorUnits <= 0 ||
    newRefundedAmountInMinorUnits > paymentAmountInMinorUnits
  ) {
    throw createHttpError(
      500,
      "Refund would exceed the original Payment amount.",
    );
  }

  const paymentStatus =
    newRefundedAmountInMinorUnits === paymentAmountInMinorUnits
      ? "REFUNDED"
      : "PARTIALLY_REFUNDED";

  const processedAt = new Date();

  const updated = await runRefundTransaction(async (tx) => {
    /*
     * Refund success and Payment financial
     * snapshot are updated atomically.
     */
    const refundUpdate = await markRefundSucceeded(
      refund.id,
      providerRef,
      processedAt,
      tx,
    );

    if (refundUpdate.count !== 1) {
      return false;
    }

    const paymentUpdate = await updatePaymentAfterRefund(
      refund.payment.id,
      {
        refundedAmount: newRefundedAmountInMinorUnits / 100,

        paymentStatus,

        refundedAt: processedAt,
      },
      tx,
    );

    if (paymentUpdate.count !== 1) {
      throw createHttpError(409, "Payment refund state has already changed.");
    }

    return true;
  });

  /*
   * Another webhook/request may have
   * finalized the Refund first.
   */
  if (!updated) {
    const currentRefund = await findRefundById(refund.id);

    if (currentRefund?.status !== "SUCCEEDED") {
      throw createHttpError(409, "Refund state has already changed.");
    }

    /*
     * Retry settlement after concurrent
     * successful Refund processing.
     */
    await releaseCheckoutPaymentIfReady(refund.checkoutId);

    return currentRefund;
  }

  /*
   * Refund is now committed.
   *
   * If every successful Order is already
   * COMPLETED, release the remaining Payment.
   *
   * If delivery is still pending, this returns
   * false and confirmOrderDelivery() will try
   * again later.
   */
  await releaseCheckoutPaymentIfReady(refund.checkoutId, processedAt);

  return await findRefundById(refund.id);
};

// Calls Stripe outside any Prisma transaction.
const executePendingRefund = async (refundId) => {
  const refund = await findRefundById(refundId);

  if (!refund) {
    throw createHttpError(404, "Refund record was not found.");
  }

  /*
   * Do not automatically execute again.
   *
   * FAILED will later have an explicit retry flow.
   */
  if (refund.status !== "PENDING") {
    return refund;
  }

  if (!refund.payment) {
    throw createHttpError(500, "Payment record was not found.");
  }

  const paymentIntentRef = refund.payment.paymentIntentRef;

  /*
   * Refund must target pi_..., never cs_...
   */
  if (
    typeof paymentIntentRef !== "string" ||
    !paymentIntentRef.startsWith("pi_")
  ) {
    const failedAt = new Date();

    await markRefundFailed(refund.id, {
      providerRef: null,

      failureCode: "PAYMENT_INTENT_MISSING",

      failureMessage: "Stripe PaymentIntent reference was not found.",

      failedAt,
    });

    return await findRefundById(refund.id);
  }

  let stripeRefund;

  try {
    /*
     * IMPORTANT:
     *
     * Stripe call is outside Prisma transaction.
     */
    stripeRefund = await createStripeRefund({
      paymentIntentId: paymentIntentRef,

      amount: refund.amount,

      checkoutId: refund.checkoutId,

      refundId: refund.id,
    });
  } catch (error) {
    /*
     * Inspection has already succeeded.
     *
     * Do not pretend the inspection failed because
     * Stripe had a refund/provider error.
     *
     * Store FAILED so Admin can retry later.
     */
    await markRefundFailed(refund.id, {
      providerRef: null,

      failureCode: error?.code ?? "STRIPE_REFUND_ERROR",

      failureMessage: error?.message ?? "Stripe Refund failed.",

      failedAt: new Date(),
    });

    return await findRefundById(refund.id);
  }

  if (!stripeRefund?.id || !stripeRefund.id.startsWith("re_")) {
    await markRefundFailed(refund.id, {
      providerRef: null,

      failureCode: "INVALID_STRIPE_REFUND",

      failureMessage: "Stripe returned an invalid Refund reference.",

      failedAt: new Date(),
    });

    return await findRefundById(refund.id);
  }

  const stripePaymentIntent =
    typeof stripeRefund.payment_intent === "string"
      ? stripeRefund.payment_intent
      : stripeRefund.payment_intent?.id;

  if (stripePaymentIntent !== paymentIntentRef) {
    await markRefundFailed(refund.id, {
      providerRef: stripeRefund.id,

      failureCode: "PAYMENT_INTENT_MISMATCH",

      failureMessage: "Stripe Refund PaymentIntent does not match the Payment.",

      failedAt: new Date(),
    });

    return await findRefundById(refund.id);
  }

  if (stripeRefund.amount !== toMinorUnits(refund.amount)) {
    await markRefundFailed(refund.id, {
      providerRef: stripeRefund.id,

      failureCode: "REFUND_AMOUNT_MISMATCH",

      failureMessage:
        "Stripe Refund amount does not match the expected amount.",

      failedAt: new Date(),
    });

    return await findRefundById(refund.id);
  }

  if (stripeRefund.currency !== refund.currency.toLowerCase()) {
    await markRefundFailed(refund.id, {
      providerRef: stripeRefund.id,

      failureCode: "REFUND_CURRENCY_MISMATCH",

      failureMessage: "Stripe Refund currency does not match.",

      failedAt: new Date(),
    });

    return await findRefundById(refund.id);
  }

  /*
   * Immediate success.
   *
   * Webhook remains idempotent and can safely
   * confirm the same Refund again.
   */
  if (stripeRefund.status === "succeeded") {
    return await finalizeSuccessfulRefund({
      refundId: refund.id,

      providerRef: stripeRefund.id,
    });
  }

  /*
   * Stripe accepted the Refund but it has not
   * completed yet.
   */
  if (stripeRefund.status === "pending") {
    await markRefundProcessing(refund.id, stripeRefund.id);

    return await findRefundById(refund.id);
  }

  /*
   * Card-only MVP should normally not hit
   * requires_action or canceled.
   */
  await markRefundFailed(refund.id, {
    providerRef: stripeRefund.id,

    failureCode:
      stripeRefund.failure_reason ??
      `STRIPE_REFUND_${String(stripeRefund.status).toUpperCase()}`,

    failureMessage: `Stripe Refund ended with status "${stripeRefund.status}".`,

    failedAt: new Date(),
  });

  return await findRefundById(refund.id);
};

// Called after an inspection is committed.
export const prepareAndExecuteCheckoutRefund = async (checkoutId) => {
  const preparedRefund = await prepareCheckoutRefund(checkoutId);

  if (!preparedRefund) {
    return null;
  }

  return await executePendingRefund(preparedRefund.id);
};

// Handles refund.created / refund.updated / refund.failed.
//
// This is called from the signed Stripe webhook.
export const handleStripeRefundEvent = async (stripeRefund) => {
  const refundId = Number(stripeRefund.metadata?.refundId);

  /*
   * Ignore Refunds that do not belong to SpecHub.
   *
   * For example, a manual unrelated Refund made
   * from the same Stripe account.
   */
  if (!Number.isInteger(refundId) || refundId <= 0) {
    return null;
  }

  const refund = await findRefundById(refundId);

  if (!refund) {
    throw createHttpError(404, "Refund record was not found.");
  }

  const checkoutId = Number(stripeRefund.metadata?.checkoutId);

  if (!Number.isInteger(checkoutId) || checkoutId !== refund.checkoutId) {
    throw createHttpError(400, "Invalid Stripe Refund checkout metadata.");
  }

  if (refund.providerRef && refund.providerRef !== stripeRefund.id) {
    throw createHttpError(400, "Stripe Refund reference does not match.");
  }

  if (stripeRefund.amount !== toMinorUnits(refund.amount)) {
    throw createHttpError(400, "Stripe Refund amount does not match.");
  }

  if (stripeRefund.currency !== refund.currency.toLowerCase()) {
    throw createHttpError(400, "Stripe Refund currency does not match.");
  }

  const stripePaymentIntent =
    typeof stripeRefund.payment_intent === "string"
      ? stripeRefund.payment_intent
      : stripeRefund.payment_intent?.id;

  if (stripePaymentIntent !== refund.payment.paymentIntentRef) {
    throw createHttpError(400, "Stripe Refund PaymentIntent does not match.");
  }

  if (stripeRefund.status === "succeeded") {
    return await finalizeSuccessfulRefund({
      refundId: refund.id,

      providerRef: stripeRefund.id,
    });
  }

  if (stripeRefund.status === "pending") {
    /*
     * Never regress SUCCEEDED → PROCESSING.
     */
    if (refund.status === "PENDING") {
      await markRefundProcessing(refund.id, stripeRefund.id);
    }

    return await findRefundById(refund.id);
  }

  if (
    stripeRefund.status === "failed" ||
    stripeRefund.status === "canceled" ||
    stripeRefund.status === "requires_action"
  ) {
    await markRefundFailed(refund.id, {
      providerRef: stripeRefund.id,

      failureCode:
        stripeRefund.failure_reason ??
        `STRIPE_REFUND_${String(stripeRefund.status).toUpperCase()}`,

      failureMessage: `Stripe Refund ended with status "${stripeRefund.status}".`,

      failedAt: new Date(),
    });

    return await findRefundById(refund.id);
  }

  return refund;
};
