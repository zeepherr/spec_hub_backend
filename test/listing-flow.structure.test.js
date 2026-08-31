import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { toListingResponse } from "../src/utils/listing.response.js";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("listing response mapping", () => {
  it("replaces nested imageKey values with public imageUrl values", () => {
    const listing = {
      id: "listing-1",
      title: "ARROGANT TKL Gaming Keyboard",
      images: [
        {
          id: "image-1",
          listingId: "listing-1",
          imageKey: "listings/listing-1/photo.png",
          isCover: true,
          orderIndex: 0,
        },
      ],
    };

    const mapped = toListingResponse(listing);

    assert.equal(mapped.id, listing.id);
    assert.equal(mapped.images.length, 1);
    assert.equal("imageKey" in mapped.images[0], false);
    assert.ok(
      mapped.images[0].imageUrl.endsWith(
        "/listings/listing-1/photo.png",
      ),
    );
    assert.equal(mapped.images[0].isCover, true);
  });
});

describe("listing flow route structure", () => {
  it("registers POST /identify-product before listingId routes", async () => {
    const source = await readSource("src/routes/listing.route.js");
    const identifyRouteIndex = source.search(
      /app\.post\(\s*["']\/identify-product["']/,
    );
    const firstListingIdRouteIndex = source.search(
      /app\.(?:get|post|patch|put|delete)\(\s*["']\/:listingId(?:\/|["'])/,
    );

    assert.notEqual(identifyRouteIndex, -1);
    assert.notEqual(firstListingIdRouteIndex, -1);
    assert.ok(identifyRouteIndex < firstListingIdRouteIndex);
    assert.match(source, /uploadImage\.single\(["']image["']\)/);
    assert.match(source, /listingImageUpload\.array\(\s*["']images["'],\s*MAX_LISTING_IMAGES\s*\)/);
  });

  it("does not expose identify-product from the AI router", async () => {
    const source = await readSource("src/routes/ai.route.js");

    assert.doesNotMatch(source, /["']\/identify-product["']/);
  });
});
