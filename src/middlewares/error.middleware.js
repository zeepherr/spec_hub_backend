import { MulterError } from "multer";
import { ZodError } from "zod";

export const errorHandler = (err, req, res, next) => {
  // JWT
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      code: "ACCESS_TOKEN_EXPIRED",
      message: "Access token has expired",
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  // Zod
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.length ? issue.path.join(".") : "request",
      message: issue.message,
    }));

    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Validation error",
      errors,
    });
  }

  // Prisma

  //multer
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        code: "IMAGE_TOO_LARGE",
        message: "Image must not exceed 5 MB.",
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        code: "TOO_MANY_IMAGES",
        message: "A listing can have a maximum of 5 images.",
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        code: "UNEXPECTED_FILE_FIELD",
        message: "Unexpected file field.",
      });
    }
  }
  const status = err.status || err.statusCode || 500;

  console.log(`!!!ERROR MDW: status:${status}  & message-->> "${err.message}"`);

  return res.status(status).json({
    success: false,
    ...(err.code && { code: err.code }),
    ...(err.attemptsRemaining !== undefined && {
      attemptsRemaining: err.attemptsRemaining,
    }),
    ...(err.retryAfterSeconds !== undefined && {
      retryAfterSeconds: err.retryAfterSeconds,
    }),
    message: err.message || "Internal server error",
  });
};
