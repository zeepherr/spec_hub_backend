import {
  assignSupportCaseAdminIfUnassigned,
  createSupportMessage,
  findMessageByClientMessageId,
  findSupportAccessByConversationId,
  markSupportMessagesAsRead,
  upsertAdminParticipant,
} from "../services/supportCase.service.js";

import {
  conversationIdSchema,
  sendSupportMessageSchema,
} from "../validations/supportCase.schema.js";

const getConversationRoom = (conversationId) => {
  return `conversation:${conversationId}`;
};

const sendAcknowledgement = (acknowledge, response) => {
  if (typeof acknowledge === "function") {
    acknowledge(response);
  }
};

const sendSocketError = (acknowledge, code, message) => {
  sendAcknowledgement(acknowledge, {
    success: false,
    code,
    message,
  });
};

const getValidationMessage = (error) => {
  return error?.issues?.[0]?.message || "Invalid Socket event data.";
};

/*
 * Admin can access every Support Case.
 *
 * Normal USER can only access the Support Case
 * that they personally opened.
 */
const getAuthorizedSupportCase = async (conversationId, user) => {
  const supportCase = await findSupportAccessByConversationId(conversationId);

  if (!supportCase) {
    return {
      error: {
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Support Case was not found.",
      },
    };
  }

  const isAdmin = user.role === "ADMIN";

  const isParticipant = supportCase.participantUserId === user.id;

  if (!isAdmin && !isParticipant) {
    return {
      error: {
        code: "CONVERSATION_FORBIDDEN",
        message: "You cannot access this Support conversation.",
      },
    };
  }

  return {
    supportCase,
  };
};

