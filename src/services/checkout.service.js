import { prisma } from "../lib/prisma.js";

// Finds all listings selected by the buyer for checkout.
export const findListingsForCheckout = async (listingIds, db = prisma) => {
  return await db.listing.findMany({
    where: {
      id: {
        in: listingIds,
      },
    },
    select: {
      id: true,
      sellerId: true,
      title: true,
      price: true,
      status: true,
    },
  });
};

// Reserves all selected listings that are still ACTIVE.
export const reserveActiveListings = async (listingIds, db = prisma) => {
  return await db.listing.updateMany({
    where: {
      id: {
        in: listingIds,
      },
      status: "ACTIVE",
    },
    data: {
      status: "RESERVED",
    },
  });
};

// Creates the parent checkout for one or more orders.
export const createCheckoutRecord = async (buyerId, db = prisma) => {
  return await db.checkout.create({
    data: {
      buyerId,
    },
    select: {
      id: true,
      buyerId: true,
      status: true,
      createdAt: true,
    },
  });
};

// Creates one separate order for each listing in the checkout.
export const createOrdersForCheckout = async (orders, db = prisma) => {
  return await Promise.all(
    orders.map((order) =>
      db.order.create({
        data: order,
        select: {
          id: true,
          orderNumber: true,
          checkoutId: true,
          listingId: true,
          buyerId: true,
          sellerId: true,
          agreedPrice: true,
          status: true,
          createdAt: true,
        },
      }),
    ),
  );
};

// Runs checkout creation and listing reservations in one transaction.
export const runCheckoutTransaction = async (callback) => {
  return await prisma.$transaction(callback);
};
