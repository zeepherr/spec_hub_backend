import { findCategoryBy } from "../services/category.service.js";
import {
  createListing,
  findListingById,
  findListingsBySeller,
  updateListing,
} from "../services/listing.service.js";

import {
  createListingSchema,
  listingIdSchema,
  updateListingSchema,
} from "../validations/listing.schema.js";

export const createDraftListing = async (req, res, next) => {
  try {
    const validation = createListingSchema.safeParse({
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

    const { categoryId, title, description, brand, model, price, location } =
      validation.data.body;

    /*
      Category must exist.
    */

    const category = await findCategoryBy("id", categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        code: "CATEGORY_NOT_FOUND",
        message: "Category not found",
      });
    }

    /*
      Seller cannot create a new listing using
      a disabled category.
    */

    if (!category.isActive) {
      return res.status(400).json({
        success: false,
        code: "CATEGORY_INACTIVE",
        message: "This category is currently unavailable",
      });
    }

    /*
      Never accept sellerId from frontend.

      Authentication determines ownership.
    */

    const sellerId = req.user.id;

    const listing = await createListing({
      sellerId,
      categoryId,
      title,
      description,
      brand,
      model,
      price,
      location,

      // Explicit for clarity.
      status: "DRAFT",
    });

    return res.status(201).json({
      success: true,
      message: "Draft listing created successfully",
      data: listing,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyListings = async (req, res, next) => {
  try {
    const listings = await findListingsBySeller(req.user.id);

    return res.status(200).json({
      success: true,
      data: listings,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyListingById = async (req, res, next) => {
  try {
    const validation = listingIdSchema.safeParse({
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

    const listing = await findListingById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        code: "LISTING_NOT_FOUND",
        message: "Listing not found",
      });
    }

    /*
      Ownership check.
    */

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You do not have access to this listing",
      });
    }

    return res.status(200).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    next(error);
  }
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

    /*
      Find listing.
    */

    const listing = await findListingById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        code: "LISTING_NOT_FOUND",
        message: "Listing not found",
      });
    }

    /*
      Ownership.
    */

    if (listing.sellerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You cannot edit this listing",
      });
    }

    /*
      For now only DRAFT listings can use this endpoint.
    */

    if (listing.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        code: "LISTING_NOT_EDITABLE",
        message: "Only draft listings can be edited",
      });
    }

    /*
      If category changes, validate the new category.
    */

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

    const updatedListing = await updateListing(listingId, updateData);

    return res.status(200).json({
      success: true,
      message: "Draft listing updated successfully",
      data: updatedListing,
    });
  } catch (error) {
    next(error);
  }
};
