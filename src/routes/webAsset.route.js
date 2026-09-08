import express from "express";

import {
  deleteWebAssetImage,
  getWebAssets,
  replaceWebAssetImage,
} from "../controllers/webAsset.controller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { allowRoles } from "../middlewares/authorize.middleware.js";
import { uploadImage } from "../middlewares/upload.middleware.js";
import { validateImage } from "../middlewares/validateImage.middleware.js";

const webAssetRoute = express.Router();

/*
 * Public read access.
 */
webAssetRoute.get("/", getWebAssets);

/*
 * Admin management.
 */
export const adminWebAssetRoute = express.Router();

adminWebAssetRoute.use(authenticate);
adminWebAssetRoute.use(allowRoles("ADMIN"));

adminWebAssetRoute.put(
  "/:slot",
  uploadImage.single("image"),
  validateImage,
  replaceWebAssetImage,
);

adminWebAssetRoute.delete("/:slot", deleteWebAssetImage);

export default webAssetRoute;
