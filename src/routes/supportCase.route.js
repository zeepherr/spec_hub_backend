import express from "express";

import {
  createSupportCase,
  getAdminSupportCaseDetail,
  getAdminSupportCases,
  getMySupportCases,
  getSupportCaseDetail,
  getSupportCaseMessages,
  updateAdminSupportCaseStatus,
} from "../controllers/supportCase.controller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { allowRoles } from "../middlewares/authorize.middleware.js";

const supportCaseRoute = express.Router();

/*
 * Buyer/Seller Support routes.
 *
 * Buyer and Seller are both USER accounts.
 * Their Buyer/Seller relationship is checked against the Order
 * inside the controller.
 */
supportCaseRoute.use(authenticate);
supportCaseRoute.use(allowRoles("USER"));

supportCaseRoute.post("/", createSupportCase);

supportCaseRoute.get("/", getMySupportCases);

supportCaseRoute.get("/:supportCaseId/messages", getSupportCaseMessages);

supportCaseRoute.get("/:supportCaseId", getSupportCaseDetail);

/*
 * Admin Support routes.
 */
export const adminSupportCaseRoute = express.Router();

adminSupportCaseRoute.use(authenticate);
adminSupportCaseRoute.use(allowRoles("ADMIN"));

adminSupportCaseRoute.get("/", getAdminSupportCases);

adminSupportCaseRoute.get("/:supportCaseId/messages", getSupportCaseMessages);

adminSupportCaseRoute.patch(
  "/:supportCaseId/status",
  updateAdminSupportCaseStatus,
);

adminSupportCaseRoute.get("/:supportCaseId", getAdminSupportCaseDetail);

export default supportCaseRoute;
