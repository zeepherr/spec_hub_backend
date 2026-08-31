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

import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

app.post("/", createDraftListing);

app.get("/mine", getMyListings);

app.get("/:listingId/condition-questions", getListingConditionQuestions);

app.patch("/:listingId/condition-answers", saveListingConditionAnswers);

app.get("/:listingId", getMyListingById);

app.patch("/:listingId", updateDraftListing);

export default app;
