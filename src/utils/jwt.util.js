import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { config } from "../configs/index.js";

export const createAccessToken = async (user) => {
  const payload = { id: user.id, role: user.role };
  const token = jwt.sign(payload, config.jwt_secret, {
    algorithm: "HS256",
    expiresIn: "15m",
  });
  return token;
};

//verifyToken
export const verifyAccessToken = async (token) => {
  return jwt.verify(token, config.jwt_secret, {
    algorithms: ["HS256"],
  });
};

//refreshtoken

export const createRefreshToken = async () => {
  return crypto.randomBytes(64).toString("hex"); //1byte => 8 bit , this is => 512 bit , and (unread) hex to readable text
};

export const hashRefreshToken = async (token) => {
  return crypto.createHash("sha256").update(token).digest("hex"); //this can not be encrypted mean can not be turn to "original"
};

export const generateSku = (name) => {
  const prefix = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);

  const random = Math.floor(1000 + Math.random() * 9000);

  return `${prefix}-${random}`;
};
