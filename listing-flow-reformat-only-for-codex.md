# Listing Flow Code Reformat Spec for Codex

## Goal

Reformat the **current working Listing flow only** into the project's existing coding style.

Do **not** redesign the flow.
Do **not** add update/delete logic.
Do **not** add new business rules.
Do **not** add unnecessary custom error codes.

The logic must keep working exactly as it does now.

---

# 1. Current Working Flow

```text
Seller
  ↓
Manual input OR AI autofill
  ↓
Create Listing as DRAFT
  ↓
Load condition questions
  ↓
Save condition answers
  ↓
Upload multiple images
  ↓
AI condition analysis
  ↓
estimatedCondition + estimatedScore
  ↓
Publish
  ↓
DRAFT → ACTIVE
```

This is the only scope of this rewrite.

---

# 2. Move AI Identify Product into Listing Route

The current AI autofill route should be handled from the Listing router because it belongs to the listing creation flow.

Use:

```http
POST /api/listings/identify-product
```

instead of a separate listing-create AI route.

The existing AI provider/controller logic can remain separated internally.

Recommended route:

```js
app.post(
  "/identify-product",
  upload.single("image"),
  validateImage,
  identifyProductImage,
);
```

Important route ordering:

```js
app.post("/identify-product", ...);

app.post("/", createDraftListing);

app.get("/mine", getMyListings);

app.get("/:listingId/condition-questions", getListingConditionQuestions);
app.patch("/:listingId/condition-answers", saveListingConditionAnswers);

app.post("/:listingId/images", ...);

app.post("/:listingId/analyze-condition", analyzeListingCondition);

app.post("/:listingId/publish", publishListing);

app.get("/:listingId", getMyListingById);
```

`/identify-product` must appear before generic `/:listingId`.

---

# 3. Match Existing Project Coding Style

Use the style from the existing Product controller.

## Validation

Use Zod `.parse()` directly.

Preferred:

```js
const data = createListingSchema.parse(req.body);
```

and:

```js
const { listingId } = listingIdSchema.parse(req.params);
```

Do not wrap schemas like:

```js
z.object({
  body: ...
})
```

if the controller is parsing `req.body` directly.

Do not use `safeParse()` unless necessary.

---

## Error Handling

Use:

```js
import createHttpError from "http-errors";
```

Example:

```js
if (!listing) {
  return next(createHttpError(404, "Listing not found."));
}
```

Do not add custom error codes unless they are genuinely required by frontend behavior.

For this Listing flow, normal status + message is enough in most cases.

Examples:

```js
return next(createHttpError(404, "Listing not found."));
return next(createHttpError(403, "You cannot access this listing."));
return next(createHttpError(400, "Only draft listings can continue this process."));
```

Keep errors simple.

---

## Controller Style

Use compact linear controllers.

Preferred:

```js
export const someController = async (req, res, next) => {
  const data = schema.parse(req.body);

  const listing = await findSomething(...);

  if (!listing) {
    return next(createHttpError(...));
  }

  const result = await doSomething(...);

  return res.status(200).json({
    success: true,
    message: "...",
    data: result,
  });
};
```

Do not add large decorative comment blocks.

---

## Service Style

Services contain Prisma/database operations only.

No:

```text
HTTP errors
ownership checks
status checks
response formatting
AI business decisions
R2 business decisions
```

---

# 4. Files to Reformat

Review/reformat only the files involved in today's working flow.

```text
src/routes/listing.route.js

src/controllers/ai.controller.js
src/controllers/listing.controller.js
src/controllers/sellerConditionAnswer.controller.js
src/controllers/listingImage.controller.js
src/controllers/listingConditionAnalysis.controller.js
src/controllers/listingPublish.controller.js

src/providers/gemini.provider.js

src/services/listing.service.js
src/services/sellerConditionAnswer.service.js
src/services/listingImage.service.js
src/services/r2.storage.service.js

src/validations/ai.schema.js
src/validations/listing.schema.js
src/validations/sellerConditionAnswer.schema.js
src/validations/listingConditionAnalysis.schema.js

src/middlewares/upload.middleware.js
src/middlewares/validateImage.middleware.js
or the actual existing equivalent files

src/utils/listing/listing.mapper.js
src/utils/listing/listingImage.mapper.js
if response mappers are used
```

