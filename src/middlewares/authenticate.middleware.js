import createHttpError from "http-errors";
import { getUserBy } from "../services/auth.service.js";
import { verifyAccessToken } from "../utils/jwt.util.js";

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(createHttpError[401]("Unauthorized !"));
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(createHttpError[401]("Unauthorized !!"));
  }
  //verify token
  const payload = await verifyAccessToken(token);
  const foundUser = await getUserBy("id", payload.id);
  if (!foundUser) {
    return next(createHttpError[401]("Unthorized 3"));
  }
  if (!foundUser.isActive) {
    return next(createHttpError(403, "This account is inactive."));
  }
  const { passwordHash, createAt, updatedAt, ...userData } = foundUser;
  req.user = userData;
  next();
};
