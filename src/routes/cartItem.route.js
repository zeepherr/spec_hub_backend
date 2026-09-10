import express from "express";

import {
  addListingToCart,
  getMyCart,
  removeListingFromCart,
} from "../controllers/cartItem.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { allowRoles } from "./../middlewares/authorize.middleware.js";

const app = express.Router();

app.use(authenticate);
app.use(allowRoles("USER"));

app.get("/", getMyCart);

app.post("/:listingId", addListingToCart);

app.delete("/:listingId", removeListingFromCart);

export default app;
