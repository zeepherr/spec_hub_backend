import { prisma } from "../lib/prisma.js";

export const createConditionQuestion = (data) => {
  return prisma.conditionQuestion.create({
    data,
  });
};

export const findConditionQuestionsByCategory = (categoryId) => {
  return prisma.conditionQuestion.findMany({
    where: {
      categoryId,
    },
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });
};

export const findConditionQuestionById = (categoryId, questionId) => {
  return prisma.conditionQuestion.findFirst({
    where: {
      id: questionId,
      categoryId,
    },
  });
};

export const findConditionQuestionByLabel = (categoryId, label) => {
  return prisma.conditionQuestion.findFirst({
    where: {
      categoryId,
      label: {
        equals: label,
        mode: "insensitive",
      },
    },
  });
};

export const findConditionQuestionByLabelExceptId = (
  categoryId,
  questionId,
  label,
) => {
  return prisma.conditionQuestion.findFirst({
    where: {
      categoryId,
      id: {
        not: questionId,
      },
      label: {
        equals: label,
        mode: "insensitive",
      },
    },
  });
};

export const updateConditionQuestion = (questionId, data) => {
  return prisma.conditionQuestion.update({
    where: {
      id: questionId,
    },
    data,
  });
};

// Counts seller answers that still reference the question.
export const countConditionQuestionAnswers = (questionId) => {
  return prisma.sellerConditionAnswer.count({
    where: {
      questionId,
    },
  });
};

export const deleteConditionQuestionById = (questionId) => {
  return prisma.conditionQuestion.delete({
    where: {
      id: questionId,
    },
  });
};
