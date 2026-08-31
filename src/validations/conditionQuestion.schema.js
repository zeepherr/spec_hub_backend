import { z } from "zod";

const answerTypeSchema = z.enum(["TEXT", "NUMBER", "BOOLEAN", "SELECT"]);

const categoryParamsSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
});

const questionRouteParamsSchema = categoryParamsSchema.extend({
  questionId: z.coerce.number().int().positive(),
});

const optionsSchema = z
  .array(z.string().trim().min(1, "Option cannot be empty"))
  .min(1, "At least one option is required")
  .refine(
    (options) => new Set(options).size === options.length,
    "Options cannot contain duplicates",
  );

/*
|--------------------------------------------------------------------------
| GET QUESTIONS BY CATEGORY
|--------------------------------------------------------------------------
*/

export const categoryIdSchema = z.object({
  params: categoryParamsSchema,
});

/*
|--------------------------------------------------------------------------
| GET QUESTION BY ID
|--------------------------------------------------------------------------
*/

export const questionParamsSchema = z.object({
  params: questionRouteParamsSchema,
});

/*
|--------------------------------------------------------------------------
| CREATE QUESTION
|--------------------------------------------------------------------------
*/

export const createConditionQuestionSchema = z
  .object({
    params: categoryParamsSchema,

    body: z.object({
      label: z.string().trim().min(1, "Question label is required"),

      answerType: answerTypeSchema,

      options: optionsSchema.nullable().optional(),

      isRequired: z.boolean().default(false),

      isActive: z.boolean().default(true),

      sortOrder: z.coerce.number().int().min(0).default(0),
    }),
  })
  .superRefine((data, ctx) => {
    const { answerType, options } = data.body;

    if (answerType === "SELECT" && (!options || options.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["body", "options"],
        message: "Options are required for SELECT questions",
      });
    }

    if (answerType !== "SELECT" && options !== undefined && options !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["body", "options"],
        message: "Options are only allowed for SELECT questions",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| UPDATE QUESTION
|--------------------------------------------------------------------------
*/

export const updateConditionQuestionSchema = z.object({
  params: questionRouteParamsSchema,

  body: z
    .object({
      label: z
        .string()
        .trim()
        .min(1, "Question label cannot be empty")
        .optional(),

      answerType: answerTypeSchema.optional(),

      options: optionsSchema.nullable().optional(),

      isRequired: z.boolean().optional(),

      sortOrder: z.coerce.number().int().min(0).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field must be provided",
    }),
});

/*
|--------------------------------------------------------------------------
| UPDATE QUESTION STATUS
|--------------------------------------------------------------------------
*/

export const updateConditionQuestionStatusSchema = z.object({
  params: questionRouteParamsSchema,

  body: z.object({
    isActive: z.boolean(),
  }),
});
