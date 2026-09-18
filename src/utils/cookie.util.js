import { config } from "../configs/index.js";
const isProduction = config.node_env === "production";
export const refreshCookieOptions = {
  httpOnly: true, //prevent document.cookie
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const clearRefreshCookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  path: "/api/auth",
};
