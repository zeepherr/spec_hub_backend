import { prisma } from "../lib/prisma.js";
export const findCartItemsByUser = async (userId) => {
  return await prisma.cartItem.findMany({
    where: {
      userId,
    },

    include: {
      listing: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },

          images: {
            where: {
              isCover: true,
            },
            take: 1,
          },
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
};

export const addCartItem = async (userId, listingId) => {
  return await prisma.cartItem.upsert({
    where: {
      userId_listingId: {
        userId,
        listingId,
      },
    },

    update: {},

    create: {
      userId,
      listingId,
    },
  });
};

export const removeCartItem = async (userId, listingId) => {
  return await prisma.cartItem.deleteMany({
    where: {
      userId,
      listingId,
    },
  });
};
