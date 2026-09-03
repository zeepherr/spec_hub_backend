import express from "express";

import {
  createCheckout,
  getPaymentStatus,
} from "../controllers/payment.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

// Creates a Stripe Checkout Session for an existing checkout.
app.post("/checkout", createCheckout);
app.get("/status/:sessionId", getPaymentStatus);

export default app;
