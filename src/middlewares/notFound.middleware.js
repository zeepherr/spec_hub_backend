import createHttpError from "http-errors";

export const notFound = (req, res, next) => {
  return next(createHttpError(400, "This path is not found"));
};
