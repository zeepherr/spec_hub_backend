import { prisma } from "../lib/prisma.js";

const profileSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  address: true,
  profileImageKey: true,
  role: true,
  isVerified: true,
  createdAt: true,
};

export const getProfileByUserId = async (userId) => {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: profileSelect,
  });
};

export const updateProfileByUserId = async (
  userId,
  updateData,
) => {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: updateData,
    select: profileSelect,
  });
};