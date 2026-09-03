import express from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";

const app = express.Router();

app.use(authenticate);

// Order management routes will be added here later.

export default app;
