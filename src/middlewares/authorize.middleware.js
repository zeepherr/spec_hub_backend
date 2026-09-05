import createHttpError from "http-errors";
import { getUserBy } from "../services/auth.service.js";
export const allowRoles = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(createHttpError(401, "Authentication Requires!"));
    }
    if (req.user) {
      const user = await getUserBy("id", req.user.id);
      if (!roles.includes(user.role))
        return next(createHttpError(403, "Access Denined"));
    }
    next();
  };
};
