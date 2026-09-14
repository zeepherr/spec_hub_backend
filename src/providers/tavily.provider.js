import { tavily } from "@tavily/core";

import { config } from "../configs/index.js";
import { normalizeTavilyError } from "../utils/provider-error.js";

const tavilyClient = tavily({
  apiKey: config.tavily_api,
});

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeSearchResults = (results = []) => {
  const seenUrls = new Set();

  return results
    .filter((result) => {
      if (!result?.url || !isValidHttpUrl(result.url)) {
        return false;
      }

      if (seenUrls.has(result.url)) {
        return false;
      }

      seenUrls.add(result.url);

      return true;
    })
    .slice(0, 8)
    .map((result) => ({
      title: result.title?.trim() || "Untitled source",
      url: result.url,
      content: result.content?.trim().slice(0, 1500) || "",
      score: typeof result.score === "number" ? result.score : null,
    }));
};

const runTavilySearch = async (query) => {
  try {
    const response = await tavilyClient.search(query, {
      topic: "general",
      searchDepth: "basic",
      maxResults: 8,
      country: "thailand",
      includeAnswer: false,
      includeRawContent: false,
      includeImages: false,
    });

    return normalizeSearchResults(response.results);
  } catch (error) {
    throw normalizeTavilyError(error);
  }
};

const buildSearchQueries = ({ category, title, brand, model }) => {
  const safeCategory = category?.trim() || "IT product";
  const safeTitle = title?.trim() || safeCategory;
  const safeBrand = brand?.trim() || "";
  const safeModel = model?.trim() || "";

  const exactSecondHandQuery = safeModel
    ? [
        safeBrand,
        safeModel,
        safeCategory,
        "มือสอง ราคา บาท",
        "Thailand used second hand price THB",
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  const similarSecondHandQuery = [
    safeBrand,
    safeModel || safeTitle,
    safeCategory,
    "รุ่นใกล้เคียง มือสอง ราคา บาท",
    "Thailand similar used second hand price THB",
  ]
    .filter(Boolean)
    .join(" ");

  const retailQuery = [
    safeBrand,
    safeModel || safeTitle,
    safeCategory,
    "ราคาของใหม่ ราคาเปิดตัว บาท",
    "Thailand original retail price THB",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    exactSecondHandQuery,
    similarSecondHandQuery,
    retailQuery,
  };
};

const createSources = (resultGroups) => {
  const seenUrls = new Set();

  return resultGroups
    .flat()
    .filter((result) => {
      if (seenUrls.has(result.url)) {
        return false;
      }

      seenUrls.add(result.url);

      return true;
    })
    .slice(0, 15)
    .map((result) => ({
      title: result.title,
      url: result.url,
    }));
};

export const searchProductMarketPrices = async ({
  category,
  title,
  brand,
  model,
}) => {
  const { exactSecondHandQuery, similarSecondHandQuery, retailQuery } =
    buildSearchQueries({
      category,
      title,
      brand,
      model,
    });

  const searchRequests = [];

  if (exactSecondHandQuery) {
    searchRequests.push({
      type: "exactSecondHand",
      query: exactSecondHandQuery,
    });
  }

  searchRequests.push(
    {
      type: "similarSecondHand",
      query: similarSecondHandQuery,
    },
    {
      type: "retail",
      query: retailQuery,
    },
  );

  const settledSearches = await Promise.allSettled(
    searchRequests.map(async ({ type, query }) => ({
      type,
      query,
      results: await runTavilySearch(query),
    })),
  );

  const successfulSearches = settledSearches
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (successfulSearches.length === 0) {
    const firstFailure = settledSearches.find(
      (result) => result.status === "rejected",
    );

    throw firstFailure.reason;
  }

  const findSuccessfulSearch = (type) =>
    successfulSearches.find((search) => search.type === type);

  const exactSearch = findSuccessfulSearch("exactSecondHand") ?? null;

  const similarSearch = findSuccessfulSearch("similarSecondHand") ?? null;

  const retailSearch = findSuccessfulSearch("retail") ?? null;

  const exactSecondHandResults = exactSearch?.results ?? [];

  const similarSecondHandResults = similarSearch?.results ?? [];

  const retailResults = retailSearch?.results ?? [];

  return {
    queries: {
      exactSecondHand: exactSearch?.query ?? null,
      similarSecondHand: similarSearch?.query ?? null,
      retail: retailSearch?.query ?? null,
    },

    exactSecondHandResults,
    similarSecondHandResults,
    retailResults,

    sources: createSources([
      exactSecondHandResults,
      similarSecondHandResults,
      retailResults,
    ]),
  };
};
