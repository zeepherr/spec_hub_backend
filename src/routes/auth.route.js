import express from "express";
import {
  getMe,
  login,
  logout,
  refresh,
  register,
} from "../controllers/auth.controller.js";
import {
  resendEmailOtp,
  verifyEmail,
} from "../controllers/auth/email.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/register/veify", verifyEmail);
router.post("/register/resend", resendEmailOtp);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.post("/me", getMe);

export default router;
