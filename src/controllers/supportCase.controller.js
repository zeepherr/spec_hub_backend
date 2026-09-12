import createHttpError from "http-errors";

import {
  createAdminSupportCasesWithConversations,
  createSupportCaseWithConversation,
  findOrderForSupport,
  findSupportCaseById,
  findSupportCaseByOrderAndParticipant,
  findSupportCasesByUser,
  findSupportCasesForAdmin,
  findSupportMessages,
  updateSupportCaseStatus,
} from "../services/supportCase.service.js";

import { toSupportCaseResponse } from "../utils/supportCase.response.js";
import {
  createAdminSupportCaseSchema,
  createSupportCaseSchema,
  supportCaseIdSchema,
  supportMessagesQuerySchema,
  updateSupportCaseStatusSchema,
} from "../validations/supportCase.schema.js";

/*
 * Checks whether the authenticated user is allowed
 * to access one Support Case.
 *
 * Normal USER can access the case only when they are
 * the private participant of that case.
 *
 * Admin can access every Support Case.
 */
const canAccessSupportCase = (supportCase, user) => {
  return supportCase.participantUserId === user.id || user.role === "ADMIN";
};

/*
 * Determines whether the current USER is the Buyer
 * or Seller of the selected Order.
 */
const getOrderChatRole = (order, userId) => {
  if (order.buyerId === userId) {
    return "BUYER";
  }

  if (order.sellerId === userId) {
    return "SELLER";
  }

  return null;
};

/*
 * POST /api/support-cases
 *
 * Creates a new Order Support Case.
 * If the user already has a Support Case for this Order,
 * the existing case is returned instead.
 */
export const createSupportCase = async (req, res, next) => {
  let parsedBody;

  try {
    parsedBody = createSupportCaseSchema.parse(req.body);

    const { orderId, issueType, message } = parsedBody;
    const openedById = req.user.id;

    const order = await findOrderForSupport(orderId);

    if (!order) {
      throw createHttpError(404, "Order not found.");
    }

    const roleInChat = getOrderChatRole(order, openedById);

    if (!roleInChat) {
      throw createHttpError(
        403,
        "You cannot create a Support Case for this Order.",
      );
    }

    /*
     * One user can only have one Support Case per Order.
     *
     * Buyer and Seller still get separate cases because
     * they have different user IDs.
     */
    const existingSupportCase = await findSupportCaseByOrderAndParticipant(
      orderId,
      openedById,
    );

    if (existingSupportCase) {
      return res.status(200).json({
        success: true,
        message: "Support Case already exists.",
        data: toSupportCaseResponse(existingSupportCase),
        meta: {
          created: false,
        },
      });
    }

    const supportCase = await createSupportCaseWithConversation({
      orderId,
      openedById,
      participantUserId: openedById,
      roleInChat,
      issueType,
      message,
    });
    const supportCaseResponse = toSupportCaseResponse(supportCase);

    const io = req.app.get("io");

    io?.to("support:admins").emit("support:case-created", {
      success: true,
      data: supportCaseResponse,
    });

    return res.status(201).json({
      success: true,
      message: "Support Case created successfully.",
      data: supportCaseResponse,
      meta: {
        created: true,
      },
    });
  } catch (error) {
    /*
     * Protects against two identical requests arriving
     * at almost the same time.
     *
     * The database unique constraint rejects one request,
     * and we return the already-created Support Case.
     */
    if (error?.code === "P2002" && parsedBody) {
      try {
        const existingSupportCase = await findSupportCaseByOrderAndParticipant(
          parsedBody.orderId,
          req.user.id,
        );

        if (existingSupportCase) {
          return res.status(200).json({
            success: true,
            message: "Support Case already exists.",
            data: toSupportCaseResponse(existingSupportCase),
            meta: {
              created: false,
            },
          });
        }
      } catch (findError) {
        return next(findError);
      }
    }

    return next(error);
  }
};

/*
 * GET /api/support-cases
 *
 * Returns the logged-in USER's own Support Cases.
 */
export const getMySupportCases = async (req, res, next) => {
  try {
    const supportCases = await findSupportCasesByUser(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Support Cases fetched successfully.",
      data: supportCases.map(toSupportCaseResponse),
    });
  } catch (error) {
    return next(error);
  }
};

/*
 * GET /api/support-cases/:supportCaseId
 *
 * Returns one Support Case detail.
 */
export const getSupportCaseDetail = async (req, res, next) => {
  try {
    const { supportCaseId } = supportCaseIdSchema.parse(req.params);

    const supportCase = await findSupportCaseById(supportCaseId);

    if (!supportCase) {
      throw createHttpError(404, "Support Case not found.");
    }

    if (!canAccessSupportCase(supportCase, req.user)) {
      throw createHttpError(403, "You cannot access this Support Case.");
    }

    return res.status(200).json({
      success: true,
      message: "Support Case fetched successfully.",
      data: toSupportCaseResponse(supportCase),
    });
  } catch (error) {
    return next(error);
  }
};

