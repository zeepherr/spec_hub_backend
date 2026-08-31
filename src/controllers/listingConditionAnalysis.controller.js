import { analyzeProductCondition } from "../providers/gemini.provider.js";

import {
  findListingForConditionAnalysis,
  updateListingConditionEstimate,
} from "../services/listing.service.js";

import { findRequiredQuestionsByCategory } from "../services/sellerConditionAnswer.service.js";

import { getFromR2 } from "../services/r2.storage.service.js";

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
    /*
    |--------------------------------------------------------------------------
    | 1. Validate listing ID
    |--------------------------------------------------------------------------
    */

    const validation = analyzeListingConditionParamsSchema.safeParse({
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
    | 2. Find listing + answers + images
    |--------------------------------------------------------------------------
    */

    const listing = await findListingForConditionAnalysis(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        code: "LISTING_NOT_FOUND",
        message: "Listing not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 3. Ownership
    |--------------------------------------------------------------------------
    */

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You cannot analyze this listing",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 4. Only DRAFT
    |--------------------------------------------------------------------------
    */

    if (listing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        code: "LISTING_NOT_EDITABLE",
        message: "Only draft listings can be analyzed",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 5. Category still active
    |--------------------------------------------------------------------------
    */

    if (!listing.category.isActive) {
      return res.status(400).json({
        success: false,
        code: "CATEGORY_INACTIVE",
        message: "The listing category is currently unavailable",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 6. Check required questions
    |--------------------------------------------------------------------------
    */

    const requiredQuestions = await findRequiredQuestionsByCategory(
      listing.categoryId,
    );

    const answeredQuestionIds = new Set(
      listing.conditionAnswers.map((answer) => answer.questionId),
    );

    const missingRequiredQuestions = requiredQuestions.filter(
      (question) => !answeredQuestionIds.has(question.id),
    );

    if (missingRequiredQuestions.length > 0) {
      return res.status(400).json({
        success: false,
        code: "CONDITION_ANSWERS_INCOMPLETE",
        message:
          "Please answer all required condition questions before analysis",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 7. Require images
    |--------------------------------------------------------------------------
    */

    if (listing.images.length === 0) {
      return res.status(400).json({
        success: false,
        code: "LISTING_IMAGES_REQUIRED",
        message: "Upload at least one listing image before condition analysis",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 8. Load image buffers from R2
    |--------------------------------------------------------------------------
    */

    const images = [];

    for (const image of listing.images) {
      const storedImage = await getFromR2(image.imageKey);

      images.push({
        buffer: storedImage.buffer,
        mimetype: storedImage.contentType,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 9. Prepare seller answers
    |--------------------------------------------------------------------------
    */

    const answers = listing.conditionAnswers.map((conditionAnswer) => ({
      question: conditionAnswer.question.label,

      answer: conditionAnswer.answerValue,
    }));

    /*
    |--------------------------------------------------------------------------
    | 10. Ask Gemini
    |--------------------------------------------------------------------------
    */

    const aiResponse = await analyzeProductCondition({
      title: listing.title,

      category: listing.category.name,

      brand: listing.brand,

      productModel: listing.model,

      description: listing.description,

      answers,

      images,
    });

    /*
    |--------------------------------------------------------------------------
    | 11. Parse AI JSON
    |--------------------------------------------------------------------------
    */

    let parsedAnalysis;

    try {
      parsedAnalysis = JSON.parse(aiResponse);
    } catch {
      return res.status(502).json({
        success: false,
        code: "INVALID_AI_RESPONSE",
        message: "AI returned invalid condition analysis JSON",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 12. Validate AI output
    |--------------------------------------------------------------------------
    */

    const aiValidation = aiConditionAnalysisSchema.safeParse(parsedAnalysis);

    if (!aiValidation.success) {
      return res.status(502).json({
        success: false,
        code: "INVALID_AI_RESPONSE",
        message: "AI returned an unexpected condition analysis format",
        errors: aiValidation.error.flatten(),
      });
    }

    const { score, summary } = aiValidation.data;

    /*
    |--------------------------------------------------------------------------
    | 13. Backend determines grade
    |--------------------------------------------------------------------------
    */

    const estimatedCondition = getConditionGrade(score);

    /*
    |--------------------------------------------------------------------------
    | 14. Save AI estimate
    |--------------------------------------------------------------------------
    */

    const updatedListing = await updateListingConditionEstimate(listingId, {
      estimatedScore: score,
      estimatedCondition,
    });

    /*
    |--------------------------------------------------------------------------
    | 15. Response
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      message: "Listing condition analyzed successfully",

      data: {
        listing: updatedListing,

        analysis: {
          estimatedCondition,
          estimatedScore: score,
          summary,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
