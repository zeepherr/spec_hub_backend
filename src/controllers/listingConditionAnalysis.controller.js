import createHttpError from "http-errors";

import { analyzeProductCondition } from "../providers/gemini.provider.js";
import { getFromR2 } from "../services/r2.storage.service.js";
import { findRequiredQuestionsByCategory } from "../services/sellerConditionAnswer.service.js";
import {
  findListingForConditionAnalysis,
  updateListingConditionEstimate,
} from "../services/listing.service.js";
import { toListingResponse } from "../utils/listing.response.js";
import {
  aiConditionAnalysisSchema,
  analyzeListingConditionParamsSchema,
} from "../validations/ai.schema.js";

const getConditionGrade = (score) => {
  if (score >= 90) {
    return "LIKE_NEW";
  }

  if (score >= 75) {
    return "GOOD";
  }

  if (score >= 50) {
    return "FAIR";
  }

  return "POOR";
};

export const analyzeListingCondition = async (req, res, next) => {
  try {
    const { listingId } = analyzeListingConditionParamsSchema.parse(req.params);
    const listing = await findListingForConditionAnalysis(listingId);

    if (!listing) {
      return next(createHttpError(404, "Listing not found."));
    }

    if (listing.sellerId !== req.user.id) {
      return next(createHttpError(403, "You cannot analyze this listing."));
    }

    if (listing.status !== "DRAFT") {
      return next(
        createHttpError(400, "Only draft listings can be analyzed."),
      );
    }

    if (!listing.category.isActive) {
      return next(
        createHttpError(400, "The listing category is currently unavailable."),
      );
    }

    const requiredQuestions = await findRequiredQuestionsByCategory(
      listing.categoryId,
    );
    const answeredQuestionIds = new Set(
      listing.conditionAnswers.map((answer) => answer.questionId),
    );
    const hasMissingRequiredAnswer = requiredQuestions.some(
      (question) => !answeredQuestionIds.has(question.id),
    );

    if (hasMissingRequiredAnswer) {
      return next(
        createHttpError(
          400,
          "Please answer all required condition questions before analysis.",
        ),
      );
    }

    if (listing.images.length === 0) {
      return next(
        createHttpError(
          400,
          "Upload at least one listing image before condition analysis.",
        ),
      );
    }

    const images = [];

    for (const image of listing.images) {
      const storedImage = await getFromR2(image.imageKey);

      images.push({
        buffer: storedImage.buffer,
        mimetype: storedImage.contentType,
      });
    }

    const answers = listing.conditionAnswers.map((answer) => ({
      question: answer.question.label,
      answer: answer.answerValue,
    }));
    const aiResponse = await analyzeProductCondition({
      title: listing.title,
      category: listing.category.name,
      brand: listing.brand,
      productModel: listing.model,
      description: listing.description,
      answers,
      images,
    });

    let parsedAnalysis;

    try {
      parsedAnalysis = JSON.parse(aiResponse);
    } catch {
      return next(
        createHttpError(502, "AI returned invalid condition analysis JSON."),
      );
    }

    let analysis;

    try {
      analysis = aiConditionAnalysisSchema.parse(parsedAnalysis);
    } catch {
      return next(
        createHttpError(
          502,
          "AI returned an unexpected condition analysis format.",
        ),
      );
    }

    const { score, summary } = analysis;
    const estimatedCondition = getConditionGrade(score);
    const updatedListing = await updateListingConditionEstimate(listingId, {
      estimatedScore: score,
      estimatedCondition,
    });

    return res.status(200).json({
      success: true,
      message: "Listing condition analyzed successfully",
      data: {
        listing: toListingResponse(updatedListing),
        analysis: {
          estimatedCondition,
          estimatedScore: score,
          summary,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};