/*
 * GET /api/support-cases/:supportCaseId/messages
 *
 * Returns paginated message history.
 */
export const getSupportCaseMessages = async (req, res, next) => {
  try {
    const { supportCaseId } = supportCaseIdSchema.parse(req.params);

    const { cursor, limit } = supportMessagesQuerySchema.parse(req.query);

    const supportCase = await findSupportCaseById(supportCaseId);

    if (!supportCase) {
      throw createHttpError(404, "Support Case not found.");
    }

    if (!canAccessSupportCase(supportCase, req.user)) {
      throw createHttpError(
        403,
        "You cannot access messages from this Support Case.",
      );
    }

    const result = await findSupportMessages({
      conversationId: supportCase.conversationId,
      cursor,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "Support messages fetched successfully.",
      data: result.messages,
      pagination: {
        nextCursor: result.nextCursor,
        hasNextPage: result.nextCursor !== null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/*
 * GET /api/admin/support-cases
 *
 * Returns the Admin Support Case queue.
 * Route authorization will restrict this to ADMIN.
 */
export const getAdminSupportCases = async (req, res, next) => {
  try {
    const supportCases = await findSupportCasesForAdmin();

    return res.status(200).json({
      success: true,
      message: "Admin Support Cases fetched successfully.",
      data: supportCases.map(toSupportCaseResponse),
    });
  } catch (error) {
    return next(error);
  }
};

/*
 * GET /api/admin/support-cases/:supportCaseId
 *
 * Admin Support Case detail.
 */
export const getAdminSupportCaseDetail = async (req, res, next) => {
  try {
    const { supportCaseId } = supportCaseIdSchema.parse(req.params);

    const supportCase = await findSupportCaseById(supportCaseId);

    if (!supportCase) {
      throw createHttpError(404, "Support Case not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Admin Support Case fetched successfully.",
      data: toSupportCaseResponse(supportCase),
    });
  } catch (error) {
    return next(error);
  }
};

/*
 * PATCH /api/admin/support-cases/:supportCaseId/status
 *
 * Only Admin can update Support Case status.
 */
export const updateAdminSupportCaseStatus = async (req, res, next) => {
  try {
    const { supportCaseId } = supportCaseIdSchema.parse(req.params);

    const data = updateSupportCaseStatusSchema.parse(req.body);

    const existingSupportCase = await findSupportCaseById(supportCaseId);

    if (!existingSupportCase) {
      throw createHttpError(404, "Support Case not found.");
    }

    const updatedSupportCase = await updateSupportCaseStatus(
      supportCaseId,
      data,
    );
    const response = toSupportCaseResponse(updatedSupportCase);
    const io = req.app.get("io");

    io?.to(`user:${response.participantUserId}`).emit("support:case-updated", {
      success: true,
      data: response,
    });

    io?.to("support:admins").emit("support:case-updated", {
      success: true,
      data: response,
    });
    return res.status(200).json({
      success: true,
      message: "Support Case status updated successfully.",
      data: response,
    });
  } catch (error) {
    return next(error);
  }
};

export const createAdminSupportCases = async (req, res, next) => {
  try {
    const { orderId, targetRoles, issueType, message } =
      createAdminSupportCaseSchema.parse(req.body);

    const adminId = req.user.id;

    const order = await findOrderForSupport(orderId);

    if (!order) {
      throw createHttpError(404, "Order not found.");
    }

    const results = await createAdminSupportCasesWithConversations({
      order,
      adminId,
      targetRoles,
      issueType,
      message,
    });

    const cases = results.map((result) => ({
      created: result.created,
      participantRole: result.participantRole,
      supportCase: toSupportCaseResponse(result.supportCase),
    }));

    const createdCases = cases.filter((item) => item.created);

    const io = req.app.get("io");

    for (const item of createdCases) {
      const supportCase = item.supportCase;

      io?.to(`user:${supportCase.participantUserId}`).emit(
        "support:case-created",
        {
          success: true,
          data: supportCase,
        },
      );

      io?.to("support:admins").emit("support:case-created", {
        success: true,
        data: supportCase,
      });
    }

    const anyCreated = createdCases.length > 0;

    return res.status(anyCreated ? 201 : 200).json({
      success: true,

      message: anyCreated
        ? "Support conversation prepared successfully."
        : "Support conversation already exists.",

      data: {
        cases,
      },

      meta: {
        createdCount: createdCases.length,

        reusedCount: cases.length - createdCases.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};
