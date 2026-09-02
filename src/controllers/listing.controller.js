import createHttpError from "http-errors";

import { findCategoryBy } from "../services/category.service.js";
import {
  createListing,
  findActiveListingsByCategory,
  findAllActiveListings,
  findListingById,
  findListingsBySeller,
  findPublicListingById,
  updateListing,
  updateListingAndClearConditionAnswers,
} from "../services/listing.service.js";
import { toListingResponse } from "../utils/listing.response.js";
import { toListingImageResponse } from "../utils/listingImage.response.js";
import {
  createListingSchema,
  listingCategoryIdSchema,
  listingIdSchema,
  updateListingSchema,
} from "../validations/listing.schema.js";

export const createDraftListing = async (req, res, next) => {
  const data = createListingSchema.parse(req.body);

  const category = await findCategoryBy("id", data.categoryId);

  if (!category) {
    return next(createHttpError(404, "Category not found."));
  }

  if (!category.isActive) {
    return next(
      createHttpError(400, "This category is currently unavailable."),
    );
  }

  const listing = await createListing({
    ...data,
    sellerId: req.user.id,
    status: "DRAFT",
  });

  return res.status(201).json({
    success: true,
    message: "Draft listing created successfully",
    data: toListingResponse(listing),
  });
};

export const getMyListings = async (req, res, next) => {
  const listings = await findListingsBySeller(req.user.id);

  return res.status(200).json({
    success: true,
    data: listings.map(toListingResponse),
  });
};

export const getMyListingById = async (req, res, next) => {
  const { listingId } = listingIdSchema.parse(req.params);

  const listing = await findListingById(listingId);

  if (!listing) {
    return next(createHttpError(404, "Listing not found."));
  }

  if (listing.sellerId !== req.user.id) {
    return next(createHttpError(403, "You cannot access this listing."));
  }

  return res.status(200).json({
    success: true,
    data: toListingResponse(listing),
  });
};

export const updateDraftListing = async (req, res, next) => {
  try {
    const validation = updateListingSchema.safeParse({
      params: req.params,
      body: req.body,
    });

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid listing data",
        errors: validation.error.flatten(),
      });
    }

    const { listingId } = validation.data.params;

    const updateData = validation.data.body;

    const listing = await findListingById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        code: "LISTING_NOT_FOUND",
        message: "Listing not found",
      });
    }

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You cannot edit this listing",
      });
    }

    if (listing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        code: "LISTING_NOT_EDITABLE",
        message: "Only draft listings can be edited",
      });
    }

    if (updateData.categoryId !== undefined) {
      const category = await findCategoryBy("id", updateData.categoryId);

      if (!category) {
        return res.status(404).json({
          success: false,
          code: "CATEGORY_NOT_FOUND",
          message: "Category not found",
        });
      }

      if (!category.isActive) {
        return res.status(400).json({
          success: false,
          code: "CATEGORY_INACTIVE",
          message: "This category is currently unavailable",
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Detect actual category change
    |--------------------------------------------------------------------------
    |
    | Example:
    |
    | existing category = Keyboard (2)
    | new category      = Monitor (3)
    |
    | Existing keyboard condition answers are no longer valid.
    |--------------------------------------------------------------------------
    */

    const categoryChanged =
      updateData.categoryId !== undefined &&
      updateData.categoryId !== listing.categoryId;

    let updatedListing;

    if (categoryChanged) {
      updatedListing = await updateListingAndClearConditionAnswers(
        listingId,
        updateData,
      );
    } else {
      updatedListing = await updateListing(listingId, updateData);
    }

    return res.status(200).json({
      success: true,
      message: "Draft listing updated successfully",
      data: updatedListing,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllActiveListings = async (req, res, next) => {
  const listings = await findAllActiveListings();

  return res.status(200).json({
    success: true,
    message: "Listings fetched successfully",
    data: listings.map(toListingResponse),
  });
};

export const getListingsByCategory = async (req, res, next) => {
  const { categoryId } = listingCategoryIdSchema.parse(req.params);

  const category = await findCategoryBy("id", categoryId);

  if (!category || !category.isActive) {
    return next(createHttpError(404, "Category not found."));
  }

  const listings = await findActiveListingsByCategory(categoryId);

  return res.status(200).json({
    success: true,
    message: "Category listings fetched successfully",
    data: listings.map(toListingResponse),
  });
};

export const getPublicListingById = async (req, res, next) => {
  const { listingId } = listingIdSchema.parse(req.params);

  const listing = await findPublicListingById(listingId);

  if (!listing) {
    return next(createHttpError(404, "Listing not found."));
  }

  return res.status(200).json({
    success: true,
    message: "Listing fetched successfully",
    data: toListingImageResponse(listing),
  });
};
