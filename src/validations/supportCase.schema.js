import { z } from "zod";

export const sendSupportMessageSchema = z.object({
  conversationId: z.coerce
    .number()
    .int("Conversation ID must be an integer.")
    .positive("Conversation ID must be positive."),

  clientMessageId: z.uuid(),

  content: z
    .string()
    .trim()
    .min(1, "Message content is required.")
    .max(2000, "Message must not exceed 2000 characters."),
});

export const supportIssueTypeSchema = z.enum([
  "PRODUCT_NOT_AS_DESCRIBED",
  "PAYMENT",
  "SHIPPING",
  "DAMAGED_PRODUCT",
  "SELLER_NOT_RESPONDING",
  "BUYER_NOT_RESPONDING",
  "OTHER",
]);

export const supportStatusSchema = z.enum([
  "OPEN",
  "INVESTIGATING",
  "WAITING_FOR_BUYER",
  "WAITING_FOR_SELLER",
  "RESOLVED",
  "CLOSED",
]);

export const createSupportCaseSchema = z.object({
  orderId: z.coerce
    .number()
    .int("Order ID must be an integer.")
    .positive("Order ID must be positive."),

  issueType: supportIssueTypeSchema,

  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(2000, "Message must not exceed 2000 characters."),
});

export const supportCaseIdSchema = z.object({
  supportCaseId: z.coerce
    .number()
    .int("Support Case ID must be an integer.")
    .positive("Support Case ID must be positive."),
});

export const conversationIdSchema = z.object({
  conversationId: z.coerce
    .number()
    .int("Conversation ID must be an integer.")
    .positive("Conversation ID must be positive."),
});

export const supportMessagesQuerySchema = z.object({
  cursor: z.coerce
    .number()
    .int("Cursor must be an integer.")
    .positive("Cursor must be positive.")
    .optional(),

  limit: z.coerce
    .number()
    .int("Limit must be an integer.")
    .min(1, "Limit must be at least 1.")
    .max(100, "Limit must not exceed 100.")
    .default(50),
});

export const updateSupportCaseStatusSchema = z.object({
  status: supportStatusSchema,

  resolutionNote: z
    .string()
    .trim()
    .max(2000, "Resolution note must not exceed 2000 characters.")
    .optional(),
});

export const createAdminSupportCaseSchema = z.object({
  orderId: z.coerce
    .number()
    .int("Order ID must be an integer.")
    .positive("Order ID must be positive."),

  targetRoles: z
    .array(z.enum(["BUYER", "SELLER"]))
    .min(1, "Select at least one recipient.")
    .max(2, "Maximum two recipients.")
    .refine(
      (roles) => new Set(roles).size === roles.length,
      "Duplicate recipient roles are not allowed.",
    ),

  issueType: supportIssueTypeSchema,

  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(2000, "Message must not exceed 2000 characters."),
});
