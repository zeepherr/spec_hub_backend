import express from "express";

import { getBuyingOrders } from "../controllers/order.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

app.get("/buying", getBuyingOrders);
// Order management routes will be added here later.

export default app;
