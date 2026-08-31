import { prisma } from "../lib/prisma.js";
export const findListingForConditionAnswers = (listingId) => {
  return prisma.listing.findUnique({
    where: {
      id: listingId,
    },

    select: {
      id: true,
      sellerId: true,
      categoryId: true,
      status: true,
    },
  });
};

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
