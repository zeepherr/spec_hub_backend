import { prisma } from "../lib/prisma.js";

// Finds the complete Checkout snapshot needed
// before calculating or creating a refund.
export const findCheckoutForRefund = async (checkoutId, db = prisma) => {
  return await db.checkout.findUnique({
    where: {
      id: checkoutId,
    },

    select: {
      id: true,
      buyerId: true,
      status: true,

      subtotal: true,
      productCheckingFee: true,
      deliveryFee: true,
      grandTotal: true,
      currency: true,

      orders: {
        select: {
          id: true,
          orderNumber: true,
          agreedPrice: true,
          status: true,
        },
      },

      payment: {
        select: {
          id: true,
          amount: true,
          refundedAmount: true,
          status: true,
          providerRef: true,
          paymentIntentRef: true,
          paidAt: true,
        },
      },

      refund: {
        select: {
          id: true,
          checkoutId: true,
          paymentId: true,
          amount: true,
          currency: true,
          status: true,
          providerRef: true,
          failureCode: true,
          failureMessage: true,
          createdAt: true,
          processedAt: true,
          failedAt: true,
        },
      },
    },
  });
};

// Finds an existing Refund for duplicate protection.
export const findRefundByCheckoutId = async (checkoutId, db = prisma) => {
  return await db.refund.findUnique({
    where: {
      checkoutId,
    },
  });
};

// Creates the database record before contacting Stripe.
export const createPendingRefund = async (data, db = prisma) => {
  return await db.refund.create({
    data: {
      checkoutId: data.checkoutId,
      paymentId: data.paymentId,
      amount: data.amount,
      currency: data.currency,
      status: "PENDING",
      reason: data.reason ?? null,
    },

    select: {
      id: true,
      checkoutId: true,
      paymentId: true,
      amount: true,
      currency: true,
      status: true,
      reason: true,
      providerRef: true,
      createdAt: true,
    },
  });
};

// Atomically changes PENDING → PROCESSING.
export const markRefundProcessing = async (
  refundId,
  providerRef,
  db = prisma,
) => {
  return await db.refund.updateMany({
    where: {
      id: refundId,
      status: "PENDING",
    },

    data: {
      status: "PROCESSING",
      providerRef,
    },
  });
};

// Marks the Refund successful.
export const markRefundSucceeded = async (
  refundId,
  processedAt,
  providerRef,
  db = prisma,
) => {
  return await db.refund.updateMany({
    where: {
      id: refundId,
      status: {
        in: ["PENDING", "PROCESSING"],
      },
    },

    data: {
      status: "SUCCEEDED",
      providerRef,
      processedAt,

      failureCode: null,
      failureMessage: null,
      failedAt: null,
    },
  });
};

// Marks the Refund failed.
export const markRefundFailed = async (
  refundId,
  { failureCode, failureMessage, failedAt },
  db = prisma,
) => {
  return await db.refund.updateMany({
    where: {
      id: refundId,
      status: {
        in: ["PENDING", "PROCESSING"],
      },
    },

    data: {
      status: "FAILED",
      failureCode: failureCode ?? null,
      failureMessage: failureMessage ?? null,
      failedAt,
    },
  });
};

// Updates the Payment financial snapshot after
// Stripe confirms a successful refund.
export const markPaymentRefunded = async (
  paymentId,
  { refundedAmount, paymentStatus, refundedAt },
  db = prisma,
) => {
  return await db.payment.update({
    where: {
      id: paymentId,
    },

    data: {
      refundedAmount,
      status: paymentStatus,
      refundedAt,
    },
  });
};

// Runs related DB operations atomically.
// Stripe API calls must NOT run inside this transaction.
export const runRefundTransaction = async (callback) => {
  return await prisma.$transaction(callback);
};
