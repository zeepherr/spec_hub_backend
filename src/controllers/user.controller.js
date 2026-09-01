import crypto from "node:crypto";
import path from "node:path";
import createHttpError from "http-errors";
import {uploadToR2,deleteFromR2, getR2PublicUrl,} from "../services/r2.storage.service.js";

import { getProfileByUserId, updateProfileByUserId } from "../services/user.service.js";
import { updateProfileSchema } from "../validations/user.schema.js";

export const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await getProfileByUserId(userId);

    if (!user) {
      return next(createHttpError(404, "ไม่พบข้อมูลผู้ใช้"));
    }
     let profileImageUrl = null
      if(user.profileImageKey){
        profileImageUrl =getR2PublicUrl(haveUser.profileImageKey)
      }

    return res.status(200).json({
      success: true,
      user:{...user,profileImageUrl},
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  let newImageKey = null;

  try {
    const userId = req.user.id;
    const data = updateProfileSchema.parse(req.body);

    const currentUser = await getProfileByUserId(userId);

    if (!currentUser) {
      return next(createHttpError(404, "ไม่พบข้อมูลผู้ใช้"));
    }

    const updateData = {};

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
    }

    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName;
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone || null;
    }

    if (data.address !== undefined) {
      updateData.address = data.address || null;
    }

    if (req.file) {
      const extension =
        path.extname(req.file.originalname).toLowerCase() ||
        ".jpg";

      newImageKey =
        `users/${userId}/profile/` +
        `${crypto.randomUUID()}${extension}`;

      const uploadedImage = await uploadToR2({
        buffer: req.file.buffer,
        key: newImageKey,
        contentType: req.file.mimetype,
      });

      updateData.profileImageKey = uploadedImage.key;
      updateData.profileImageUrl = uploadedImage.url;
    }

    if (Object.keys(updateData).length === 0) {
      return next(
        createHttpError(400, "ไม่มีข้อมูลสำหรับแก้ไข"),
      );
    }

    const updatedUser = await updateProfileByUserId(userId,updateData,);

    if (
      req.file &&
      currentUser.profileImageKey &&
      currentUser.profileImageKey !==
        updatedUser.profileImageKey
    ) {
      try {
        await deleteFromR2(currentUser.profileImageKey);
      } catch (deleteError) {
        console.error(
          "Cannot delete old profile image:",
          deleteError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "แก้ไขข้อมูลส่วนตัวสำเร็จ",
      user: updatedUser,
    });
  } catch (error) {
    
    if (newImageKey) {
      try {
        await deleteFromR2(newImageKey);
      } catch (deleteError) {
        console.error(
          "Cannot rollback uploaded image:",
          deleteError,
        );
      }
    }

    next(error);
  }
};