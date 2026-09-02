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

export const analyzeProductCondition = async ({
  title,
  category,
  brand,
  productModel,
  description,
  answers,
  images,
}) => {
  const formattedAnswers = answers
    .map(
      (answer) =>
        `Question: ${answer.question}\nAnswer: ${JSON.stringify(answer.answer)}`,
    )
    .join("\n\n");

  const imageParts = images.map((image) => ({
    inlineData: {
      mimeType: image.mimetype,
      data: image.buffer.toString("base64"),
    },
  }));

  const response = await ai.models.generateContent({
    model,

    contents: [
      {
        role: "user",

        parts: [
          {
            text: `
Analyze the condition of this second-hand IT product.

Product information:

Title: ${title}
Category: ${category}
Brand: ${brand ?? "Unknown"}
Model: ${productModel ?? "Unknown"}
Description: ${description}

Seller condition answers:

${formattedAnswers}

You are also given product images.

Estimate the overall product condition.

Return valid JSON only:

{
  "score": 0,
  "summary": "short condition explanation"
}

SCORING:

90-100:
Extremely clean condition with little or no visible wear and no meaningful reported problems.

75-89:
Good used condition with normal minor wear and no major reported problems.

50-74:
Noticeable wear or some functional/cosmetic issues.

0-49:
Significant damage, serious functional problems, or poor overall condition.

IMPORTANT RULES:

- score must be between 0 and 100.
- Use both seller answers and visible image evidence.
- Do not invent damage that cannot be observed or reported.
- Do not assume functionality only from appearance.
- Seller answers may provide functional information that images cannot prove.
- If evidence is uncertain, score conservatively.
- Cosmetic appearance alone must not prove internal functionality.
- Return JSON only.
- No markdown.
- No code fences.
          `,
          },

          ...imageParts,
        ],
      },
    ],

    config: {
      responseMimeType: "application/json",
    },
  });

  return response.text;
};
