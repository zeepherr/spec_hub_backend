import express from "express";

import {
  createCheckout,
  quoteCheckout,
} from "../controllers/checkout.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { allowRoles } from "../middlewares/authorize.middleware.js";

const app = express.Router();

app.use(authenticate);
app.use(allowRoles("USER"));

// Creates a checkout for one or more listings.
app.post("/quote", quoteCheckout);
app.post("/", createCheckout);

export default app;
