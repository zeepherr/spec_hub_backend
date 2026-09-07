import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";

const userPreviewSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  profileImageKey: true,
};

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  clientMessageId: true,
  content: true,
  readAt: true,
  createdAt: true,

  sender: {
    select: userPreviewSelect,
  },
};

const supportCaseSelect = {
  id: true,
  orderId: true,
  conversationId: true,
  openedById: true,
  adminId: true,
  issueType: true,
  status: true,
  resolutionNote: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,

  openedBy: {
    select: userPreviewSelect,
  },

  admin: {
    select: userPreviewSelect,
  },

  order: {
    select: {
      id: true,
      orderNumber: true,
      buyerId: true,
      sellerId: true,
      status: true,
      createdAt: true,

      listing: {
        select: {
          id: true,
          title: true,
          brand: true,
          model: true,
        },
      },
    },
  },

  conversation: {
    select: {
      id: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,

      participants: {
        select: {
          id: true,
          userId: true,
          roleInChat: true,
          joinedAt: true,

          user: {
            select: userPreviewSelect,
          },
        },
      },

      messages: {
        select: messageSelect,
        orderBy: {
          id: "desc",
        },
        take: 1,
      },
    },
  },
};

/*
 * Finds the Order before creating or accessing a Support Case.
 * Buyer/Seller permission will be determined from these IDs.
 */
export const findOrderForSupport = async (orderId, db = prisma) => {
  return await db.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      orderNumber: true,
      buyerId: true,
      sellerId: true,
      status: true,
      createdAt: true,
    },
  });
};

/*
 * Finds the one Support Case belonging to one user and one Order.
 */
export const findSupportCaseByOrderAndOpener = async (
  orderId,
  openedById,
  db = prisma,
) => {
  return await db.supportCase.findUnique({
    where: {
      orderId_openedById: {
        orderId,
        openedById,
      },
    },

    select: supportCaseSelect,
  });
};

/*
 * Creates all initial Support Case records atomically:
 *
 * Conversation
 * ConversationParticipant
 * First Message
 * SupportCase
 *
 * If one operation fails, all operations are rolled back.
 */
export const createSupportCaseWithConversation = async ({
  orderId,
  openedById,
  roleInChat,
  issueType,
  message,
}) => {
  return await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        orderId,
        createdById: openedById,
      },

      select: {
        id: true,
      },
    });

    await tx.conversationParticipant.create({
      data: {
        conversationId: conversation.id,
        userId: openedById,
        roleInChat,
      },
    });

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: openedById,
        clientMessageId: randomUUID(),
        content: message,
      },
    });

    return await tx.supportCase.create({
      data: {
        orderId,
        conversationId: conversation.id,
        openedById,
        issueType,
      },

      select: supportCaseSelect,
    });
  });
};

/*
 * Returns Support Cases opened by the logged-in Buyer/Seller.
 */
export const findSupportCasesByUser = async (userId, db = prisma) => {
  return await db.supportCase.findMany({
    where: {
      openedById: userId,
    },

    select: supportCaseSelect,

    orderBy: {
      updatedAt: "desc",
    },
  });
};

/*
 * Returns all Support Cases for the Admin queue.
 */
export const findSupportCasesForAdmin = async (db = prisma) => {
  return await db.supportCase.findMany({
    select: supportCaseSelect,

    orderBy: {
      updatedAt: "desc",
    },
  });
};

/*
 * Finds one Support Case by its primary ID.
 */
export const findSupportCaseById = async (supportCaseId, db = prisma) => {
  return await db.supportCase.findUnique({
    where: {
      id: supportCaseId,
    },

    select: supportCaseSelect,
  });
};

/*
 * Used by Socket.IO authorization.
 *
 * Because conversationId is unique, one Conversation belongs
 * to exactly one Support Case.
 */
