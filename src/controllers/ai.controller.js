import {
  analyzeProductImage,
  generateGeminiText,
} from "../providers/gemini.provider.js";
import { findActiveCategories } from "../services/category.service.js";

import {
  aiProductResultSchema,
  validateProductImage,
} from "../validations/ai.schema.js";

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
  try {
    const imageValidation = await validateProductImage(req.file);

    if (!imageValidation.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid product image",
        errors: imageValidation.errors,
      });
    }

    const { buffer, mimetype } = imageValidation.data;
    const categories = await findActiveCategories();

    if (categories.length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_ACTIVE_CATEGORIES",
        message: "No active categories are available",
      });
    }

    const categoryNames = categories.map((category) => category.name);

    const aiResponse = await analyzeProductImage({
      buffer,
      mimetype,
      categories: categoryNames,
    });

    let parsedAIResponse;

    try {
      parsedAIResponse = JSON.parse(aiResponse);
    } catch {
      return res.status(502).json({
        success: false,
        code: "INVALID_AI_RESPONSE",
        message: "AI returned invalid JSON",
      });
    }

    const aiValidation = aiProductResultSchema.safeParse(parsedAIResponse);

    if (!aiValidation.success) {
      return res.status(502).json({
        success: false,
        code: "INVALID_AI_RESPONSE",
        message: "AI returned an unexpected response format",
        errors: aiValidation.error.flatten(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product image analyzed successfully",
      data: aiValidation.data,
    });
  } catch (error) {
    next(error);
  }
};
