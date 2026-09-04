import createHttpError from "http-errors";

const createProviderError = ({
  status,
  code,
  message,
  cause,
  retryAfterSeconds,
}) => {
  const error = createHttpError(status, message);

  error.code = code;
  error.cause = cause;

  if (retryAfterSeconds !== undefined) {
    error.retryAfterSeconds = retryAfterSeconds;
  }

  return error;
};

const networkErrorCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

// Stripe
export const normalizeStripeError = (error) => {
  switch (error?.type) {
    case "StripeCardError":
      return createProviderError({
        status: 402,
        code: "PAYMENT_FAILED",
        message: "Payment was declined. Please use another payment method.",
        cause: error,
      });

    case "StripeRateLimitError":
      return createProviderError({
        status: 503,
        code: "PAYMENT_SERVICE_BUSY",
        message: "The payment service is temporarily busy. Please try again.",
        cause: error,
        retryAfterSeconds: 30,
      });

    case "StripeAPIConnectionError":
    case "StripeAPIError":
      return createProviderError({
        status: 503,
        code: "PAYMENT_SERVICE_UNAVAILABLE",
        message: "The payment service is temporarily unavailable.",
        cause: error,
        retryAfterSeconds: 30,
      });

    case "StripeAuthenticationError":
    case "StripePermissionError":
      return createProviderError({
        status: 503,
        code: "PAYMENT_CONFIGURATION_ERROR",
        message: "The payment service is temporarily unavailable.",
        cause: error,
      });

    case "StripeSignatureVerificationError":
      return createProviderError({
        status: 400,
        code: "INVALID_STRIPE_SIGNATURE",
        message: "Invalid Stripe webhook signature.",
        cause: error,
      });

    case "StripeInvalidRequestError":
    case "StripeIdempotencyError":
      return createProviderError({
        status: 502,
        code: "PAYMENT_PROVIDER_ERROR",
        message: "The payment request could not be processed.",
        cause: error,
      });

    default:
      return createProviderError({
        status: 502,
        code: "PAYMENT_PROVIDER_ERROR",
        message: "The payment request could not be processed.",
        cause: error,
      });
  }
};

// Gemini
export const normalizeGeminiError = (error) => {
  const providerStatus = Number(
    error?.status ?? error?.statusCode ?? error?.response?.status,
  );

  if (providerStatus === 400) {
    return createProviderError({
      status: 422,
      code: "AI_INPUT_REJECTED",
      message: "The AI service could not process the provided input.",
      cause: error,
    });
  }

  if (
    providerStatus === 401 ||
    providerStatus === 403 ||
    providerStatus === 404
  ) {
    // Usually an API key, permission, project, or model problem.
    return createProviderError({
      status: 503,
      code: "AI_CONFIGURATION_ERROR",
      message: "The AI service is currently unavailable.",
      cause: error,
    });
  }

  if (providerStatus === 429) {
    return createProviderError({
      status: 429,
      code: "AI_RATE_LIMITED",
      message: "The AI service is busy. Please try again shortly.",
      cause: error,
      retryAfterSeconds: 30,
    });
  }

  if (
    providerStatus === 408 ||
    providerStatus === 500 ||
    providerStatus === 502 ||
    providerStatus === 503 ||
    providerStatus === 504 ||
    networkErrorCodes.has(error?.code)
  ) {
    return createProviderError({
      status: 503,
      code: "AI_SERVICE_UNAVAILABLE",
      message: "The AI service is temporarily unavailable.",
      cause: error,
      retryAfterSeconds: 30,
    });
  }

  return createProviderError({
    status: 502,
    code: "AI_PROVIDER_ERROR",
    message: "The AI request could not be completed.",
    cause: error,
  });
};

// Google Sign-In
export const normalizeGoogleAuthError = (error) => {
  const providerStatus = Number(
    error?.status ?? error?.statusCode ?? error?.response?.status,
  );

  const providerUnavailable =
    providerStatus === 429 ||
    providerStatus >= 500 ||
    networkErrorCodes.has(error?.code);

  if (providerUnavailable) {
    return createProviderError({
      status: 503,
      code: "GOOGLE_AUTH_UNAVAILABLE",
      message: "Google authentication is temporarily unavailable.",
      cause: error,
      retryAfterSeconds: 30,
    });
  }

  return createProviderError({
    status: 401,
    code: "INVALID_GOOGLE_CREDENTIAL",
    message: "The Google credential is invalid or expired.",
    cause: error,
  });
};
