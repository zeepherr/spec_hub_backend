import express from "express";
import {
  createCategory,
  getAllCategoriesAdmin,
  getAllCategoriesForUser,
  updateCategory,
} from "../controllers/category.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { allowRoles } from "../middlewares/authorize.middleware.js";

const app = express.Router();
app.use(authenticate);

app.get("/", getAllCategoriesForUser);
app.get("/admin", allowRoles("ADMIN"), getAllCategoriesAdmin);
// app.get("/:id", allowRoles("ADMIN"), getCategory);
app.post("/", allowRoles("ADMIN"), createCategory);
app.patch("/:id", allowRoles("ADMIN"), updateCategory);

export default app;