Do not touch unrelated modules.

---

# 5. Listing Router Target

The Listing router should contain the full listing-creation workflow.

Conceptually:

```js
import express from "express";

import { identifyProductImage } from "../controllers/ai.controller.js";

import {
  createDraftListing,
  getMyListingById,
  getMyListings,
} from "../controllers/listing.controller.js";

import {
  getListingConditionQuestions,
  saveListingConditionAnswers,
} from "../controllers/sellerConditionAnswer.controller.js";

import { uploadListingImages } from "../controllers/listingImage.controller.js";
import { analyzeListingCondition } from "../controllers/listingConditionAnalysis.controller.js";
import { publishListing } from "../controllers/listingPublish.controller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validateImage } from "../middlewares/validateImage.middleware.js";

const app = express.Router();

app.use(authenticate);

app.post(
  "/identify-product",
  upload.single("image"),
  validateImage,
  identifyProductImage,
);

app.post("/", createDraftListing);

app.get("/mine", getMyListings);

app.get(
  "/:listingId/condition-questions",
  getListingConditionQuestions,
);

app.patch(
  "/:listingId/condition-answers",
  saveListingConditionAnswers,
);

app.post(
  "/:listingId/images",
  // use the existing multiple-image multer middleware here
  // then the multiple-image validation middleware
  uploadListingImages,
);

app.post(
  "/:listingId/analyze-condition",
  analyzeListingCondition,
);

app.post(
  "/:listingId/publish",
  publishListing,
);

app.get("/:listingId", getMyListingById);

export default app;
```

Do not copy this blindly if the existing middleware export names differ.
Use the project's actual names.

---

# 6. Step 1 — Identify Product

## Route

```http
POST /api/listings/identify-product
```

## Input

```text
multipart/form-data
image: File
```

## Purpose

Use Gemini to autofill only:

```text
title
category
brand
model
description
```

Do not recommend price.

Do not include:

```text
priceEstimate
recommendedPrice
visibleSpecs
uncertain
confidence
```

unless the currently working code still requires them internally.

The final frontend response should stay focused on the listing form.

Expected shape:

```json
{
  "success": true,
  "message": "Product analyzed successfully",
  "data": {
    "title": "ARROGANT TKL Gaming Keyboard",
    "category": {
      "id": 1,
      "name": "Keyboard"
    },
    "brand": "ARROGANT",
    "model": "TKL Gaming Keyboard",
    "description": "Compact gaming keyboard with blue LED backlighting."
  }
}
```

The AI image is temporary and is not permanently stored in this step.

---

# 7. AI Image Validation Style

Reformat AI image validation to match the existing project pattern:

```text
Multer
↓
validateImage middleware
↓
req.file.detectedType
↓
controller
```

Use `fileTypeFromBuffer()` for real file type detection.

Allowed:

```text
image/jpeg
image/png
image/webp
```

Fix the old incorrect condition if it still exists.

Incorrect:

```js
allowedImageTypes.has(
  detectedType.mime || detectedType.mime !== req.file.mimetype
)
```

Correct core validation:

```js
if (
  !detectedType ||
  !allowedImageTypes.has(detectedType.mime)
) {
  return next(
    createHttpError(
      415,
      "Only JPEG, PNG, and WebP images are allowed.",
    ),
  );
}
```

Then:

```js
req.file.detectedType = detectedType;
next();
```

---

# 8. Step 2 — Create DRAFT Listing

## Route

```http
POST /api/listings
```

## Input

Keep the current working fields:

```json
{
  "categoryId": 1,
  "title": "ARROGANT TKL Gaming Keyboard",
  "description": "Used gaming keyboard with blue LED backlight.",
  "brand": "ARROGANT",
  "model": "TKL Gaming Keyboard",
  "price": 650,
  "location": "Bangkok"
}
```

