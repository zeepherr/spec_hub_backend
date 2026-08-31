import { z } from "zod";

const answerTypeSchema = z.enum(["BOOLEAN", "NUMBER", "TEXT", "SELECT"]);

const optionsSchema = z
  .array(z.string().trim().min(1))
  .min(2, "SELECT question must have at least 2 options");

export const categoryIdSchema = z.object({
  params: z.object({
    categoryId: z.coerce.number().int().positive(),
  }),
});

export const questionParamsSchema = z.object({
  params: z.object({
    categoryId: z.coerce.number().int().positive(),
    questionId: z.coerce.number().int().positive(),
  }),
});

export const createConditionQuestionSchema = z.object({
  params: z.object({
    categoryId: z.coerce.number().int().positive(),
  }),

  body: z
    .object({
      label: z
        .string()
        .trim()
        .min(3, "Question must be at least 3 characters")
        .max(150, "Question must not exceed 150 characters"),

      answerType: answerTypeSchema,

      options: optionsSchema.optional(),

      isRequired: z.boolean().optional().default(true),

      isActive: z.boolean().optional().default(true),

      sortOrder: z.coerce.number().int().min(0).optional().default(0),
    })
    .superRefine((data, ctx) => {
      if (data.answerType === "SELECT" && !data.options) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Options are required for SELECT questions",
        });
      }

      if (data.answerType !== "SELECT" && data.options) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Options are only allowed for SELECT questions",
        });
      }
    }),
});

export const updateConditionQuestionSchema = z.object({
  params: z.object({
    categoryId: z.coerce.number().int().positive(),
    questionId: z.coerce.number().int().positive(),
  }),

  body: z
    .object({
      label: z.string().trim().min(3).max(150).optional(),

      answerType: answerTypeSchema.optional(),

      options: optionsSchema.nullable().optional(),

      isRequired: z.boolean().optional(),

      sortOrder: z.coerce.number().int().min(0).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const updateConditionQuestionStatusSchema = z.object({
  params: z.object({
    categoryId: z.coerce.number().int().positive(),
    questionId: z.coerce.number().int().positive(),
  }),

  body: z.object({
    isActive: z.boolean(),
  }),
});
