import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MulterError } from "multer";

import { errorHandler } from "../src/middlewares/error.middleware.js";
import {
  listingImageUpload,
  MAX_IMAGE_SIZE,
  MAX_LISTING_IMAGES,
  uploadImage,
} from "../src/middlewares/upload.middleware.js";
import {
  validateImage,
  validateImages,
} from "../src/middlewares/validateImage.middleware.js";

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==",
  "base64",
);
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const TINY_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);

const runValidation = async (middleware, req) => {
  let nextCalls = 0;
  let nextValue;

  await middleware(req, {}, (value) => {
    nextCalls += 1;
    nextValue = value;
  });

  assert.equal(nextCalls, 1);
  return nextValue;
};

describe("buffer-based image validation", () => {
  it("detects a JPEG from its bytes and attaches detectedType", async () => {
    const req = {
      file: {
        buffer: TINY_JPEG,
        mimetype: "application/octet-stream",
      },
    };

    const error = await runValidation(validateImage, req);

    assert.equal(error, undefined);
    assert.deepEqual(req.file.detectedType, {
      ext: "jpg",
      mime: "image/jpeg",
    });
  });

  it("detects every JPEG/PNG file in a multiple-image request", async () => {
    const req = {
      files: [
        { buffer: TINY_JPEG, mimetype: "image/png" },
        { buffer: TINY_PNG, mimetype: "image/jpeg" },
      ],
    };

    const error = await runValidation(validateImages, req);

    assert.equal(error, undefined);
    assert.equal(req.files[0].detectedType.mime, "image/jpeg");
    assert.equal(req.files[1].detectedType.mime, "image/png");
  });

  it("returns 400 when the required single or multiple files are missing", async () => {
    const singleError = await runValidation(validateImage, {});
    const multipleError = await runValidation(validateImages, {});

    assert.equal(singleError.status, 400);
    assert.equal(singleError.message, "Image is required.");
    assert.equal(multipleError.status, 400);
    assert.equal(multipleError.message, "At least one image is required.");
  });

  it("returns 415 for a detected but unsupported image type", async () => {
    const singleError = await runValidation(validateImage, {
      file: { buffer: TINY_GIF, mimetype: "image/jpeg" },
    });
    const multipleError = await runValidation(validateImages, {
      files: [{ buffer: TINY_GIF, mimetype: "image/png" }],
    });

    for (const error of [singleError, multipleError]) {
      assert.equal(error.status, 415);
      assert.equal(
        error.message,
        "Only JPEG, PNG, and WebP images are allowed.",
      );
    }
  });
});

describe("listing upload limits", () => {
  it("keeps five-megabyte and five-file Multer limits", () => {
    assert.equal(MAX_IMAGE_SIZE, 5 * 1024 * 1024);
    assert.equal(MAX_LISTING_IMAGES, 5);
    assert.equal(uploadImage.limits.fileSize, MAX_IMAGE_SIZE);
    assert.equal(listingImageUpload.limits.fileSize, MAX_IMAGE_SIZE);
    assert.equal(listingImageUpload.limits.files, MAX_LISTING_IMAGES);
  });

  it("returns the listing-specific max-five response for Multer file-count errors", () => {
    const response = {
      body: undefined,
      statusCode: undefined,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return body;
      },
    };

    errorHandler(
      new MulterError("LIMIT_FILE_COUNT"),
      {},
      response,
      () => assert.fail("Multer errors must not fall through"),
    );

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      success: false,
      code: "TOO_MANY_IMAGES",
      message: "A listing can have a maximum of 5 images.",
    });
  });
});
