import { prisma } from "../lib/prisma.js";

// Finds the checkout and its orders required before starting payment.
export const findCheckoutForPayment = async (checkoutId, db = prisma) => {
  return await db.checkout.findUnique({
    where: {
      id: checkoutId,
    },
    select: {
      id: true,
      buyerId: true,
      status: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          agreedPrice: true,
          status: true,
          listing: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });
};

// Finds the existing payment for a checkout.
export const findPaymentByCheckoutId = async (checkoutId, db = prisma) => {
  return await db.payment.findUnique({
    where: {
      checkoutId,
    },
  });
};

// Creates a pending payment for the checkout.
export const createPayment = async (data, db = prisma) => {
  return await db.payment.create({
    data,
  });
};

// Saves the Stripe Checkout Session ID.
export const updatePaymentProviderRef = async (
  paymentId,
  providerRef,
  db = prisma,
) => {
  return await db.payment.update({
    where: {
      id: paymentId,
    },
    data: {
      providerRef,
    },
  });
};

// Finds a payment using the Stripe Checkout Session ID.
export const findPaymentByProviderRef = async (providerRef, db = prisma) => {
  return await db.payment.findFirst({
    where: {
      providerRef,
    },
  });
};

// Marks a pending payment as paid.
export const markPaymentPaid = async (paymentId, paidAt, db = prisma) => {
  return await db.payment.updateMany({
    where: {
      id: paymentId,
      status: "PENDING",
    },
    data: {
      status: "PAID",
      paidAt,
    },
  });
};

// Marks the checkout as paid.
export const markCheckoutPaid = async (checkoutId, db = prisma) => {
  return await db.checkout.updateMany({
    where: {
      id: checkoutId,
      status: "AWAITING_PAYMENT",
    },
    data: {
      status: "PAID",
    },
  });
};

// Marks all unpaid orders in the checkout as paid.
export const markCheckoutOrdersPaid = async (checkoutId, db = prisma) => {
  return await db.order.updateMany({
    where: {
      checkoutId,
      status: "AWAITING_PAYMENT",
    },
    data: {
      status: "PAID",
    },
  });
};

// Marks an unpaid checkout as expired.
export const markCheckoutExpired = async (checkoutId, db = prisma) => {
  return await db.checkout.updateMany({
    where: {
      id: checkoutId,
      status: "AWAITING_PAYMENT",
    },
    data: {
      status: "EXPIRED",
    },
  });
};

// Marks a pending payment as expired.
export const markPaymentExpired = async (paymentId, db = prisma) => {
  return await db.payment.updateMany({
    where: {
      id: paymentId,
      status: "PENDING",
    },
    data: {
      status: "EXPIRED",
    },
  });
};

// Releases listings reserved by unpaid orders in the checkout.
export const releaseCheckoutListings = async (checkoutId, db = prisma) => {
  return await db.listing.updateMany({
    where: {
      status: "RESERVED",
      orders: {
        some: {
          checkoutId,
          status: "AWAITING_PAYMENT",
        },
      },
    },
    data: {
      status: "ACTIVE",
    },
  });
};

// Cancels unpaid orders belonging to an expired checkout.
export const cancelCheckoutOrders = async (checkoutId, db = prisma) => {
  return await db.order.updateMany({
    where: {
      checkoutId,
      status: "AWAITING_PAYMENT",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });
};

// Runs payment-related database updates inside one transaction.
export const runPaymentTransaction = async (callback) => {
  return await prisma.$transaction(callback);
};

export const findPaymentStatusByProviderRef = async (
  providerRef,
  db = prisma,
) => {
  return await db.payment.findFirst({
    where: {
      providerRef,
    },
    select: {
      id: true,
      buyerId: true,
      amount: true,
      status: true,
      paidAt: true,
      checkout: {
        select: {
          id: true,
          status: true,
          orders: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              listingId: true,
            },
          },
        },
      },
    },
  });
};
