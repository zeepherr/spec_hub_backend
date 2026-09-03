import express from "express";

import { identifyProductImage } from "../controllers/ai.controller.js";
import {
  createDraftListing,
  deleteSellerListing,
  getAllActiveListings,
  getListingsByCategory,
  getMyListingById,
  getMyListings,
  getPublicListingById,
  updateSellerListing,
} from "../controllers/listing.controller.js";

import {
  getListingConditionQuestions,
  saveListingConditionAnswers,
} from "../controllers/sellerConditionAnswer.controller.js";

import { analyzeListingCondition } from "../controllers/listingConditionAnalysis.controller.js";
import { uploadListingImages } from "../controllers/listingImage.controller.js";
import { publishListing } from "../controllers/listingPublish.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import {
  listingImageUpload,
  MAX_LISTING_IMAGES,
  uploadImage,
} from "../middlewares/upload.middleware.js";
import {
  validateImage,
  validateImages,
} from "../middlewares/validateImage.middleware.js";

const app = express.Router();

app.get("/", getAllActiveListings);
app.get("/public/:listingId", getPublicListingById);
app.get("/category/:categoryId", getListingsByCategory);
app.post("/:listingId/publish", publishListing);

app.use(authenticate);
app.post(
  "/identify-product",
  uploadImage.single("image"),
  validateImage,
  identifyProductImage,
);

app.post("/", createDraftListing);

app.get("/mine", getMyListings);

app.get("/:listingId/condition-questions", getListingConditionQuestions);

app.patch("/:listingId/condition-answers", saveListingConditionAnswers);
app.post(
  "/:listingId/images",
  listingImageUpload.array("images", MAX_LISTING_IMAGES),
  validateImages,
  uploadListingImages,
);
app.post("/:listingId/analyze-condition", analyzeListingCondition);

app.get("/:listingId", getMyListingById);

app.patch("/:listingId", updateSellerListing);
app.delete("/:listingId", deleteSellerListing);

export default app;
