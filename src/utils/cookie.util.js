import { config } from "../configs/index.js";
export const refreshCookieOptions = {
  httpOnly: true, //prevent document.cookie
  sameSite: "lax",
  secure: config.node_env === "production",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const clearRefreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.node_env === "production",
  path: "/api/auth",
};
