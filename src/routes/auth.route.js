import express from "express";
import {
  getMe,
  googleLogin,
  login,
  logout,
  refresh,
  register,
  resendEmailOtp,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { otpRequestLimiter } from "../middlewares/otpRateLimit.middleware.js";

const router = express.Router();

router.post("/register", otpRequestLimiter, register);
router.post("/register/verify", verifyEmail);
router.post("/register/resend", otpRequestLimiter, resendEmailOtp);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/me", getMe);

export default router;
