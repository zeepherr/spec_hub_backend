import express from "express";

import {
  addListingToCart,
  getMyCart,
  removeListingFromCart,
} from "../controllers/cartItem.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

app.get("/", getMyCart);

app.post("/:listingId", addListingToCart);

app.delete("/:listingId", removeListingFromCart);

export default app;
