import createHttpError from "http-errors";
import { MulterError } from "multer";
import { ZodError } from "zod";

const sendError = (res, status, code, message, extra = {}) => {
  return res.status(status).json({
    success: false,
    ...(code && { code }),
    message,
    ...extra,
  });
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // JWT
  if (err.name === "TokenExpiredError") {
    return sendError(
      res,
      401,
      "ACCESS_TOKEN_EXPIRED",
      "Access token has expired",
    );
  }

  if (err.name === "JsonWebTokenError") {
    return sendError(res, 401, "INVALID_ACCESS_TOKEN", "Invalid token");
  }

  // Zod
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "request",
      message: issue.message,
    }));

    return sendError(res, 400, "VALIDATION_ERROR", "Validation error", {
      errors,
    });
  }

  // Multer
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return sendError(
        res,
        413,
        "IMAGE_TOO_LARGE",
        "Image must not exceed 5 MB.",
      );
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return sendError(
        res,
        400,
        "TOO_MANY_IMAGES",
        "A listing can have a maximum of 5 images.",
      );
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return sendError(
        res,
        400,
        "UNEXPECTED_FILE_FIELD",
        "Unexpected file field.",
      );
    }

    return sendError(
      res,
      400,
      "UPLOAD_ERROR",
      "The file could not be uploaded.",
    );
  }

  /*
   * Only errors created using http-errors are safe to expose.
   * Raw Stripe, Google, Gemini, Prisma and Node errors become 500.
   */
  const isHttpError = createHttpError.isHttpError(err);

  const requestedStatus = Number(err.status ?? err.statusCode);

  const status =
    isHttpError &&
    Number.isInteger(requestedStatus) &&
    requestedStatus >= 400 &&
    requestedStatus <= 599
      ? requestedStatus
      : 500;

  if (err.retryAfterSeconds !== undefined) {
    res.set("Retry-After", String(err.retryAfterSeconds));
  }

  // Server-side logging only.
  console.error("Request failed", {
    method: req.method,
    path: req.originalUrl,
    status,
    name: err.name,
    message: err.message,
    providerRequestId: err.requestId,
    stack: err.stack,
  });

  return sendError(
    res,
    status,
    isHttpError ? err.code : undefined,
    isHttpError ? err.message : "Internal server error",
    {
      ...(isHttpError &&
        err.attemptsRemaining !== undefined && {
          attemptsRemaining: err.attemptsRemaining,
        }),

      ...(isHttpError &&
        err.retryAfterSeconds !== undefined && {
          retryAfterSeconds: err.retryAfterSeconds,
        }),
    },
  );
};
