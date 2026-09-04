import express from "express";

import {
  completeInspection,
  confirmOrderDelivery,
  getAdminOrders,
  getBuyingOrders,
  getOrderById,
  getSellingOrders,
  receiveOrderFromSeller,
  shipOrderToAdmin,
  shipOrderToBuyer,
  startOrderInspection,
} from "../controllers/order.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { allowRoles } from "./../middlewares/authorize.middleware.js";

const app = express.Router();

app.use(authenticate);

//buyer
app.get("/buying", getBuyingOrders);

//Seller
app.get("/selling", getSellingOrders);
app.post("/:orderId/ship-to-admin", shipOrderToAdmin);
app.post("/:orderId/confirm-delivery", confirmOrderDelivery);
//shered detail for both buyer and seller
app.get("/:orderId", getOrderById);

// Order management routes will be added here later.
//Admin routes
export const adminOrderRoute = express.Router();
adminOrderRoute.use(authenticate);
adminOrderRoute.use(allowRoles("ADMIN"));

adminOrderRoute.get("/", getAdminOrders);
adminOrderRoute.post("/:orderId/receive", receiveOrderFromSeller);
adminOrderRoute.post("/:orderId/inspection/start", startOrderInspection);
adminOrderRoute.post("/:orderId/inspection/complete", completeInspection);
adminOrderRoute.post("/:orderId/ship-to-buyer", shipOrderToBuyer);
adminOrderRoute.get("/:orderId", getOrderById);

export default app;