Backend must still:

```text
check category exists
check category active
sellerId = req.user.id
status = DRAFT
estimatedCondition remains null
estimatedScore remains null
```

Do not let client send trusted values for:

```text
sellerId
status
estimatedCondition
estimatedScore
```

Keep logically identical behavior.

---

# 9. `listing.schema.js`

Reformat from wrapper style:

```js
z.object({
  body: z.object({...})
})
```

to direct request-body style:

```js
export const createListingSchema = z.object({
  categoryId: z.coerce.number().int().positive(),

  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(150, "Title must not exceed 150 characters"),

  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(3000, "Description must not exceed 3000 characters"),

  brand: z
    .string()
    .trim()
    .min(1, "Brand is required")
    .max(100),

  model: z
    .string()
    .trim()
    .min(1, "Model is required")
    .max(150),

  price: z.coerce
    .number()
    .positive("Price must be greater than 0"),

  location: z
    .string()
    .trim()
    .min(2, "Location is required")
    .max(150),
});

export const listingIdSchema = z.object({
  listingId: z.uuid(),
});
```

Do not include update logic in this rewrite.

---

# 10. `listing.controller.js`

Only keep today's required behavior:

```text
createDraftListing
getMyListings
getMyListingById
```

Do not add/update/delete business rules in this task.

## `createDraftListing`

Target style:

```js
export const createDraftListing = async (req, res, next) => {
  const data = createListingSchema.parse(req.body);

  const category = await findCategoryBy("id", data.categoryId);

  if (!category) {
    return next(createHttpError(404, "Category not found."));
  }

  if (!category.isActive) {
    return next(
      createHttpError(
        400,
        "This category is currently unavailable.",
      ),
    );
  }

  const listing = await createListing({
    ...data,
    sellerId: req.user.id,
    status: "DRAFT",
  });

  return res.status(201).json({
    success: true,
    message: "Draft listing created successfully",
    data: toListingResponse(listing),
  });
};
```

Use existing actual service/mapper names if different.

---

# 11. Step 3 — Condition Questions

## Route

```http
GET /api/listings/:listingId/condition-questions
```

Keep existing logic exactly:

```text
parse listingId
find listing
check owner
require DRAFT
load active questions by listing.categoryId
load existing answers
merge answerValue
return
```

Reformat errors to simple `createHttpError()` style.

Do not redesign.

---

# 12. Step 4 — Condition Answers

## Route

```http
PATCH /api/listings/:listingId/condition-answers
```

Keep existing body:

```json
{
  "answers": [
    {
      "questionId": 1,
      "answerValue": true
    }
  ]
}
```

Keep current logic:

```text
listing exists
owner check
DRAFT only
question belongs to listing category
question active
BOOLEAN requires boolean
NUMBER requires number
TEXT requires string
SELECT requires valid option
upsert answers
```

No unnecessary error codes.

Simple errors are enough.

---

# 13. `sellerConditionAnswer.schema.js`

Reformat params/body schemas to direct parse style.

Example:

```js
export const listingConditionParamsSchema = z.object({
  listingId: z.uuid(),
});

export const saveConditionAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.coerce.number().int().positive(),
        answerValue: answerValueSchema,
      }),
    )
    .min(1, "At least one answer must be provided")
    .superRefine((answers, ctx) => {
      const ids = answers.map((answer) => answer.questionId);

      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: "custom",
          message:
            "The same question cannot appear more than once",
        });
      }
    }),
});
```

Controller should use:

```js
const { listingId } =
  listingConditionParamsSchema.parse(req.params);

const { answers } =
  saveConditionAnswersSchema.parse(req.body);
```

---

# 14. Remove Duplicate Listing Lookup

There was a duplicate:

```text
findListingForConditionAnswers
```

in both:

```text
listing.service.js
sellerConditionAnswer.service.js
```

