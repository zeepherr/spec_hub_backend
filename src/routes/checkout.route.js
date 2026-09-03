import express from "express";

import { createCheckout } from "../controllers/checkout.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

// Creates a checkout for one or more listings.
app.post("/", createCheckout);

export default app;
