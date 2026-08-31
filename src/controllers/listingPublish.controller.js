import createHttpError from "http-errors";

import {
  findListingForConditionAnalysis,
  publishListingById,
} from "../services/listing.service.js";
import { findRequiredQuestionsByCategory } from "../services/sellerConditionAnswer.service.js";
import { toListingResponse } from "../utils/listing.response.js";
import { listingIdSchema } from "../validations/listing.schema.js";

export const publishListing = async (req, res, next) => {
  const { listingId } = listingIdSchema.parse(req.params);

  const listing = await findListingForConditionAnalysis(listingId);

  if (!listing) {
    return next(createHttpError(404, "Listing not found."));
  }

  if (listing.sellerId !== req.user.id) {
    return next(createHttpError(403, "You cannot publish this listing."));
  }

  if (listing.status !== "DRAFT") {
    return next(
      createHttpError(400, "Only draft listings can be published."),
    );
  }

  if (!listing.category.isActive) {
    return next(
      createHttpError(
        400,
        "This listing category is currently unavailable.",
      ),
    );
  }

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
    return next(
      createHttpError(
        400,
        "Please answer all required condition questions before publishing.",
      ),
    );
  }

  if (listing.images.length === 0) {
    return next(
      createHttpError(400, "Upload at least one image before publishing."),
    );
  }

  if (
    listing.estimatedCondition === null ||
    listing.estimatedScore === null
  ) {
    return next(
      createHttpError(
        400,
        "Analyze the product condition before publishing.",
      ),
    );
  }

  const publishedListing = await publishListingById(listingId);

  return res.status(200).json({
    success: true,
    message: "Listing published successfully",
    data: toListingResponse(publishedListing),
  });
};
