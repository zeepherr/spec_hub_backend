import express from "express";

import {
  createCategory,
  deleteCategory,
  getAllCategoriesAdmin,
  getAllCategoriesForUser,
  updateCategory,
} from "../controllers/category.controller.js";

import {
  createQuestion,
  deleteQuestion,
  getQuestionById,
  getQuestionsByCategory,
  updateQuestion,
  updateQuestionStatus,
} from "../controllers/conditionQuestion.controller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { allowRoles } from "../middlewares/authorize.middleware.js";

const app = express.Router();

app.get("/", getAllCategoriesForUser);

app.use(authenticate);

// Category

app.get("/admin", allowRoles("ADMIN"), getAllCategoriesAdmin);

app.post("/", allowRoles("ADMIN"), createCategory);

app.patch("/:id", allowRoles("ADMIN"), updateCategory);

app.delete("/:id", allowRoles("ADMIN"), deleteCategory);

// Condition question

app.get("/:categoryId/questions", allowRoles("ADMIN"), getQuestionsByCategory);

app.post("/:categoryId/questions", allowRoles("ADMIN"), createQuestion);

app.get(
  "/:categoryId/questions/:questionId",
  allowRoles("ADMIN"),
  getQuestionById,
);

app.patch(
  "/:categoryId/questions/:questionId",
  allowRoles("ADMIN"),
  updateQuestion,
);

app.patch(
  "/:categoryId/questions/:questionId/status",
  allowRoles("ADMIN"),
  updateQuestionStatus,
);

app.delete(
  "/:categoryId/questions/:questionId",
  allowRoles("ADMIN"),
  deleteQuestion,
);

export default app;
