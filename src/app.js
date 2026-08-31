import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { corsOptions } from "./configs/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import { requestMdw } from "./middlewares/request.middlewares.js";
import aiRoute from "./routes/ai.route.js";
import authRoute from "./routes/auth.route.js";
import categoryRoute from "./routes/category.route.js";
import listingRoute from "./routes/listing.route.js";
const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(requestMdw);

app.use("/api/auth", authRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/ai", aiRoute);
app.use("/api/listings", listingRoute);
app.use(notFound);
app.use(errorHandler);
export default app;
