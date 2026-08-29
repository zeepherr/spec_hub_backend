import { prisma } from "../lib/prisma.js";

export const findListingsByCatId = async (catId) => {
  return await prisma.listing.findMany({
    where: {
      categoryId: catId,
    },
  });
};
