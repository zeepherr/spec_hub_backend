import cors from "cors";
import express from "express";
import { corsOptions } from "./configs/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import { requestMdw } from "./middlewares/request.middlewares.js";

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(requestMdw);

app.use(notFound);
app.use(errorHandler);
export default app;
