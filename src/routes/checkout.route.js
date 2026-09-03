import express from "express";

import {
  createCheckout,
  quoteCheckout,
} from "../controllers/checkout.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

// Creates a checkout for one or more listings.
app.post("/quote", quoteCheckout);
app.post("/", createCheckout);

export default app;
