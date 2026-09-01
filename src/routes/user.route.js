import express from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { uploadImage } from "../middlewares/upload.middleware.js";
import {  validateOptionalImage } from "../middlewares/validateImage.middleware.js";
import { getMyProfile, updateMyProfile } from "../controllers/user.controller.js";

const profileRouter = express.Router();

profileRouter.get("/me", authenticate, getMyProfile,);

profileRouter.patch("/me", authenticate, uploadImage
    .single("profileImage"), validateOptionalImage, updateMyProfile,);

export default profileRouter;