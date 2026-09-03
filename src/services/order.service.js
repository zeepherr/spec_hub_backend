import { prisma } from "../lib/prisma.js";
// Finds the listing needed when creating an order.
export const findListingForOrder = async (listingId, db = prisma) => {
  return await db.listing.findUnique({
    where: {
      id: listingId,
    },
    select: {
      id: true,
      sellerId: true,
      price: true,
      status: true,
    },
  });
};

// Reserves the listing only if it is still ACTIVE.
// updateMany is used so concurrent buyers do not both reserve the same listing.
export const reserveActiveListing = async (listingId, db = prisma) => {
  return await db.listing.updateMany({
    where: {
      id: listingId,
      status: "ACTIVE",
    },
    data: {
      status: "RESERVED",
    },
  });
};

// Creates the order using trusted values prepared by the controller.
export const createOrder = async (data, db = prisma) => {
  return await db.order.create({
    data,
    select: {
      id: true,
      orderNumber: true,
      listingId: true,
      buyerId: true,
      sellerId: true,
      agreedPrice: true,
      status: true,
      createdAt: true,
    },
  });
};

// Runs order creation operations inside one database transaction.
export const runOrderTransaction = async (callback) => {
  return await prisma.$transaction(callback);
};
