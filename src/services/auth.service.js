import createHttpError from "http-errors";
import { prisma } from "../lib/prisma.js";
import { getOtpCooldownSeconds } from "../utils/otp.util.js";

const OTP_COOLDOWN_MS = 60_000;

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
      profileImageKey: true,
      phone: true,
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

export const savePendingRegistration = async ({ email, ...data }) => {
  try {
    return await prisma.pendingRegistration.create({
      data: {
        email,
        ...data,
        attempts: 0,
        lastSentAt: new Date(),
      },
    });
  } catch (error) {
    // Another pending registration already uses this email.
    if (error.code !== "P2002") {
      throw error;
    }

    return updatePendingWithCooldown(email, data);
  }
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
    const newUser = await createUser(
      {
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
      },
      tx,
    );
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

export const updatePendingOtp = async ({ email, otpHash, expiresAt }) => {
  return updatePendingWithCooldown(email, {
    otpHash,
    expiresAt,
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

export const createUser = async (userDate, db = prisma) => {
  return await db.user.create({ data: userDate.data });
};

const updatePendingWithCooldown = async (email, data) => {
  const now = new Date();

  const [updated] = await prisma.pendingRegistration.updateManyAndReturn({
    where: {
      email,
      lastSentAt: {
        lte: new Date(now.getTime() - OTP_COOLDOWN_MS),
      },
    },
    data: {
      ...data,
      attempts: 0,
      lastSentAt: now,
    },
  });

  if (updated) {
    return updated;
  }

  const pending = await prisma.pendingRegistration.findUnique({
    where: { email },
    select: { lastSentAt: true },
  });

  if (!pending) {
    throw createHttpError(
      404,
      "Registration does not exist. Please register again.",
      { code: "PENDING_REGISTRATION_NOT_FOUND" },
    );
  }

  const retryAfterSeconds = Math.max(
    1,
    getOtpCooldownSeconds(pending.lastSentAt),
  );

  throw createHttpError(
    429,
    `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
    {
      code: "OTP_RESEND_COOLDOWN",
      retryAfterSeconds,
    },
  );
};
