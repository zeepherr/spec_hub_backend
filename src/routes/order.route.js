import express from "express";

import { createNewOrder } from "../controllers/order.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

// Creates a new order from an ACTIVE listing.
app.post("/", createNewOrder);

export default app;