Keep only one copy.

Recommended:

```text
listing.service.js
```

because it queries `Listing`.

`sellerConditionAnswer.service.js` should contain only condition-question/answer Prisma operations.

---

# 15. Step 5 — Multiple Image Upload

## Route

```http
POST /api/listings/:listingId/images
```

Keep the current working behavior.

```text
maximum = 5 images
memory storage
JPEG/PNG/WebP
buffer-based real file validation
R2 upload
ListingImage rows
first image cover when no existing images
cleanup newly-uploaded R2 objects if DB write fails
```

Do not add:

```text
image delete
replace
reorder
change cover
```

in this task.

---

# 16. Multiple Image Middleware Style

Match the project's previous single-image flow:

```text
Multer
↓
validateImages middleware
↓
req.files[].detectedType
↓
controller
```

Multer:

```js
limits: {
  fileSize: MAX_IMAGE_SIZE,
  files: MAX_LISTING_IMAGES,
}
```

Use:

```js
upload.array("images", MAX_LISTING_IMAGES)
```

or the project's existing listing-specific export.

The validation middleware should loop through every file:

```js
for (const file of req.files) {
  const detectedType =
    await fileTypeFromBuffer(file.buffer);

  if (
    !detectedType ||
    !allowedImageTypes.has(detectedType.mime)
  ) {
    return next(
      createHttpError(
        415,
        "Only JPEG, PNG, and WebP images are allowed.",
      ),
    );
  }

  file.detectedType = detectedType;
}

next();
```

---

# 17. Listing Image Controller Style

Reformat the working controller to compact Product-style logic.

Preserve:

```js
const uploadedKeys = [];
```

Flow:

```text
parse listingId
check req.files
find listing
owner check
DRAFT check
count existing images
existing + new <= 5
upload each R2 object
track uploaded keys
build ListingImage DB data
DB create transaction
if DB fails → delete all uploaded R2 keys
return image URLs
```

Do not change behavior.

---

# 18. R2 Service

Keep existing:

```text
getR2PublicUrl
uploadToR2
deleteFromR2
getFromR2
```

The R2 service is already compatible with multiple images because the controller calls `uploadToR2()` once per image.

Do not move business logic into R2 service.

---

# 19. Listing Image Mapper

Follow existing Product mapper style.

Example:

```js
import { getR2PublicUrl } from "../../services/r2.storage.service.js";

export const toListingImageResponse = (image) => {
  const { imageKey, ...rest } = image;

  return {
    ...rest,
    imageUrl: getR2PublicUrl(imageKey),
  };
};
```

For listing detail response, map nested images too.

Do not expose raw `imageKey` to frontend when `imageUrl` is sufficient.

---

# 20. Step 6 — AI Condition Analysis

## Route

```http
POST /api/listings/:listingId/analyze-condition
```

Keep the current working behavior exactly.

Backend must still:

```text
load Listing
load category
load condition answers
load images
check owner
require DRAFT
check required answers complete
require image
get image buffers from R2
send images + answers to Gemini
validate AI JSON
AI returns score
backend calculates grade
save estimatedScore
save estimatedCondition
return result
```

Do not change the Gemini condition-analysis logic except formatting to match code style.

---

# 21. AI Condition Result Validation

Keep:

```json
{
  "score": 85,
  "summary": "..."
}
```

Direct schema style:

```js
export const aiConditionAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string().trim().min(1).max(1000),
});
```

---

# 22. Condition Grade Logic

Keep exactly:

```text
90–100 → LIKE_NEW
75–89  → GOOD
50–74  → FAIR
0–49   → POOR
```

Do not change thresholds.

The AI returns score.

Backend chooses the enum.

---

# 23. Step 7 — Publish

## Route

```http
POST /api/listings/:listingId/publish
```

Keep current working validation:

```text
listing exists
seller owns listing
status = DRAFT
category active
required condition answers complete
at least one image exists
estimatedCondition exists
estimatedScore exists
```

Then:

```text
status = ACTIVE
```

