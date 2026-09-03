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

export const findOrdersByBuyer = async (buyerId, db = prisma) => {
  return await db.order.findMany({
    where: {
      buyerId,
    },

    select: {
      id: true,
      orderNumber: true,
      agreedPrice: true,
      status: true,
      createdAt: true,
      updatedAt: true,

      listing: {
        select: {
          id: true,
          title: true,
          brand: true,
          model: true,
          status: true,
          estimatedCondition: true,

          images: {
            select: {
              id: true,
              imageKey: true,
              sortOrder: true,
              isCover: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },

      seller: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      checkout: {
        select: {
          id: true,
          status: true,

          payment: {
            select: {
              status: true,
              paidAt: true,
            },
          },
        },
      },

      shipments: {
        where: {
          shipmentType: "ADMIN_TO_BUYER",
        },

        select: {
          id: true,
          carrier: true,
          trackingNumber: true,
          status: true,
          shippedAt: true,
          deliveredAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 1,
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
};

export const findOrderById = async (orderId, db = prisma) => {
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
      lockedAt: true,
      completedAt: true,
      cancelledAt: true,
      rejectedAt: true,
      createdAt: true,
      updatedAt: true,

      /*
      |--------------------------------------------------------------------------
      | Listing
      |--------------------------------------------------------------------------
      */

      listing: {
        select: {
          id: true,
          title: true,
          description: true,
          brand: true,
          model: true,
          location: true,
          status: true,
          estimatedCondition: true,

          category: {
            select: {
              id: true,
              name: true,
            },
          },

          images: {
            select: {
              id: true,
              imageKey: true,
              sortOrder: true,
              isCover: true,
            },

            orderBy: {
              sortOrder: "asc",
            },
          },

          conditionAnswers: {
            select: {
              id: true,
              answerValue: true,

              question: {
                select: {
                  id: true,
                  label: true,
                  answerType: true,
                },
              },
            },
          },
        },
      },

      /*
      |--------------------------------------------------------------------------
      | Buyer and Seller
      |--------------------------------------------------------------------------
      |
      | Only safe identity fields are selected.
      | Email, phone, address and password are excluded.
      |--------------------------------------------------------------------------
      */

      buyer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      seller: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      /*
      |--------------------------------------------------------------------------
      | Checkout and Payment
      |--------------------------------------------------------------------------
      |
      | No Stripe providerRef is exposed.
      |--------------------------------------------------------------------------
      */

      checkout: {
        select: {
          id: true,
          status: true,

          payment: {
            select: {
              status: true,
              paidAt: true,
              refundedAt: true,
              releasedAt: true,
            },
          },
        },
      },

      /*
      |--------------------------------------------------------------------------
      | Shipments
      |--------------------------------------------------------------------------
      |
      | Fetch both shipment types.
      | The controller decides what Buyer, Seller and Admin can see.
      |--------------------------------------------------------------------------
      */

      shipments: {
        select: {
          id: true,
          shipmentType: true,
          carrier: true,
          trackingNumber: true,
          status: true,
          shippedAt: true,
          deliveredAt: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      },

      /*
      |--------------------------------------------------------------------------
      | Inspection
      |--------------------------------------------------------------------------
      |
      | Notes are selected here, but the controller will hide them
      | from the Buyer.
      |--------------------------------------------------------------------------
      */

      inspection: {
        select: {
          result: true,
          verifiedCondition: true,
          verifiedScore: true,
          notes: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });
};

export const findOrdersBySeller = async (sellerId, db = prisma) => {
  return await db.order.findMany({
    where: {
      sellerId,
    },

    select: {
      id: true,
      orderNumber: true,
      agreedPrice: true,
      status: true,
      lockedAt: true,
      completedAt: true,
      cancelledAt: true,
      rejectedAt: true,
      createdAt: true,
      updatedAt: true,

      listing: {
        select: {
          id: true,
          title: true,
          brand: true,
          model: true,
          status: true,
          estimatedCondition: true,

          images: {
            select: {
              id: true,
              imageKey: true,
              sortOrder: true,
              isCover: true,
            },

            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },

      buyer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      shipments: {
        select: {
          id: true,
          shipmentType: true,
          carrier: true,
          trackingNumber: true,
          status: true,
          shippedAt: true,
          deliveredAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      },

      inspection: {
        select: {
          result: true,
          verifiedCondition: true,
          verifiedScore: true,
          completedAt: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
};

export const findOrderForSellerShipment = async (orderId, db = prisma) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      orderNumber: true,
      sellerId: true,
      status: true,

      shipments: {
        where: {
          shipmentType: "SELLER_TO_ADMIN",
        },

        select: {
          id: true,
          shipmentType: true,
          status: true,
        },

        take: 1,
      },
    },
  });
};

export const markOrderAsSellerShipping = async (
  orderId,
  sellerId,
  db = prisma,
) => {
  return await db.order.updateMany({
    where: {
      id: orderId,
      sellerId,
      status: "PAID",

      shipments: {
        none: {
          shipmentType: "SELLER_TO_ADMIN",
        },
      },
    },

    data: {
      status: "SELLER_SHIPPING",
    },
  });
};

export const createSellerToAdminShipment = async (data, db = prisma) => {
  return await db.shipment.create({
    data: {
      orderId: data.orderId,
      shipmentType: "SELLER_TO_ADMIN",
      carrier: data.carrier,
      trackingNumber: data.trackingNumber,
      status: "SHIPPED",
      shippedAt: data.shippedAt,
    },

    select: {
      id: true,
      orderId: true,
      shipmentType: true,
      carrier: true,
      trackingNumber: true,
      status: true,
      shippedAt: true,
      deliveredAt: true,
      createdAt: true,
    },
  });
};
