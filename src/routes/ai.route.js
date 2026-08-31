import express from "express";

import {
  identifyProductImage,
  testAIConnection,
} from "../controllers/ai.controller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { uploadImage } from "../middlewares/upload.middleware.js";

const app = express.Router();

app.use(authenticate);

app.post("/test", testAIConnection);
app.post(
  "/identify-product",
  uploadImage.single("image"),
  identifyProductImage,
);

export default app;
