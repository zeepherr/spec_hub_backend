import { prisma } from "../lib/prisma.js";

export const getUserBy = async (column, value) => {
  return await prisma.user.findUnique({
    where: { [column]: value },
    select: {
      id: true,
      passwordHash: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });
};

export const findUserByGoogleSub = async (googleSub) => {
  return await prisma.user.findUnique({
    where: {
      googleSub,
    },
  });
};

export const setUserGoogleSub = async (userId, googleSub) => {
  return await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      googleSub,
    },
  });
};

export const savePendingRegistration = async (data) => {
  //using upsert if existing user -> update data , if not --> create new
  return prisma.pendingRegistration.upsert({
    where: { email: data.email },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: data.passwordHash,
      otpHash: data.otpHash,
      expiresAt: data.expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    },
    create: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: data.passwordHash,
      otpHash: data.otpHash,
      expiresAt: data.expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    },
  });
};

export const findPendingUser = async (UserEmail) => {
  return await prisma.pendingRegistration.findUnique({
    where: { email: UserEmail },
  });
};

export const addAttemptsPending = async (pendingId) => {
  await prisma.pendingRegistration.update({
    where: { id: pendingId },
    data: {
      attempts: { increment: 1 },
    },
  });
};

export const deletePending = async (pendingId) => {
  await prisma.pendingRegistration.delete({
    where: { id: pendingId },
  });
};

export const createUserFromPending = async (pending) => {
  const user = await prisma.$transaction(async (tx) => {
    const existingUser = await getUserBy("email", pending.email);
    if (existingUser) {
      await deletePending(pending.id);
      throw createHttpError(409, "This email is already registered!");
    }
    const newUser = await createUser({
      data: {
        email: pending.email,
        firstName: pending.firstName,
        lastName: pending.lastName,
        passwordHash: pending.passwordHash,
        isVerified: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
      },
    });
    await deletePending(pending.id);
    return newUser;
  });
  return user;
};

export const cleanExpirePending = async () => {
  const timeOut = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.pendingRegistration.deleteMany({
    where: { updatedAt: { lt: timeOut } },
  });
};

export const getPendingByEmail = async (pendingEmail) => {
  return prisma.pendingRegistration.findUnique({
    where: { email: pendingEmail },
  });
};

export const updatePendingOtp = async (data) => {
  await prisma.pendingRegistration.update({
    where: { email: data.email },
    data: {
      otpHash: data.otpHash,
      expiresAt: data.expiresAt,
      attempts: 0, //restart attempts if new otp
      lastSentAt: new Date(),
    },
  });
};

export const createAuthSession = async (user, refreshToken) => {
  return prisma.authSession.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), //7 days
    },
  });
};

export const findSessionbyRefreshToken = async (refreshToken) => {
  return prisma.authSession.findUnique({
    where: {
      refreshToken,
    },
    include: { user: true },
  });
};

export const revokeSession = async (tokenHash) => {
  await prisma.authSession.updateMany({
    where: { refreshToken: tokenHash, revokedAt: null },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const createUser = async (userDate) => {
  return await prisma.user.create({ data: userDate.data });
};
