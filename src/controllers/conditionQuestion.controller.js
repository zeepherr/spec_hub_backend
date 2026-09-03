import { findCategoryBy } from "../services/category.service.js";

import {
  countConditionQuestionAnswers,
  createConditionQuestion,
  deleteConditionQuestionById,
  findConditionQuestionById,
  findConditionQuestionByLabel,
  findConditionQuestionByLabelExceptId,
  findConditionQuestionsByCategory,
  updateConditionQuestion,
} from "../services/conditionQuestion.service.js";

import {
  categoryIdSchema,
  createConditionQuestionSchema,
  questionParamsSchema,
  updateConditionQuestionSchema,
  updateConditionQuestionStatusSchema,
} from "../validations/conditionQuestion.schema.js";

export const createQuestion = async (req, res, next) => {
  try {
    const result = createConditionQuestionSchema.safeParse({
      params: req.params,
      body: req.body,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        errors: result.error.flatten(),
      });
    }

    const { categoryId } = result.data.params;

    const { label, answerType, options, isRequired, isActive, sortOrder } =
      result.data.body;

    const category = await findCategoryBy("id", categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        code: "CATEGORY_NOT_FOUND",
        message: "Category not found",
      });
    }

    const duplicateQuestion = await findConditionQuestionByLabel(
      categoryId,
      label,
    );

    if (duplicateQuestion) {
      return res.status(409).json({
        success: false,
        code: "CONDITION_QUESTION_ALREADY_EXISTS",
        message: "This condition question already exists in this category",
      });
    }

    const question = await createConditionQuestion({
      categoryId,
      label,
      answerType,
      options: answerType === "SELECT" ? options : null,
      isRequired,
      isActive,
      sortOrder,
    });

    return res.status(201).json({
      success: true,
      message: "Condition question created successfully",
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

export const getQuestionsByCategory = async (req, res, next) => {
  try {
    const result = categoryIdSchema.safeParse({
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid category id",
        errors: result.error.flatten(),
      });
    }

    const { categoryId } = result.data.params;

    const category = await findCategoryBy("id", categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        code: "CATEGORY_NOT_FOUND",
        message: "Category not found",
      });
    }

    const questions = await findConditionQuestionsByCategory(categoryId);

    return res.status(200).json({
      success: true,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
};

export const getQuestionById = async (req, res, next) => {
  try {
    const result = questionParamsSchema.safeParse({
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        errors: result.error.flatten(),
      });
    }

    const { categoryId, questionId } = result.data.params;

    const question = await findConditionQuestionById(categoryId, questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        code: "CONDITION_QUESTION_NOT_FOUND",
        message: "Condition question not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

export const updateQuestion = async (req, res, next) => {
  try {
    const result = updateConditionQuestionSchema.safeParse({
      params: req.params,
      body: req.body,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        errors: result.error.flatten(),
      });
    }

    const { categoryId, questionId } = result.data.params;

    const { label, answerType, options, isRequired, sortOrder } =
      result.data.body;

    const currentQuestion = await findConditionQuestionById(
      categoryId,
      questionId,
    );

    if (!currentQuestion) {
      return res.status(404).json({
        success: false,
        code: "CONDITION_QUESTION_NOT_FOUND",
        message: "Condition question not found",
      });
    }

    if (label !== undefined) {
      const duplicateQuestion = await findConditionQuestionByLabelExceptId(
        categoryId,
        questionId,
        label,
      );

      if (duplicateQuestion) {
        return res.status(409).json({
          success: false,
          code: "CONDITION_QUESTION_ALREADY_EXISTS",
          message: "This condition question already exists in this category",
        });
      }
    }

    const finalAnswerType = answerType ?? currentQuestion.answerType;

    if (
      finalAnswerType !== "SELECT" &&
      options !== undefined &&
      options !== null
    ) {
      return res.status(400).json({
        success: false,
        code: "OPTIONS_NOT_ALLOWED",
        message: "Options are only allowed for SELECT questions",
      });
    }

    if (
      currentQuestion.answerType !== "SELECT" &&
      finalAnswerType === "SELECT" &&
      options === undefined
    ) {
      return res.status(400).json({
        success: false,
        code: "SELECT_OPTIONS_REQUIRED",
        message: "Options are required when changing answer type to SELECT",
      });
    }

    if (finalAnswerType === "SELECT" && options === null) {
      return res.status(400).json({
        success: false,
        code: "SELECT_OPTIONS_REQUIRED",
        message: "SELECT questions must have options",
      });
    }

    const updateData = {};

    if (label !== undefined) {
      updateData.label = label;
    }

    if (answerType !== undefined) {
      updateData.answerType = answerType;

      if (answerType !== "SELECT") {
        updateData.options = null;
      }
    }

    if (options !== undefined) {
      updateData.options = options;
    }

    if (isRequired !== undefined) {
      updateData.isRequired = isRequired;
    }

    if (sortOrder !== undefined) {
      updateData.sortOrder = sortOrder;
    }

    const updatedQuestion = await updateConditionQuestion(
      questionId,
      updateData,
    );

    return res.status(200).json({
      success: true,
      message: "Condition question updated successfully",
      data: updatedQuestion,
    });
  } catch (error) {
    next(error);
  }
};

export const updateQuestionStatus = async (req, res, next) => {
  try {
    const result = updateConditionQuestionStatusSchema.safeParse({
      params: req.params,
      body: req.body,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        errors: result.error.flatten(),
      });
    }

    const { categoryId, questionId } = result.data.params;

    const { isActive } = result.data.body;

    const question = await findConditionQuestionById(categoryId, questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        code: "CONDITION_QUESTION_NOT_FOUND",
        message: "Condition question not found",
      });
    }

    if (question.isActive === isActive) {
      return res.status(200).json({
        success: true,
        message: isActive
          ? "Condition question is already active"
          : "Condition question is already inactive",
        data: question,
      });
    }

    const updatedQuestion = await updateConditionQuestion(questionId, {
      isActive,
    });

    return res.status(200).json({
      success: true,
      message: isActive
        ? "Condition question activated successfully"
        : "Condition question deactivated successfully",
      data: updatedQuestion,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req, res, next) => {
  try {
    const result = questionParamsSchema.safeParse({
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        errors: result.error.flatten(),
      });
    }

    const { categoryId, questionId } = result.data.params;

    const question = await findConditionQuestionById(categoryId, questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        code: "CONDITION_QUESTION_NOT_FOUND",
        message: "Condition question not found",
      });
    }

    const answerCount = await countConditionQuestionAnswers(questionId);

    if (answerCount > 0) {
      return res.status(409).json({
        success: false,
        message:
          "This condition question cannot be deleted because it is already in use.",
      });
    }

    await deleteConditionQuestionById(questionId);

    return res.status(200).json({
      success: true,
      message: "Condition question deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
