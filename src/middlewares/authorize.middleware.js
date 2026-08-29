import createHttpError from "http-errors";
export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createHttpError(401, "Authentication Requires!"));
    }
    if (!roles.includes(req.user.role)) {
      return next(createHttpError(403, "Access Denined"));
    }
    next();
  };
};
