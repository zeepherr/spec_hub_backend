import { prisma } from "../lib/prisma.js";

// Finds the complete Checkout snapshot needed
// to determine refund eligibility and amount.
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
          refundedAt: true,
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
          reason: true,
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

// Finds a Refund by Checkout.
export const findRefundByCheckoutId = async (checkoutId, db = prisma) => {
  return await db.refund.findUnique({
    where: {
      checkoutId,
    },
  });
};

// Finds the Refund together with Payment data.
// Used before Stripe execution and by Stripe webhooks.
export const findRefundById = async (refundId, db = prisma) => {
  return await db.refund.findUnique({
    where: {
      id: refundId,
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

      failureCode: true,
      failureMessage: true,

      createdAt: true,
      processedAt: true,
      failedAt: true,

      payment: {
        select: {
          id: true,
          amount: true,
          refundedAmount: true,
          status: true,
          paymentIntentRef: true,
          refundedAt: true,
        },
      },

      checkout: {
        select: {
          id: true,
          currency: true,
        },
      },
    },
  });
};

// Creates one combined Refund per Checkout.
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
      failureCode: true,
      failureMessage: true,
      createdAt: true,
      processedAt: true,
      failedAt: true,
    },
  });
};

// PENDING → PROCESSING.
//
// Does not overwrite another Stripe Refund reference.
export const markRefundProcessing = async (
  refundId,
  providerRef,
  db = prisma,
) => {
  return await db.refund.updateMany({
    where: {
      id: refundId,

      status: {
        in: ["PENDING", "FAILED"],
      },

      OR: [
        {
          providerRef: null,
        },
        {
          providerRef,
        },
      ],
    },

    data: {
      status: "PROCESSING",
      providerRef,

      failureCode: null,
      failureMessage: null,
      failedAt: null,
    },
  });
};

// PENDING / PROCESSING / FAILED → SUCCEEDED.
//
// FAILED is included because an API connection may fail
// after Stripe has already accepted the refund.
// A later signed Stripe webhook can correct local state.
export const markRefundSucceeded = async (
  refundId,
  providerRef,
  processedAt,
  db = prisma,
) => {
  return await db.refund.updateMany({
    where: {
      id: refundId,

      status: {
        in: ["PENDING", "PROCESSING", "FAILED"],
      },

      OR: [
        {
          providerRef: null,
        },
        {
          providerRef,
        },
      ],
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

// PENDING / PROCESSING → FAILED.
//
// A succeeded Refund must never be moved back to FAILED.
export const markRefundFailed = async (
  refundId,
  { providerRef, failureCode, failureMessage, failedAt },
  db = prisma,
) => {
  return await db.refund.updateMany({
    where: {
      id: refundId,

      status: {
        in: ["PENDING", "PROCESSING", "FAILED"],
      },

      OR: [
        {
          providerRef: null,
        },
        {
          providerRef,
        },
      ],
    },

    data: {
      status: "FAILED",

      ...(providerRef && {
        providerRef,
      }),

      failureCode: failureCode ?? null,
      failureMessage: failureMessage ?? null,
      failedAt,
    },
  });
};

// Updates Payment after a confirmed successful Refund.
//
// Controller determines refundedAmount and PaymentStatus.
export const updatePaymentAfterRefund = async (
  paymentId,
  { refundedAmount, paymentStatus, refundedAt },
  db = prisma,
) => {
  return await db.payment.updateMany({
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

export const runRefundTransaction = async (callback) => {
  return await prisma.$transaction(callback);
};
