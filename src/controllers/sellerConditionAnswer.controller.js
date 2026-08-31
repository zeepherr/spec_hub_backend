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

/*
|--------------------------------------------------------------------------
| GET CONDITION QUESTIONS FOR LISTING
|--------------------------------------------------------------------------
*/

export const getListingConditionQuestions = async (req, res, next) => {
  try {
    const validation = listingConditionParamsSchema.safeParse({
      params: req.params,
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid listing id",
        errors: validation.error.flatten(),
      });
    }

    const { listingId } = validation.data.params;

    /*
      |--------------------------------------------------------------------------
      | Find listing
      |--------------------------------------------------------------------------
      */

    const listing = await findListingForConditionAnswers(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        code: "LISTING_NOT_FOUND",
        message: "Listing not found",
      });
    }

    /*
      |--------------------------------------------------------------------------
      | Ownership
      |--------------------------------------------------------------------------
      */

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You do not have access to this listing",
      });
    }

    /*
      |--------------------------------------------------------------------------
      | Only DRAFT
      |--------------------------------------------------------------------------
      */

    if (listing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        code: "LISTING_NOT_EDITABLE",
        message:
          "Condition answers can only be edited while the listing is a draft",
      });
    }

    /*
      |--------------------------------------------------------------------------
      | Load questions
      |--------------------------------------------------------------------------
      */

    const questions = await findActiveQuestionsByCategory(listing.categoryId);

    /*
      |--------------------------------------------------------------------------
      | Load current answers
      |--------------------------------------------------------------------------
      */

    const existingAnswers = await findAnswersByListing(listingId);

    const answerMap = new Map(
      existingAnswers.map((answer) => [answer.questionId, answer.answerValue]),
    );

    /*
      |--------------------------------------------------------------------------
      | Combine questions + answers
      |--------------------------------------------------------------------------
      */

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
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| SAVE / UPDATE CONDITION ANSWERS
|--------------------------------------------------------------------------
*/

export const saveListingConditionAnswers = async (req, res, next) => {
  try {
    const validation = saveConditionAnswersSchema.safeParse({
      params: req.params,
      body: req.body,
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid condition answers",
        errors: validation.error.flatten(),
      });
    }

    const { listingId } = validation.data.params;

    const { answers } = validation.data.body;

    /*
      |--------------------------------------------------------------------------
      | Find listing
      |--------------------------------------------------------------------------
      */

    const listing = await findListingForConditionAnswers(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        code: "LISTING_NOT_FOUND",
        message: "Listing not found",
      });
    }

    /*
      |--------------------------------------------------------------------------
      | Ownership
      |--------------------------------------------------------------------------
      */

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You cannot modify this listing",
      });
    }

    /*
      |--------------------------------------------------------------------------
      | Only DRAFT
      |--------------------------------------------------------------------------
      */

    if (listing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        code: "LISTING_NOT_EDITABLE",
        message:
          "Condition answers can only be edited while the listing is a draft",
      });
    }

    /*
      |--------------------------------------------------------------------------
      | Requested question IDs
      |--------------------------------------------------------------------------
      */

    const questionIds = answers.map((answer) => answer.questionId);

    const questions = await findQuestionsByIds(listing.categoryId, questionIds);

    /*
        This rejects:

        - unknown question
        - question from another category
        - disabled question
      */

    if (questions.length !== questionIds.length) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CONDITION_QUESTION",
        message: "One or more condition questions are invalid or unavailable",
      });
    }

    const questionMap = new Map(
      questions.map((question) => [question.id, question]),
    );

    /*
      |--------------------------------------------------------------------------
      | Validate value against question type
      |--------------------------------------------------------------------------
      */

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);

      const value = answer.answerValue;

      /*
        |--------------------------------------------------------------------------
        | BOOLEAN
        |--------------------------------------------------------------------------
        */

      if (question.answerType === "BOOLEAN" && typeof value !== "boolean") {
        return res.status(400).json({
          success: false,
          code: "INVALID_ANSWER_TYPE",
          message: `"${question.label}" requires a boolean answer`,
        });
      }

      /*
        |--------------------------------------------------------------------------
        | NUMBER
        |--------------------------------------------------------------------------
        */

      if (question.answerType === "NUMBER" && typeof value !== "number") {
        return res.status(400).json({
          success: false,
          code: "INVALID_ANSWER_TYPE",
          message: `"${question.label}" requires a number answer`,
        });
      }

      /*
        |--------------------------------------------------------------------------
        | TEXT
        |--------------------------------------------------------------------------
        */

      if (question.answerType === "TEXT" && typeof value !== "string") {
        return res.status(400).json({
          success: false,
          code: "INVALID_ANSWER_TYPE",
          message: `"${question.label}" requires a text answer`,
        });
      }

      /*
        |--------------------------------------------------------------------------
        | SELECT
        |--------------------------------------------------------------------------
        */

      if (question.answerType === "SELECT") {
        if (typeof value !== "string" || !question.options.includes(value)) {
          return res.status(400).json({
            success: false,
            code: "INVALID_SELECT_OPTION",
            message: `"${value}" is not a valid option for "${question.label}"`,
          });
        }
      }
    }

    /*
      |--------------------------------------------------------------------------
      | Save/update answers
      |--------------------------------------------------------------------------
      */

    const savedAnswers = await upsertConditionAnswers(listingId, answers);

    return res.status(200).json({
      success: true,
      message: "Condition answers saved successfully",
      data: savedAnswers,
    });
  } catch (error) {
    next(error);
  }
};
