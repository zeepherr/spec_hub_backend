import { rateLimit } from "express-rate-limit";

export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    code: "OTP_REQUEST_LIMIT",
    message: "Too many OTP requests. Please try again later.",
  },
});
