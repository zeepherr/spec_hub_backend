import { prisma } from "../lib/prisma.js";

// Finds the Checkout and pricing snapshot.
export const findCheckoutForPayment = async (checkoutId, db = prisma) => {
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
      createdAt: true,

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

export const findPaymentByCheckoutId = async (checkoutId, db = prisma) => {
  return await db.payment.findUnique({
    where: {
      checkoutId,
    },
  });
};

export const createPayment = async (data, db = prisma) => {
  return await db.payment.create({
    data,
  });
};

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
export const updatePaymentIntentRef = async (
  paymentId,
  paymentIntentRef,
  db = prisma,
) => {
  return await db.payment.updateMany({
    where: {
      id: paymentId,

      OR: [
        {
          paymentIntentRef: null,
        },
        {
          paymentIntentRef,
        },
      ],
    },

    data: {
      paymentIntentRef,
    },
  });
};

export const findPaymentByProviderRef = async (providerRef, db = prisma) => {
  return await db.payment.findFirst({
    where: {
      providerRef,
    },
    select: {
      id: true,
      checkoutId: true,
      buyerId: true,
      amount: true,
      status: true,
      providerRef: true,
      paymentIntentRef: true,

      checkout: {
        select: {
          grandTotal: true,
          currency: true,
        },
      },
    },
  });
};

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

          subtotal: true,
          productCheckingFee: true,
          deliveryFee: true,
          grandTotal: true,
          currency: true,

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

// Finds unpaid Checkouts older than the configured
// reservation deadline.
export const findExpiredAwaitingPaymentCheckouts = async (
  expirationCutoff,
  limit = 50,
  db = prisma,
) => {
  return await db.checkout.findMany({
    where: {
      status: "AWAITING_PAYMENT",

      createdAt: {
        lte: expirationCutoff,
      },
    },

    select: {
      id: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "asc",
    },

    take: limit,
  });
};

// Atomically expires an unpaid Checkout and releases
// its reserved Listings.
export const expireUnpaidCheckout = async ({
  checkoutId,
  paymentId = null,
}) => {
  return await prisma.$transaction(async (tx) => {
    const checkoutUpdate = await markCheckoutExpired(checkoutId, tx);

    /*
     * Another process or the Stripe webhook
     * may have already changed the Checkout.
     */
    if (checkoutUpdate.count !== 1) {
      return false;
    }

    if (paymentId) {
      await markPaymentExpired(paymentId, tx);
    }

    /*
     * Release Listings before cancelling Orders
     * because releaseCheckoutListings currently
     * searches for AWAITING_PAYMENT Orders.
     */
    await releaseCheckoutListings(checkoutId, tx);

    await cancelCheckoutOrders(checkoutId, tx);

    return true;
  });
};
