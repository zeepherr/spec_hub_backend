import express from "express";

import { retryRefund } from "../controllers/refund.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { allowRoles } from "../middlewares/authorize.middleware.js";

const router = express.Router();

router.use(authenticate);
router.use(allowRoles("ADMIN"));

router.post("/:refundId/retry", retryRefund);

export default router;
