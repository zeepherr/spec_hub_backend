import crypto from "node:crypto";
import { config } from "../configs/index.js";

export const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString(); // random(6 digital number)
};
export const hashOtp = (otp) => {
  return crypto
    .createHmac("sha256", config.otp_secret)
    .update(otp)
    .digest("hex");
};

export const getOtpCooldownSeconds = (lastSentAt) => {
  const elapsed = Date.now() - new Date(lastSentAt).getTime();
  const remaining = 60 * 1000 - elapsed;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / 1000);
};
