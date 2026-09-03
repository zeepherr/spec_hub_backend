import express from "express";

import {
  getBuyingOrders,
  getOrderById,
  getSellingOrders,
  shipOrderToAdmin,
} from "../controllers/order.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

app.get("/buying", getBuyingOrders);
app.get("/selling", getSellingOrders);
app.post("/:orderId/ship-to-admin", shipOrderToAdmin);

app.get("/:orderId", getOrderById);

// Order management routes will be added here later.

export default app;
