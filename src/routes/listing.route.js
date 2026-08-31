import express from "express";

import {
  createDraftListing,
  getMyListingById,
  getMyListings,
  updateDraftListing,
} from "../controllers/listing.controller.js";

import {
  getListingConditionQuestions,
  saveListingConditionAnswers,
} from "../controllers/sellerConditionAnswer.controller.js";

import { uploadListingImages } from "../controllers/listingImage.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import {
  listingImageUpload,
  MAX_LISTING_IMAGES,
} from "../middlewares/upload.middleware.js";

const app = express.Router();

app.use(authenticate);

app.post("/", createDraftListing);

app.get("/mine", getMyListings);

app.get("/:listingId/condition-questions", getListingConditionQuestions);

app.patch("/:listingId/condition-answers", saveListingConditionAnswers);
app.post(
  "/:listingId/images",
  listingImageUpload.array("images", MAX_LISTING_IMAGES),
  uploadListingImages,
);

app.get("/:listingId", getMyListingById);

app.patch("/:listingId", updateDraftListing);

export default app;

// Seller
//   ↓
// Click "Sell Product"
//   ↓
// Upload product image
//   ↓
// AI identifies product
//   ↓
// Autofill:
// title
// category
// brand
// model
// description
//   ↓
// Seller checks / edits AI suggestions
//   ↓
// Seller enters price manually
//   ↓
// Save listing

//   ↓
// Listing = DRAFT
//   ↓
// Load condition questions
//   ↓
// Seller answers product condition questions
//   ↓
// Upload / manage listing images
//   ↓
// Preview listing
//   ↓
// Backend checks:
// required fields?
// required condition answers?
// images?
// category still active?
//   ↓
// Seller clicks "Publish"
//   ↓
// DRAFT → ACTIVE
//   ↓
// Buyers can now see the product

// Seller selects 1–5 images
//         ↓
// POST /api/listings/:listingId/images
// multipart/form-data
//         ↓
// Multer memoryStorage
//         ↓
// req.files[]
//         ↓
// Validate real file types from buffer
//         ↓
// Check:
// listing exists?
// seller owns it?
// listing DRAFT?
// max images exceeded?
//         ↓
// Upload each image to R2
//         ↓
// R2 keys:
// listings/{listingId}/{uuid}.jpg
//         ↓
// Save ListingImage rows
//         ↓
// First image = cover
//         ↓
// Return public image URLs
