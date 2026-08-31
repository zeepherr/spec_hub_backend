import createHttpError from "http-errors";

import {
  analyzeProductImage,
  generateGeminiText,
} from "../providers/gemini.provider.js";
import { findActiveCategories } from "../services/category.service.js";
import { aiProductResultSchema } from "../validations/ai.schema.js";

export const testAIConnection = async (req, res, next) => {
  try {
    const result = await generateGeminiText(
      "Reply exactly: AI connection works",
    );

    return res.status(200).json({
      success: true,
      message: "AI connection works",
      data: {
        response: result,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const identifyProductImage = async (req, res, next) => {
  const { buffer, detectedType } = req.file;

  const categories = await findActiveCategories();

  if (categories.length === 0) {
    return next(createHttpError(400, "No active categories are available."));
  }

  const aiResponse = await analyzeProductImage({
    buffer,
    mimetype: detectedType.mime,
    categories: categories.map((category) => category.name),
  });

  let parsedProduct;

  try {
    parsedProduct = JSON.parse(aiResponse);
  } catch {
    return next(createHttpError(502, "AI returned invalid JSON."));
  }

  let product;

  try {
    product = aiProductResultSchema.parse(parsedProduct);
  } catch {
    return next(
      createHttpError(502, "AI returned an unexpected product format."),
    );
  }

  const matchedCategory = product.category
    ? (categories.find(
        (category) =>
          category.name.toLowerCase() === product.category.toLowerCase(),
      ) ?? null)
    : null;

  return res.status(200).json({
    success: true,
    message: "Product analyzed successfully",
    data: {
      title: product.title,
      category: matchedCategory,
      brand: product.brand,
      model: product.model,
      description: product.description,
    },
  });
};
