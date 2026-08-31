import { GoogleGenAI } from "@google/genai";
import { config } from "../configs/index.js";

const ai = new GoogleGenAI({
  apiKey: config.gemini_api,
});

const model = config.gemini_model;

export const generateGeminiText = async (prompt) => {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

export const analyzeProductImage = async ({ buffer, mimetype, categories }) => {
  const response = await ai.models.generateContent({
    model,

    contents: [
      {
        role: "user",

        parts: [
          {
            text: `
Analyze this image of a second-hand IT product.

Available marketplace categories:

${categories.map((category) => `- ${category}`).join("\n")}

Return JSON only using this structure:

{
  "category": "one exact category name from the list above, or null",
  "brand": "string or null",
  "model": "string or null",
  "title": "string",
  "visibleSpecs": ["string"],
  "uncertain": ["string"],
  "confidence": 0.0
}

Rules:

- category MUST exactly match one of the available category names.
- If the product does not clearly match any category, return null.
- Never invent a category.
- Never invent brand or model.
- If brand is unclear, return null.
- If model is unclear, return null.
- visibleSpecs must only contain visually supported information.
- uncertain must describe information that cannot be confidently determined.
- confidence must be between 0 and 1.
- Return valid JSON only.
            `,
          },

          {
            inlineData: {
              mimeType: mimetype,
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],

    config: {
      responseMimeType: "application/json",
    },
  });

  return response.text;
};
