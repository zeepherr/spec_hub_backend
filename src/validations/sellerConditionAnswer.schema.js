import { z } from "zod";

const answerValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string().trim().min(1, "Answer cannot be empty"),
]);

export const listingConditionParamsSchema = z.object({
  listingId: z.uuid(),
});

export const saveConditionAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.coerce.number().int().positive(),

        answerValue: answerValueSchema,
      }),
    )
    .min(1, "At least one answer must be provided")
    .superRefine((answers, ctx) => {
      const ids = answers.map((answer) => answer.questionId);

      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: "custom",
          message: "The same question cannot appear more than once",
        });
      }
    }),
});
