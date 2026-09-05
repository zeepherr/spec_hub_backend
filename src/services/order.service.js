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
              refundedAmount: true,
              refundedAt: true,
            },
          },

          refund: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              processedAt: true,
              failedAt: true,
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

export const findOrderForDeliveryConfirmation = async (
  orderId,
  db = prisma,
) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      orderNumber: true,
      checkoutId: true,
      listingId: true,
      buyerId: true,
      status: true,

      listing: {
        select: {
          id: true,
          status: true,
        },
      },

      shipments: {
        where: {
          shipmentType: "ADMIN_TO_BUYER",
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

        take: 1,
      },
    },
  });
};

export const markOrderCompleted = async (
  orderId,
  buyerId,
  completedAt,
  db = prisma,
) => {
  return await db.order.updateMany({
    where: {
      id: orderId,
      buyerId,
      status: "SHIPPING_TO_BUYER",
    },

    data: {
      status: "COMPLETED",
      completedAt,
    },
  });
};

export const markBuyerShipmentDelivered = async (
  orderId,
  deliveredAt,
  db = prisma,
) => {
  return await db.shipment.updateMany({
    where: {
      orderId,
      shipmentType: "ADMIN_TO_BUYER",

      status: {
        in: ["SHIPPED", "IN_TRANSIT"],
      },
    },

    data: {
      status: "DELIVERED",
      deliveredAt,
    },
  });
};

