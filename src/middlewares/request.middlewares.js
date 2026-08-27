export const requestMdw = (req, res, next) => {
  console.log(`Request from ${req.path} with method : ${req.method} `);
  next();
};
