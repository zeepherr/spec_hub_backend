import {
  analyzeProductImage,
  generateGeminiText,
} from "../providers/gemini.provider.js";

import { findActiveCategories } from "../services/category.service.js";

import {
  aiProductResultSchema,
  validateProductImage,
} from "../validations/ai.schema.js";

/*
|--------------------------------------------------------------------------
| TEST CONNECTION
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| IDENTIFY PRODUCT FOR FORM AUTOFILL
|--------------------------------------------------------------------------
*/

export const identifyProductImage = async (req, res, next) => {
  try {
    /*
    |--------------------------------------------------------------------------
    | 1. Validate uploaded image
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | 2. Get active marketplace categories
    |--------------------------------------------------------------------------
    */

    const categories = await findActiveCategories();

    if (categories.length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_ACTIVE_CATEGORIES",
        message: "No active categories are available",
      });
    }

    const categoryNames = categories.map((category) => category.name);

    /*
    |--------------------------------------------------------------------------
    | 3. Analyze product image
    |--------------------------------------------------------------------------
    */

    const aiResponse = await analyzeProductImage({
      buffer,
      mimetype,
      categories: categoryNames,
    });

    /*
    |--------------------------------------------------------------------------
    | 4. Parse AI JSON
    |--------------------------------------------------------------------------
    */

    let parsedProduct;

    try {
      parsedProduct = JSON.parse(aiResponse);
    } catch {
      return res.status(502).json({
        success: false,
        code: "INVALID_AI_RESPONSE",
        message: "AI returned invalid JSON",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 5. Validate AI result
    |--------------------------------------------------------------------------
    */

    const productValidation = aiProductResultSchema.safeParse(parsedProduct);

    if (!productValidation.success) {
      return res.status(502).json({
        success: false,
        code: "INVALID_AI_RESPONSE",
        message: "AI returned an unexpected product format",
        errors: productValidation.error.flatten(),
      });
    }

    const product = productValidation.data;

    /*
    |--------------------------------------------------------------------------
    | 6. Match AI category with actual DB category
    |--------------------------------------------------------------------------
    */

    let matchedCategory = null;

    if (product.category) {
      matchedCategory =
        categories.find(
          (category) =>
            category.name.toLowerCase() === product.category.toLowerCase(),
        ) ?? null;
    }

    /*
    |--------------------------------------------------------------------------
    | 7. Return only fields needed by seller form
    |--------------------------------------------------------------------------
    */

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
  } catch (error) {
    next(error);
  }
};
