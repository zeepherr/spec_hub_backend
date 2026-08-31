import { prisma } from "../lib/prisma.js";

export const findListingsByCatId = async (catId) => {
  return await prisma.listing.findMany({
    where: {
      categoryId: catId,
    },
  });
};

export const createListing = async (data) => {
  return prisma.listing.create({
    data,
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

export const findListingsBySeller = async (sellerId) => {
  return prisma.listing.findMany({
    where: {
      sellerId,
    },

    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
};

export const findListingById = async (listingId) => {
  return prisma.listing.findUnique({
    where: {
      id: listingId,
    },

    include: {
      category: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },

      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },

      conditionAnswers: {
        include: {
          question: true,
        },
      },
    },
  });
};

export const updateListing = (listingId, data) => {
  return prisma.listing.update({
    where: {
      id: listingId,
    },

    data,

    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

export const updateListingAndClearConditionAnswers = (listingId, data) => {
  return prisma.$transaction(async (tx) => {
    await tx.sellerConditionAnswer.deleteMany({
      where: {
        listingId,
      },
    });

    return tx.listing.update({
      where: {
        id: listingId,
      },

      data,

      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });
};
export const findListingForConditionAnalysis = (listingId) => {
  return prisma.listing.findUnique({
    where: {
      id: listingId,
    },

    include: {
      category: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },

      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },

      conditionAnswers: {
        include: {
          question: {
            select: {
              id: true,
              label: true,
              answerType: true,
              isRequired: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
};

export const updateListingConditionEstimate = (listingId, data) => {
  return prisma.listing.update({
    where: {
      id: listingId,
    },

    data,

    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },

      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },

      conditionAnswers: {
        include: {
          question: true,
        },
      },
    },
  });
};

//outer uses
export const findListingForConditionAnswers = (listingId) => {
  return prisma.listing.findUnique({
    where: {
      id: listingId,
    },

    select: {
      id: true,
      sellerId: true,
      categoryId: true,
      status: true,
    },
  });
};
export const publishListingById = (listingId) => {
  return prisma.listing.update({
    where: {
      id: listingId,
    },

    data: {
      status: "ACTIVE",
    },

    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },

      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },

      conditionAnswers: {
        include: {
          question: true,
        },
      },
    },
  });
};
