import createHttpError from "http-errors";

import {
  analyzeProductImage,
  generateGeminiText,
  researchProductMarketPrice,
} from "../providers/gemini.provider.js";
import { findActiveCategories } from "../services/category.service.js";
import {
  aiProductMarketResearchSchema,
  aiProductResultSchema,
} from "../validations/ai.schema.js";

const parseAiJson = (text) => {
  const normalizedText = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(normalizedText);
};

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
    parsedProduct = parseAiJson(aiResponse);
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
  let finalProduct = product;
  let marketPrice = null;

  try {
    const marketResearchResponse = await researchProductMarketPrice({
      buffer,
      mimetype: detectedType.mime,
      categories: categories.map((category) => category.name),
      preliminaryProduct: product,
    });

    const parsedMarketResearch = parseAiJson(marketResearchResponse.text);

    const marketResearch =
      aiProductMarketResearchSchema.parse(parsedMarketResearch);

    finalProduct = {
      category: marketResearch.category,
      title: marketResearch.title,
      brand: marketResearch.brand,
      model: marketResearch.model,
      description: marketResearch.description,
    };

    if (
      marketResearch.marketPrice.available &&
      marketResearchResponse.sources.length > 0
    ) {
      const { available, ...validatedMarketPrice } = marketResearch.marketPrice;

      marketPrice = validatedMarketPrice;
    } else if (marketResearch.marketPrice.available) {
      console.warn(
        "AI market price was omitted because no Google Search grounding sources were returned.",
      );
    }
  } catch (error) {
    console.error("AI market-price research failed:", {
      name: error.name,
      code: error.code,
      message: error.message,
      issues: error.issues,
    });
  }

  const matchedCategory = finalProduct.category
    ? (categories.find(
        (category) =>
          category.name.toLowerCase() === finalProduct.category.toLowerCase(),
      ) ?? null)
    : null;

  return res.status(200).json({
    success: true,
    message: "Product analyzed successfully",
    data: {
      title: finalProduct.title,
      category: matchedCategory,
      brand: finalProduct.brand,
      model: finalProduct.model,
      description: finalProduct.description,
      marketPrice,
    },
  });
};
