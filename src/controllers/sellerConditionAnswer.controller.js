import createHttpError from "http-errors";
import { findListingForConditionAnswers } from "../services/listing.service.js";
import {
  findActiveQuestionsByCategory,
  findAnswersByListing,
  findQuestionsByIds,
  upsertConditionAnswers,
} from "../services/sellerConditionAnswer.service.js";
import {
  listingConditionParamsSchema,
  saveConditionAnswersSchema,
} from "../validations/sellerConditionAnswer.schema.js";

export const getListingConditionQuestions = async (req, res, next) => {
  const { listingId } = listingConditionParamsSchema.parse(req.params);
  const listing = await findListingForConditionAnswers(listingId);

  if (!listing) return next(createHttpError(404, "Listing not found"));
  if (listing.sellerId !== req.user.id) {
    return next(
      createHttpError(403, "You do not have access to this listing"),
    );
  }
  if (listing.status !== "DRAFT") {
    return next(
      createHttpError(
        400,
        "Condition answers can only be edited while the listing is a draft",
      ),
    );
  }

  const questions = await findActiveQuestionsByCategory(listing.categoryId);
  const existingAnswers = await findAnswersByListing(listingId);
  const answerMap = new Map(
    existingAnswers.map((answer) => [answer.questionId, answer.answerValue]),
  );
  const data = questions.map((question) => ({
    id: question.id,
    label: question.label,
    answerType: question.answerType,
    options: question.options,
    isRequired: question.isRequired,
    sortOrder: question.sortOrder,
    answerValue: answerMap.get(question.id) ?? null,
  }));

  return res.status(200).json({
    success: true,
    data,
  });
};

export const saveListingConditionAnswers = async (req, res, next) => {
  const { listingId } = listingConditionParamsSchema.parse(req.params);
  const { answers } = saveConditionAnswersSchema.parse(req.body);
  const listing = await findListingForConditionAnswers(listingId);

  if (!listing) return next(createHttpError(404, "Listing not found"));
  if (listing.sellerId !== req.user.id) {
    return next(createHttpError(403, "You cannot modify this listing"));
  }
  if (listing.status !== "DRAFT") {
    return next(
      createHttpError(
        400,
        "Condition answers can only be edited while the listing is a draft",
      ),
    );
  }

  const questionIds = answers.map((answer) => answer.questionId);
  const questions = await findQuestionsByIds(listing.categoryId, questionIds);

  if (questions.length !== questionIds.length) {
    return next(
      createHttpError(
        400,
        "One or more condition questions are invalid or unavailable",
      ),
    );
  }

  const questionMap = new Map(
    questions.map((question) => [question.id, question]),
  );

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    const value = answer.answerValue;

    if (question.answerType === "BOOLEAN" && typeof value !== "boolean") {
      return next(
        createHttpError(400, `"${question.label}" requires a boolean answer`),
      );
    }
    if (question.answerType === "NUMBER" && typeof value !== "number") {
      return next(
        createHttpError(400, `"${question.label}" requires a number answer`),
      );
    }
    if (question.answerType === "TEXT" && typeof value !== "string") {
      return next(
        createHttpError(400, `"${question.label}" requires a text answer`),
      );
    }
    if (
      question.answerType === "SELECT" &&
      (typeof value !== "string" || !question.options.includes(value))
    ) {
      return next(
        createHttpError(
          400,
          `"${value}" is not a valid option for "${question.label}"`,
        ),
      );
    }
  }

  const savedAnswers = await upsertConditionAnswers(listingId, answers);

  return res.status(200).json({
    success: true,
    message: "Condition answers saved successfully",
    data: savedAnswers,
  });
};
