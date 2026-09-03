import createHttpError from "http-errors";

import {
  addCategory,
  deleteCategoryById,
  findAllcategories,
  findCategoryBy,
  findCategoryRelationCounts,
  setCategory,
} from "../services/category.service.js";

import { findListingsByCatId } from "../services/listing.service.js";

import {
  createCategorySchema,
  updatCategorySchema,
} from "../validations/category.sehcma.js";

import { paramId } from "../validations/general.schema.js";

export const createCategory = async (req, res, next) => {
  const { name } = createCategorySchema.parse(req.body);

  const existCategory = await findCategoryBy("name", name);

  if (existCategory)
    return next(createHttpError(409, "This category is already exist."));

  const category = await addCategory(name);

  res.status(201).json({
    success: true,
    message: "Category created successfully.",
    data: category,
  });
};

export const getAllCategoriesAdmin = async (req, res, next) => {
  const categoies = await findAllcategories();

  let data = [];

  if (categoies.length > 0) {
    data = categoies;
  }

  res.status(200).json({
    success: true,
    message: "Get all categories",
    data,
  });
};

export const getAllCategoriesForUser = async (req, res, next) => {
  const categoies = await findAllcategories({
    isActive: true,
  });

  let data = [];

  if (categoies.length > 0) {
    data = categoies;
  }

  res.status(200).json({
    success: true,
    message: "Get all available categories",
    data,
  });
};

export const updateCategory = async (req, res, next) => {
  const { id } = paramId.parse(req.params);

  const existCategory = await findCategoryBy("id", id);

  if (!existCategory)
    return next(createHttpError(404, "This category is not exist."));

  const data = updatCategorySchema.parse(req.body);

  if (data.name) {
    const sameName = await findCategoryBy("name", data.name);

    if (sameName)
      return next(createHttpError(409, "This name is already exist."));
  }

  if (data.isActive === false) {
    const haveRelations = await findListingsByCatId(id);

    if (haveRelations.length > 0) {
      return next(
        createHttpError(409, "This category is still contains ducts."),
      );
    }
  }

  const cat = await setCategory(id, data);

  return res.status(200).json({
    success: true,
    message: "Updated Successfully",
    data: cat,
  });
};

export const deleteCategory = async (req, res, next) => {
  const { id } = paramId.parse(req.params);

  const existCategory = await findCategoryBy("id", id);

  if (!existCategory) {
    return next(createHttpError(404, "This category is not exist."));
  }

  const relations = await findCategoryRelationCounts(id);

  if (
    relations._count.listings > 0 ||
    relations._count.conditionQuestions > 0
  ) {
    return next(
      createHttpError(
        409,
        "This category cannot be deleted because it is still in use.",
      ),
    );
  }

  await deleteCategoryById(id);

  return res.status(200).json({
    success: true,
    message: "Category deleted successfully.",
  });
};