export const findSupportAccessByConversationId = async (
  conversationId,
  db = prisma,
) => {
  return await db.supportCase.findUnique({
    where: {
      conversationId,
    },

    select: {
      id: true,
      orderId: true,
      conversationId: true,
      openedById: true,
      adminId: true,
      status: true,

      order: {
        select: {
          buyerId: true,
          sellerId: true,
        },
      },
    },
  });
};

/*
 * Returns paginated messages.
 *
 * Database reads newest-to-oldest for efficient pagination,
 * then the result is reversed for displaying oldest-to-newest.
 */
export const findSupportMessages = async (
  { conversationId, cursor, limit },
  db = prisma,
) => {
  const result = await db.message.findMany({
    where: {
      conversationId,

      ...(cursor
        ? {
            id: {
              lt: cursor,
            },
          }
        : {}),
    },

    select: messageSelect,

    orderBy: {
      id: "desc",
    },

    take: limit + 1,
  });

  const hasNextPage = result.length > limit;
  const page = hasNextPage ? result.slice(0, limit) : result;

  const nextCursor =
    hasNextPage && page.length > 0 ? page[page.length - 1].id : null;

  return {
    messages: page.reverse(),
    nextCursor,
  };
};

/*
 * Checks whether a Socket message was already saved.
 */
export const findMessageByClientMessageId = async (
  clientMessageId,
  db = prisma,
) => {
  return await db.message.findUnique({
    where: {
      clientMessageId,
    },

    select: messageSelect,
  });
};

/*
 * Saves a new Socket message and updates the Support Case activity time.
 */
export const createSupportMessage = async ({
  conversationId,
  senderId,
  clientMessageId,
  content,
  reopenCase = false,
}) => {
  return await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        senderId,
        clientMessageId,
        content,
      },

      select: messageSelect,
    });

    /*
     * A new message moves the Support Case to the top
     * of the Admin queue.
     *
     * If someone sends a new message after the case was
     * resolved or closed, the case becomes OPEN again.
     */
    await tx.supportCase.update({
      where: {
        conversationId,
      },

      data: {
        updatedAt: new Date(),

        ...(reopenCase
          ? {
              status: "OPEN",
              resolutionNote: null,
              resolvedAt: null,
            }
          : {}),
      },
    });

    return message;
  });
};

/*
 * Adds an Admin to the participants list when the Admin
 * first accesses this conversation.
 *
 * Repeated joins do not create duplicate participants.
 */
export const upsertAdminParticipant = async (
  conversationId,
  adminId,
  db = prisma,
) => {
  return await db.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId,
        userId: adminId,
      },
    },

    create: {
      conversationId,
      userId: adminId,
      roleInChat: "ADMIN",
    },

    update: {
      roleInChat: "ADMIN",
    },
  });
};

/*
 * Marks all unread messages from the other side as read.
 * A user does not mark their own messages as read.
 */
export const markSupportMessagesAsRead = async (
  conversationId,
  readerId,
  readAt = new Date(),
  db = prisma,
) => {
  return await db.message.updateMany({
    where: {
      conversationId,

      senderId: {
        not: readerId,
      },

      readAt: null,
    },

    data: {
      readAt,
    },
  });
};

/*
 * Admin updates Support Case status.
 */
export const updateSupportCaseStatus = async (
  supportCaseId,
  { status, resolutionNote },
  db = prisma,
) => {
  const isResolved = status === "RESOLVED" || status === "CLOSED";

  return await db.supportCase.update({
    where: {
      id: supportCaseId,
    },

    data: {
      status,

      ...(resolutionNote !== undefined
        ? {
            resolutionNote,
          }
        : {}),

      resolvedAt: isResolved ? new Date() : null,
    },

    select: supportCaseSelect,
  });
};

/*
 * The first Admin who joins becomes the assigned Admin.
 *
 * Other Admins can still access the case, but this field
 * shows who first handled it.
 */
export const assignSupportCaseAdminIfUnassigned = async (
  conversationId,
  adminId,
  db = prisma,
) => {
  return await db.supportCase.updateMany({
    where: {
      conversationId,
      adminId: null,
    },

    data: {
      adminId,
    },
  });
};
