import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  aiConditionAnalysisSchema,
  aiProductResultSchema,
  analyzeListingConditionParamsSchema,
} from "../src/validations/ai.schema.js";
import {
  createListingSchema,
  listingIdSchema,
} from "../src/validations/listing.schema.js";
import {
  listingConditionParamsSchema,
  saveConditionAnswersSchema,
} from "../src/validations/sellerConditionAnswer.schema.js";

describe("listing request schemas", () => {
  it("parses a direct create body, coerces form values, and strips trusted fields", () => {
    const parsed = createListingSchema.parse({
      categoryId: "12",
      title: "  ARROGANT TKL Gaming Keyboard  ",
      description: "  Used gaming keyboard with blue LED backlighting.  ",
      brand: "  ARROGANT  ",
      model: "  TKL Gaming Keyboard  ",
      price: "650",
      location: "  Bangkok  ",
      sellerId: randomUUID(),
      status: "ACTIVE",
      estimatedCondition: "LIKE_NEW",
      estimatedScore: 100,
    });

    assert.deepEqual(parsed, {
      categoryId: 12,
      title: "ARROGANT TKL Gaming Keyboard",
      description: "Used gaming keyboard with blue LED backlighting.",
      brand: "ARROGANT",
      model: "TKL Gaming Keyboard",
      price: 650,
      location: "Bangkok",
    });
    assert.equal("sellerId" in parsed, false);
    assert.equal("status" in parsed, false);
    assert.equal("estimatedCondition" in parsed, false);
    assert.equal("estimatedScore" in parsed, false);
  });

  it("parses listing and condition route params directly as UUIDs", () => {
    const listingId = randomUUID();

    assert.deepEqual(listingIdSchema.parse({ listingId }), { listingId });
    assert.deepEqual(listingConditionParamsSchema.parse({ listingId }), {
      listingId,
    });
    assert.deepEqual(
      analyzeListingConditionParamsSchema.parse({ listingId }),
      { listingId },
    );

    assert.throws(() => listingIdSchema.parse({ listingId: "not-a-uuid" }));
  });
});

describe("condition-answer schemas", () => {
  it("accepts supported answer types and coerces question IDs", () => {
    const parsed = saveConditionAnswersSchema.parse({
      answers: [
        { questionId: "1", answerValue: true },
        { questionId: 2, answerValue: 42 },
        { questionId: 3, answerValue: "  Minor scratches  " },
      ],
    });

    assert.deepEqual(parsed, {
      answers: [
        { questionId: 1, answerValue: true },
        { questionId: 2, answerValue: 42 },
        { questionId: 3, answerValue: "Minor scratches" },
      ],
    });
  });

  it("rejects duplicate question IDs after coercion", () => {
    const result = saveConditionAnswersSchema.safeParse({
      answers: [
        { questionId: "7", answerValue: true },
        { questionId: 7, answerValue: false },
      ],
    });

    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.some(
        (issue) =>
          issue.message === "The same question cannot appear more than once",
      ),
    );
  });
});

describe("AI result schemas", () => {
  it("keeps only listing autofill fields from the product result", () => {
    const parsed = aiProductResultSchema.parse({
      category: "  Keyboard  ",
      title: "  ARROGANT TKL Gaming Keyboard  ",
      brand: "  ARROGANT  ",
      model: "  TKL Gaming Keyboard  ",
      description: "  Compact keyboard with visible blue backlighting.  ",
      priceEstimate: 650,
      recommendedPrice: 625,
      visibleSpecs: ["blue backlight"],
      uncertain: false,
      confidence: 0.98,
    });

    assert.deepEqual(parsed, {
      category: "Keyboard",
      title: "ARROGANT TKL Gaming Keyboard",
      brand: "ARROGANT",
      model: "TKL Gaming Keyboard",
      description: "Compact keyboard with visible blue backlighting.",
    });
  });

  it("accepts boundary condition scores, strips unknown fields, and rejects out-of-range scores", () => {
    assert.deepEqual(
      aiConditionAnalysisSchema.parse({
        score: 0,
        summary: "  Significant wear is visible.  ",
        estimatedCondition: "POOR",
      }),
      {
        score: 0,
        summary: "Significant wear is visible.",
      },
    );

    assert.equal(
      aiConditionAnalysisSchema.parse({
        score: 100,
        summary: "Appears exceptionally clean.",
      }).score,
      100,
    );
    assert.throws(() =>
      aiConditionAnalysisSchema.parse({
        score: 101,
        summary: "Invalid score.",
      }),
    );
  });
});
