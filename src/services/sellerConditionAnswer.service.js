import { prisma } from "../lib/prisma.js";

export const findActiveQuestionsByCategory = (categoryId) => {
  return prisma.conditionQuestion.findMany({
    where: {
      categoryId,
      isActive: true,
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

export const findQuestionsByIds = (categoryId, questionIds) => {
  return prisma.conditionQuestion.findMany({
    where: {
      categoryId,

      id: {
        in: questionIds,
      },

      isActive: true,
    },
  });
};

export const findAnswersByListing = (listingId) => {
  return prisma.sellerConditionAnswer.findMany({
    where: {
      listingId,
    },

    select: {
      questionId: true,
      answerValue: true,
    },
  });
};

export const upsertConditionAnswers = (listingId, answers) => {
  return prisma.$transaction(
    answers.map((answer) =>
      prisma.sellerConditionAnswer.upsert({
        where: {
          listingId_questionId: {
            listingId,
            questionId: answer.questionId,
          },
        },

        update: {
          answerValue: answer.answerValue,
        },

        create: {
          listingId,
          questionId: answer.questionId,
          answerValue: answer.answerValue,
        },
      }),
    ),
  );
};

export const findRequiredQuestionsByCategory = (categoryId) => {
  return prisma.conditionQuestion.findMany({
    where: {
      categoryId,
      isActive: true,
      isRequired: true,
    },

    select: {
      id: true,
    },
  });
};