No request body is needed.

Do not let client send status.

Reformat controller only; do not change logic.

---

# 24. Service Layer Target

Keep Prisma-only methods.

`listing.service.js` may contain:

```text
createListing
findListingsBySeller
findListingById
findListingForConditionAnswers
findListingForConditionAnalysis
updateListingConditionEstimate
publishListingById
```

Do not add update/delete methods in this task.

`sellerConditionAnswer.service.js`:

```text
findActiveQuestionsByCategory
findQuestionsByIds
findAnswersByListing
findRequiredQuestionsByCategory
upsertConditionAnswers
```

`listingImage.service.js`:

```text
countListingImages
createListingImages
```

Use current real names if they already exist and are sensible.

Do not rename everything just for style.

---

# 25. No Unnecessary Error Codes

Do not add OTP-style custom error codes for every error.

For normal Listing errors use HTTP status + message.

Examples:

```js
return next(
  createHttpError(404, "Listing not found."),
);
```

```js
return next(
  createHttpError(
    403,
    "You cannot access this listing.",
  ),
);
```

```js
return next(
  createHttpError(
    400,
    "Only draft listings can continue this process.",
  ),
);
```

Use custom codes only if the current frontend truly needs to distinguish a special condition programmatically.

---

# 26. Do Not Change These Things

Do not implement or redesign:

```text
ACTIVE update
DRAFT update
listing delete
individual image delete
image replace
image reorder
change cover
draft cleanup
price recommendation
buyer browse flow
chat
offer
order
payment
shipping
```

Those are outside this task.

---

# 27. Required Regression Tests

After reformatting, Codex must verify the same flow still works.

## AI Autofill

```http
POST /api/listings/identify-product
```

Expected:

```text
title
category
brand
model
description
```

---

## Create DRAFT

```http
POST /api/listings
```

Expected:

```text
status = DRAFT
estimatedCondition = null
estimatedScore = null
```

---

## Questions

```http
GET /api/listings/:id/condition-questions
```

Expected category questions.

---

## Save Answers

```http
PATCH /api/listings/:id/condition-answers
```

Expected saved/upserted answers.

---

## Upload Images

```http
POST /api/listings/:id/images
```

Expected:

```text
1–5 files
R2 upload
DB ListingImage rows
first cover
```

---

## Analyze

```http
POST /api/listings/:id/analyze-condition
```

Known working example:

```json
{
  "estimatedCondition": "GOOD",
  "estimatedScore": "85"
}
```

must remain possible.

---

## Publish

```http
POST /api/listings/:id/publish
```

Expected:

```json
{
  "status": "ACTIVE"
}
```

---

# 28. Definition of Done

The rewrite is complete only if:

```text
[ ] AI identify-product moved under listing router
[ ] same AI autofill output still works
[ ] controllers use project-style Zod `.parse()`
[ ] controllers use createHttpError + next
[ ] no unnecessary custom error codes
[ ] controllers remain compact
[ ] services remain DB-only
[ ] duplicate listing lookup removed
[ ] image validation uses middleware + detectedType
[ ] multiple upload still supports max 5
[ ] R2 failure cleanup still works
[ ] imageKey is mapped to imageUrl
[ ] condition answers still work
[ ] AI condition analysis still works
[ ] score-to-grade rule unchanged
[ ] publish still changes DRAFT → ACTIVE
[ ] no update/delete/new features added
[ ] no unrelated modules refactored
```

---

# 29. Codex Instruction

Use this as the final instruction:

> Inspect the current repository first. Reformat only the working Listing creation/publish flow described in this file so it matches the existing Product controller/service coding style. Preserve the current behavior exactly. Move `identify-product` under the Listing router. Use Zod `.parse()`, `createHttpError` + `next`, compact controllers, DB-only services, existing R2 cleanup patterns, and response mappers. Do not add update/delete logic or unrelated features. Do not add custom error codes unless the current implementation genuinely requires one. After changes, verify every regression test listed in this document.
