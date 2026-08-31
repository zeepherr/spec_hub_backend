import express from "express";

import { testAIConnection } from "../controllers/ai.controller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

app.post("/test", testAIConnection);

export default app;