export const findBuyerShipmentByOrderId = async (orderId, db = prisma) => {
  return await db.shipment.findFirst({
    where: {
      orderId,
      shipmentType: "ADMIN_TO_BUYER",
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

export const markListingSold = async (listingId, db = prisma) => {
  return await db.listing.updateMany({
    where: {
      id: listingId,
      status: "RESERVED",
    },

    data: {
      status: "SOLD",
    },
  });
};

// Finds the Checkout state needed to decide whether
// the remaining Payment can be released.
export const findCheckoutForSettlement = async (checkoutId, db = prisma) => {
  return await db.checkout.findUnique({
    where: {
      id: checkoutId,
    },

    select: {
      id: true,
      status: true,

      orders: {
        select: {
          id: true,
          status: true,
        },
      },

      payment: {
        select: {
          id: true,
          amount: true,
          refundedAmount: true,
          status: true,
          releasedAt: true,
        },
      },

      refund: {
        select: {
          id: true,
          amount: true,
          status: true,
        },
      },
    },
  });
};

export const markCheckoutPaymentReleased = async (
  checkoutId,
  releasedAt,
  db = prisma,
) => {
  return await db.payment.updateMany({
    where: {
      checkoutId,

      status: {
        in: ["PAID", "PARTIALLY_REFUNDED"],
      },
    },

    data: {
      status: "RELEASED",
      releasedAt,
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

      // | Buyer and Seller

      // | Only safe identity fields are selected.
      // | Email, phone, address and password are excluded.

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

      // | Checkout and Payment

      // | No Stripe providerRef is exposed.

      checkout: {
        select: {
          id: true,
          status: true,

          shippingRecipientName: true,
          shippingPhone: true,
          shippingAddress: true,

          payment: {
            select: {
              status: true,
              paidAt: true,

              refundedAmount: true,
              refundedAt: true,

              releasedAt: true,
            },
          },

          refund: {
            select: {
              id: true,
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
      },
      // Fetch all shipment directions.
      // The controller decides what each role can see.

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

      // | Inspection

      // | Notes are selected here, but the controller will hide them
      // | from the Buyer.

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

export const findOrdersForAdmin = async (statuses, db = prisma) => {
  return await db.order.findMany({
    where:
      statuses?.length > 0
        ? {
            status: {
              in: statuses,
            },
          }
        : {},

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

          images: {
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
          email: true,
        },
      },

      seller: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      checkout: {
        select: {
          id: true,
          status: true,

          shippingRecipientName: true,
          shippingPhone: true,
          shippingAddress: true,

          payment: {
            select: {
              id: true,
              amount: true,
              refundedAmount: true,

              status: true,

              paidAt: true,
              refundedAt: true,
              releasedAt: true,
            },
          },

          refund: {
            select: {
              id: true,
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
          createdAt: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      },

      inspection: {
        select: {
          id: true,
          result: true,
          verifiedCondition: true,
          verifiedScore: true,
          notes: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },

    orderBy: {
      createdAt: "asc",
    },
  });
};

// Finds the order and seller shipment before Admin receives it.
export const findOrderForAdminReceipt = async (orderId, db = prisma) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      orderNumber: true,
      status: true,

      shipments: {
        where: {
          shipmentType: "SELLER_TO_ADMIN",
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

        take: 1,
      },
    },
  });
};

// Changes the Order only when it is still waiting for Admin receipt.
export const markOrderInspectionPending = async (orderId, db = prisma) => {
  return await db.order.updateMany({
    where: {
      id: orderId,
      status: "SELLER_SHIPPING",
    },

    data: {
      status: "INSPECTION_PENDING",
    },
  });
};

// Marks the Seller-to-Admin shipment as delivered.
export const markSellerShipmentDelivered = async (
  orderId,
  deliveredAt,
  db = prisma,
) => {
  return await db.shipment.updateMany({
    where: {
      orderId,
      shipmentType: "SELLER_TO_ADMIN",

      status: {
        in: ["SHIPPED", "IN_TRANSIT"],
      },
    },

    data: {
      status: "DELIVERED",
      deliveredAt,
    },
  });
};

// Returns the updated Seller-to-Admin shipment.
export const findSellerShipmentByOrderId = async (orderId, db = prisma) => {
  return await db.shipment.findFirst({
    where: {
      orderId,
      shipmentType: "SELLER_TO_ADMIN",
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

// Finds an Order before starting its inspection.
export const findOrderForInspectionStart = async (orderId, db = prisma) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      orderNumber: true,
      status: true,

      inspection: {
        select: {
          id: true,
          adminId: true,
          result: true,
          startedAt: true,
        },
      },
    },
  });
};

// Changes the Order only if it is waiting for inspection.
export const markOrderInspecting = async (orderId, db = prisma) => {
  return await db.order.updateMany({
    where: {
      id: orderId,
      status: "INSPECTION_PENDING",
    },

    data: {
      status: "INSPECTING",
    },
  });
};

// Creates the inspection and assigns it to the Admin.
export const createOrderInspection = async (data, db = prisma) => {
  return await db.inspection.create({
    data: {
      orderId: data.orderId,
      adminId: data.adminId,
      result: "PENDING",
      startedAt: data.startedAt,
    },

    select: {
      id: true,
      orderId: true,
      adminId: true,
      result: true,
      verifiedCondition: true,
      verifiedScore: true,
      notes: true,
      startedAt: true,
      completedAt: true,
    },
  });
};

export const findOrderForInspectionCompletion = async (
  orderId,
  db = prisma,
) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      listingId: true,
      checkoutId: true,
      orderNumber: true,
      status: true,

      inspection: {
        select: {
          id: true,
          orderId: true,
          adminId: true,
          result: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });
};

export const completeOrderInspection = async (
  inspectionId,
  adminId,
  data,
  db = prisma,
) => {
  return await db.inspection.updateMany({
    where: {
      id: inspectionId,
      adminId,
      result: "PENDING",
      completedAt: null,
    },

    data: {
      result: data.result,
      verifiedCondition: data.verifiedCondition ?? null,
      verifiedScore: data.verifiedScore ?? null,
      notes: data.notes ?? null,
      completedAt: data.completedAt,
    },
  });
};

export const markOrderAfterInspection = async (
  orderId,
  nextStatus,
  completedAt,
  db = prisma,
) => {
  return await db.order.updateMany({
    where: {
      id: orderId,
      status: "INSPECTING",
    },

    data: {
      status: nextStatus,

      ...(nextStatus === "REJECTED" && {
        rejectedAt: completedAt,
      }),
    },
  });
};

export const findInspectionById = async (inspectionId, db = prisma) => {
  return await db.inspection.findUnique({
    where: {
      id: inspectionId,
    },

    select: {
      id: true,
      orderId: true,
      adminId: true,
      result: true,
      verifiedCondition: true,
      verifiedScore: true,
      notes: true,
      startedAt: true,
      completedAt: true,
    },
  });
};

// Finds a verified Order before shipping it to the Buyer.
export const findOrderForBuyerShipment = async (orderId, db = prisma) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      orderNumber: true,
      status: true,

      checkout: {
        select: {
          shippingRecipientName: true,
          shippingPhone: true,
          shippingAddress: true,
        },
      },

      shipments: {
        where: {
          shipmentType: "ADMIN_TO_BUYER",
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

// Changes the Order only if it is still VERIFIED
// and has no Admin-to-Buyer shipment.
export const markOrderAsShippingToBuyer = async (orderId, db = prisma) => {
  return await db.order.updateMany({
    where: {
      id: orderId,
      status: "VERIFIED",

      shipments: {
        none: {
          shipmentType: "ADMIN_TO_BUYER",
        },
      },
    },

    data: {
      status: "SHIPPING_TO_BUYER",
    },
  });
};

// Creates the Admin-to-Buyer shipment.
export const createAdminToBuyerShipment = async (data, db = prisma) => {
  return await db.shipment.create({
    data: {
      orderId: data.orderId,
      shipmentType: "ADMIN_TO_BUYER",
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

export const markListingRejected = async (listingId, db = prisma) => {
  return await db.listing.updateMany({
    where: {
      id: listingId,
      status: "RESERVED",
    },

    data: {
      status: "REJECTED",
    },
  });
};

// Finds a rejected Order before Admin returns
// the product to the Seller.
export const findOrderForReturnToSeller = async (orderId, db = prisma) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      orderNumber: true,
      sellerId: true,
      status: true,

      listing: {
        select: {
          id: true,
          status: true,
        },
      },

      inspection: {
        select: {
          id: true,
          result: true,
          completedAt: true,
        },
      },

      seller: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true,
        },
      },

      shipments: {
        where: {
          shipmentType: "ADMIN_TO_SELLER",
        },

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

        take: 1,
      },
    },
  });
};

// Creates the Admin-to-Seller return shipment.
export const createAdminToSellerShipment = async (data, db = prisma) => {
  return await db.shipment.create({
    data: {
      orderId: data.orderId,

      shipmentType: "ADMIN_TO_SELLER",

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

// Returns the current Admin-to-Seller shipment.
export const findReturnShipmentByOrderId = async (orderId, db = prisma) => {
  return await db.shipment.findUnique({
    where: {
      orderId_shipmentType: {
        orderId,
        shipmentType: "ADMIN_TO_SELLER",
      },
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
