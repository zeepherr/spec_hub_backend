import createHttpError from "http-errors";

import {
  addCartItem,
  findCartItemsByUser,
  removeCartItem,
} from "../services/cartItem.service.js";
import { findListingById } from "../services/listing.service.js";
import { toListingResponse } from "../utils/listing.response.js";
import { cartListingIdSchema } from "../validations/cartItem.schema.js";

// get my cart
export const getMyCart = async (req, res, next) => {
  const cartItems = await findCartItemsByUser(req.user.id);

  const data = cartItems.map((item) => ({
    id: item.id,
    listingId: item.listingId,
    createdAt: item.createdAt,
    listing: toListingResponse(item.listing),
  }));

  return res.status(200).json({
    success: true,
    message: "Cart fetched successfully",
    data,
  });
};

// add listing to cart
export const addListingToCart = async (req, res, next) => {
  const { listingId } = cartListingIdSchema.parse(req.params);

  const listing = await findListingById(listingId);

  if (!listing) {
    return next(createHttpError(404, "Listing not found."));
  }

  if (listing.status !== "ACTIVE") {
    return next(createHttpError(400, "This listing is currently unavailable."));
  }

  if (listing.sellerId === req.user.id) {
    return next(
      createHttpError(400, "You cannot add your own listing to cart."),
    );
  }

  const cartItem = await addCartItem(req.user.id, listingId);

  return res.status(201).json({
    success: true,
    message: "Listing added to cart",
    data: cartItem,
  });
};

// remove listing from cart
export const removeListingFromCart = async (req, res, next) => {
  const { listingId } = cartListingIdSchema.parse(req.params);

  await removeCartItem(req.user.id, listingId);

  return res.status(200).json({
    success: true,
    message: "Listing removed from cart",
    data: null,
  });
};
