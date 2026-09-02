import crypto from "node:crypto";
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
    let profileImageUrl = null;
    if (user.profileImageKey) {
      profileImageUrl = getR2PublicUrl(user.profileImageKey);
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
      // const extension =
      //   path.extname(req.file.originalname).toLowerCase() ||
      //   ".jpg";

      const key =
        `users/${userId}/profile/` +
        `${crypto.randomUUID()}${req.file.detectedType.ext}`;

      const uploadedImage = await uploadToR2({
        buffer: req.file.buffer,
        key,
        contentType: req.file.detectedType.mime,
      });
      newImageKey = uploadedImage.key;
    }
    const finalData = {
      ...updateData,
      ...(newImageKey && { profileImageKey: newImageKey }),
    };

    if (Object.keys(finalData).length === 0) {
      return next(
        createHttpError(400, "ไม่มีข้อมูลสำหรับแก้ไข"),
      );
    }

    // บันทึกฐานข้อมูลหลังจากอัปโหลดรูปใหม่สำเร็จแล้ว
    let updatedUser;

    try {
      updatedUser = await updateProfileByUserId(userId, finalData);
    } catch (updateError) {
      // ถ้าบันทึกฐานข้อมูลไม่สำเร็จ ให้ลบรูปใหม่เพื่อไม่ให้เป็นไฟล์ขยะใน R2
      if (newImageKey) {
        try {
          await deleteFromR2(newImageKey);
        } catch (cleanupError) {
          console.error(
            "Cannot clean up new profile image:",
            cleanupError,
          );
        }
      }

      return next(updateError);
    }

    // เมื่อฐานข้อมูลอัปเดตสำเร็จแล้ว จึงลบรูปโปรไฟล์เก่า
    if (
      newImageKey &&
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
      user: {
        ...updatedUser,
        profileImageUrl: updatedUser.profileImageKey
          ? getR2PublicUrl(updatedUser.profileImageKey)
          : null,
      },
    });
  } catch (error) {
    return next(error);
  }
};