export const registerSupportChatHandlers = (io, socket) => {
  /*
   * conversation:join
   *
   * Client must join before sending or reading messages.
   */
  socket.on("conversation:join", async (payload, acknowledge) => {
    try {
      const { conversationId } = conversationIdSchema.parse(payload);

      const user = socket.data.user;

      const authorization = await getAuthorizedSupportCase(
        conversationId,
        user,
      );

      if (authorization.error) {
        return sendSocketError(
          acknowledge,
          authorization.error.code,
          authorization.error.message,
        );
      }

      if (user.role === "ADMIN") {
        await Promise.all([
          upsertAdminParticipant(conversationId, user.id),

          assignSupportCaseAdminIfUnassigned(conversationId, user.id),
        ]);
      }

      const room = getConversationRoom(conversationId);

      await socket.join(room);

      return sendAcknowledgement(acknowledge, {
        success: true,
        message: "Conversation joined successfully.",
        data: {
          supportCaseId: authorization.supportCase.id,
          conversationId,
          room,
        },
      });
    } catch (error) {
      if (error?.name === "ZodError") {
        return sendSocketError(
          acknowledge,
          "VALIDATION_ERROR",
          getValidationMessage(error),
        );
      }

      console.error("conversation:join error:", error);

      return sendSocketError(
        acknowledge,
        "INTERNAL_ERROR",
        "Unable to join the conversation.",
      );
    }
  });

  /*
   * conversation:leave
   */
  socket.on("conversation:leave", async (payload, acknowledge) => {
    try {
      const { conversationId } = conversationIdSchema.parse(payload);

      const room = getConversationRoom(conversationId);

      await socket.leave(room);

      return sendAcknowledgement(acknowledge, {
        success: true,
        message: "Conversation left successfully.",
        data: {
          conversationId,
        },
      });
    } catch (error) {
      if (error?.name === "ZodError") {
        return sendSocketError(
          acknowledge,
          "VALIDATION_ERROR",
          getValidationMessage(error),
        );
      }

      console.error("conversation:leave error:", error);

      return sendSocketError(
        acknowledge,
        "INTERNAL_ERROR",
        "Unable to leave the conversation.",
      );
    }
  });

  /*
   * message:send
   *
   * PostgreSQL save happens before message:new broadcast.
   */
  socket.on("message:send", async (payload, acknowledge) => {
    let validatedData;

    try {
      validatedData = sendSupportMessageSchema.parse(payload);

      const { conversationId, clientMessageId, content } = validatedData;

      const user = socket.data.user;

      const authorization = await getAuthorizedSupportCase(
        conversationId,
        user,
      );

      if (authorization.error) {
        return sendSocketError(
          acknowledge,
          authorization.error.code,
          authorization.error.message,
        );
      }

      const room = getConversationRoom(conversationId);

      /*
       * A client must join the authorized room before
       * it is allowed to send messages.
       */
      if (!socket.rooms.has(room)) {
        return sendSocketError(
          acknowledge,
          "CONVERSATION_NOT_JOINED",
          "Join the conversation before sending messages.",
        );
      }

      /*
       * If this clientMessageId already exists, return
       * the saved message instead of creating a duplicate.
       */
      const existingMessage =
        await findMessageByClientMessageId(clientMessageId);

      if (existingMessage) {
        const belongsToSameMessage =
          existingMessage.senderId === user.id &&
          existingMessage.conversationId === conversationId;

        if (!belongsToSameMessage) {
          return sendSocketError(
            acknowledge,
            "CLIENT_MESSAGE_ID_CONFLICT",
            "This client message ID has already been used.",
          );
        }

        return sendAcknowledgement(acknowledge, {
          success: true,
          message: "Message was already saved.",
          data: {
            messageId: existingMessage.id,
            clientMessageId: existingMessage.clientMessageId,
            duplicate: true,
          },
        });
      }

      const shouldReopenCase = ["RESOLVED", "CLOSED"].includes(
        authorization.supportCase.status,
      );

      const savedMessage = await createSupportMessage({
        conversationId,
        senderId: user.id,
        clientMessageId,
        content,
        reopenCase: shouldReopenCase,
      });

      /*
       * Broadcast only after PostgreSQL saved successfully.
       */
      io.to(room).emit("message:new", {
        success: true,
        data: savedMessage,
      });
      const caseUpdate = {
        id: authorization.supportCase.id,
        conversationId,
        participantUserId: authorization.supportCase.participantUserId,

        status: shouldReopenCase ? "OPEN" : authorization.supportCase.status,

        updatedAt: new Date().toISOString(),

        lastMessage: savedMessage,
      };

      io.to(`user:${authorization.supportCase.participantUserId}`).emit(
        "support:case-updated",
        {
          success: true,
          data: caseUpdate,
        },
      );

      io.to("support:admins").emit("support:case-updated", {
        success: true,
        data: caseUpdate,
      });

      return sendAcknowledgement(acknowledge, {
        success: true,
        message: "Message sent successfully.",
        data: {
          messageId: savedMessage.id,
          clientMessageId: savedMessage.clientMessageId,
          duplicate: false,
        },
      });
    } catch (error) {
      if (error?.name === "ZodError") {
        return sendSocketError(
          acknowledge,
          "VALIDATION_ERROR",
          getValidationMessage(error),
        );
      }

      /*
       * Handles two identical messages arriving at almost
       * the same time.
       */
      if (error?.code === "P2002" && validatedData?.clientMessageId) {
        try {
          const existingMessage = await findMessageByClientMessageId(
            validatedData.clientMessageId,
          );

          if (
            existingMessage &&
            existingMessage.senderId === socket.data.user.id &&
            existingMessage.conversationId === validatedData.conversationId
          ) {
            return sendAcknowledgement(acknowledge, {
              success: true,
              message: "Message was already saved.",
              data: {
                messageId: existingMessage.id,
                clientMessageId: existingMessage.clientMessageId,
                duplicate: true,
              },
            });
          }
        } catch (findError) {
          console.error("Duplicate message lookup error:", findError);
        }
      }

      console.error("message:send error:", error);

      return sendSocketError(
        acknowledge,
        "MESSAGE_SEND_FAILED",
        "Unable to send the message.",
      );
    }
  });

  /*
   * message:read
   *
   * Marks every unread message sent by the other side.
   */
  socket.on("message:read", async (payload, acknowledge) => {
    try {
      const { conversationId } = conversationIdSchema.parse(payload);

      const user = socket.data.user;

      const authorization = await getAuthorizedSupportCase(
        conversationId,
        user,
      );

      if (authorization.error) {
        return sendSocketError(
          acknowledge,
          authorization.error.code,
          authorization.error.message,
        );
      }

      const room = getConversationRoom(conversationId);

      if (!socket.rooms.has(room)) {
        return sendSocketError(
          acknowledge,
          "CONVERSATION_NOT_JOINED",
          "Join the conversation before reading messages.",
        );
      }

      const readAt = new Date();

      const result = await markSupportMessagesAsRead(
        conversationId,
        user.id,
        readAt,
      );

      if (result.count > 0) {
        io.to(room).emit("message:read", {
          success: true,

          data: {
            conversationId,
            readerId: user.id,
            readAt: readAt.toISOString(),
            updatedCount: result.count,
          },
        });
      }

      return sendAcknowledgement(acknowledge, {
        success: true,
        message: "Messages marked as read.",
        data: {
          conversationId,
          updatedCount: result.count,
        },
      });
    } catch (error) {
      if (error?.name === "ZodError") {
        return sendSocketError(
          acknowledge,
          "VALIDATION_ERROR",
          getValidationMessage(error),
        );
      }

      console.error("message:read error:", error);

      return sendSocketError(
        acknowledge,
        "MESSAGE_READ_FAILED",
        "Unable to mark messages as read.",
      );
    }
  });
};
