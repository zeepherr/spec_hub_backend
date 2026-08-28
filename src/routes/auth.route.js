import express from "express";
import {
  getMe,
  login,
  logout,
  refresh,
  register,
  resendEmailOtp,
  verifyEmail,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/register/verify", verifyEmail);
router.post("/register/resend", resendEmailOtp);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.post("/me", getMe);

export default router;
