import { prisma } from "../lib/prisma.js";

// Finds the order information required before starting checkout.
export const findOrderForPayment = async (orderId, db = prisma) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },
    select: {
      id: true,
      orderNumber: true,
      buyerId: true,
      sellerId: true,
      agreedPrice: true,
      status: true,
      listing: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
};

// Finds the existing payment for an order.
// One order can only have one Payment record in the current MVP.
export const findPaymentByOrderId = async (orderId, db = prisma) => {
  return await db.payment.findUnique({
    where: {
      orderId,
    },
  });
};

// Creates a pending payment using trusted data from the order.
export const createPayment = async (data, db = prisma) => {
  return await db.payment.create({
    data,
  });
};

// Saves the Stripe Checkout Session ID after Stripe creates the session.
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
