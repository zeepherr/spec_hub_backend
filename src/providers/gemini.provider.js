import { GoogleGenAI } from "@google/genai";
import { config } from "../configs/index.js";

const ai = new GoogleGenAI({
  apiKey: config.gemini_api,
});

const model = config.gemini_model;

/*
|--------------------------------------------------------------------------
| BASIC TEXT TEST
|--------------------------------------------------------------------------
*/

export const generateGeminiText = async (prompt) => {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

/*
|--------------------------------------------------------------------------
| PRODUCT AUTOFILL FROM IMAGE
|--------------------------------------------------------------------------
*/

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

Return valid JSON only.

Required structure:

{
  "category": "exact category name or null",
  "title": "string",
  "brand": "string or null",
  "model": "string or null",
  "description": "string"
}

Rules:

CATEGORY:
- Must exactly match one category from the provided list.
- If no category clearly matches, return null.
- Never invent a category.

TITLE:
- Create a short marketplace-ready product title.
- Include brand and model only when confidently identified.
- Do not invent product information.

BRAND:
- Return the brand only when it can reasonably be identified.
- Otherwise return null.

MODEL:
- Return the model only when it can reasonably be identified.
- Otherwise return null.
- Never guess an exact model from appearance alone.

DESCRIPTION:
- Create a short seller-editable marketplace description.
- Mention only information reasonably visible from the image.
- Do not say the product works unless that can actually be verified.
- Do not invent:
  - purchase date
  - usage duration
  - repair history
  - internal specifications
  - battery condition
  - functional condition
  - ownership history

Return JSON only.
Do not include markdown.
Do not include code fences.
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
