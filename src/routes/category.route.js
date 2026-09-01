// import express from "express";
// import {
//   createCategory,
//   getAllCategoriesAdmin,
//   getAllCategoriesForUser,
//   updateCategory,
// } from "../controllers/category.controller.js";
// import { authenticate } from "../middlewares/authenticate.middleware.js";
// import { allowRoles } from "../middlewares/authorize.middleware.js";

// const app = express.Router();
// app.use(authenticate);

// app.get("/", getAllCategoriesForUser);
// app.get("/admin", allowRoles("ADMIN"), getAllCategoriesAdmin);
// // app.get("/:id", allowRoles("ADMIN"), getCategory);
// app.post("/", allowRoles("ADMIN"), createCategory);
// app.patch("/:id", allowRoles("ADMIN"), updateCategory);

// export default app;

import express from "express";

import {
  createCategory,
  getAllCategoriesAdmin,
  getAllCategoriesForUser,
  updateCategory,
} from "../controllers/category.controller.js";

import {
  createQuestion,
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

//category

app.get("/admin", allowRoles("ADMIN"), getAllCategoriesAdmin);

app.post("/", allowRoles("ADMIN"), createCategory);

app.patch("/:id", allowRoles("ADMIN"), updateCategory);

//conditional question

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

export default app;
