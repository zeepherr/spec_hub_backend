import bcrypt from "bcryptjs";
import createHttpError from "http-errors";
import {
  addAttemptsPending,
  cleanExpirePending,
  createAuthSession,
  createUserFromPending,
  findPendingUser,
  findSessionbyRefreshToken,
  getPendingByEmail,
  getUserBy,
  revokeSession,
  savePendingRegistration,
  updatePendingOtp,
} from "../services/auth.service.js";
import { refreshCookieOptions } from "../utils/cookie.util.js";
import {
  hashVailMailDomain,
  sendRegistrationOtp,
} from "../utils/email.util.js";
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
} from "../utils/jwt.util.js";
import {
  generateOtp,
  getOtpCooldownSeconds,
  hashOtp,
} from "../utils/otp.util.js";
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from "../validations/auth.schema.js";
import { getR2PublicUrl } from "../services/r2.storage.service.js";

export const register = async (req, res, next) => {
  const data = registerSchema.parse(req.body);
  const { firstName, lastName, email, password } = data;
  const isMail = await hashVailMailDomain(email);
  if (!isMail) return next(createHttpError(400, "Please enter a valid email."));

  const haveUser = await getUserBy("email", email);
  if (haveUser)
    return next(createHttpError(409, "This user is already exist."));

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 1000ms -> 1s , 60 s -> 1minute
  const passwordHash = await bcrypt.hash(password, 10);
  const pending = await savePendingRegistration({
    email,
    firstName,
    lastName,
    otpHash,
    expiresAt: otpExpires,
    passwordHash,
  });

  const resendAvailableAt = new Date(
    new Date(pending.lastSentAt).getTime() + 60 * 1000,
  );
  await sendRegistrationOtp(email, otp); //send otp by mail

  return res.status(202).json({
    statu: "pending",
    code: "EMAIL_VERIFICATION_REQUIRED",
    email: pending.email,
    expiresAt: pending.expiresAt,
    resendAvailableAt,
  });
};

export const login = async (req, res, next) => {
  const { email, password } = loginSchema.parse(req.body); //validation

  const haveUser = await getUserBy("email", email); //check existing email
  if (!haveUser)
    return next(createHttpError(401, "Invalid username or password"));

  const hashed = await bcrypt.compare(password, haveUser.passwordHash);
  if (!hashed)
    return next(createHttpError(401, "Invalid username or password."));

  const token = await createAccessToken(haveUser);
  const refreshtoken = await createRefreshToken();
  const refreshTokenHash = await hashRefreshToken(refreshtoken);
  await createAuthSession(haveUser, refreshTokenHash);
  let profileImageUrl = null
  if(haveUser.profileImageKey){
    profileImageUrl =getR2PublicUrl(haveUser.profileImageKey)
  }
  res.cookie("refreshToken", refreshtoken, refreshCookieOptions);
  res.status(200).json({
    message: "Login Successful",
    accessToken: token,
    user: {
      id: haveUser.id,
      email: haveUser.email,
      role: haveUser.role,
      profileImageUrl,
    },
  });
};

export const refresh = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken; // get cookie form req
  if (!refreshToken)
    return next(createHttpError(401, "Refresh token is missing"));
  const tokenHash = await hashRefreshToken(refreshToken); //hase received refreshtoken
  const session = await findSessionbyRefreshToken(tokenHash);

  if (!session) return next(createHttpError(401, "Invalid session"));

  if (session.revokedAt) {
    return next(createHttpError(401, "Session has been revoked")); //logout already
  }
  if (session.expiresAt < new Date()) {
    //session exprires more than 7 days
    return next(createHttpError(401, "Session has expired"));
  }
  if (!session.user.isActive) {
    return next(createHttpError(403, "Account is inactive"));
  }
  const accessToken = await createAccessToken(session.user);
  const { passwordHash, isActive, createdAt, updatedAt, ...userData } =
    session.user;
  return res.status(200).json({
    accessToken,
    user: {
      ...userData,
      profileImageUrl: getR2PublicUrl(userData.profileImageKey),
    },
  });
};

export const logout = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    const tokenHash = await hashRefreshToken(refreshToken);
    await revokeSession(tokenHash);
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/v1/auth",
  });
  res.status(200).json({
    message: "Logout Sccessfully",
  });
};
export const getMe = async (req, res, next) => {
  const user = await getUserBy("email", req.user.email);
  let profileImageUrl = null
  if(user.profileImageKey){
    profileImageUrl =getR2PublicUrl(user.profileImageKey)
  }
  res.status(200).json({
    message: "Get user details",
    user: {...user,profileImageUrl},
  });
};

export const verifyEmail = async (req, res, next) => {
  const { email, code } = verifyEmailSchema.parse(req.body);

  const pending = await findPendingUser(email);
  if (!pending)
    return next(createHttpError(404, "No pending registration found!"));

  if (pending.expiresAt < new Date()) {
    //check if the pending has expred
    return next(
      createHttpError(
        400,
        "Verification code has expired.Please request a new code.",
        { code: "VERIFICATION_CODE_EXPIRED" },
      ),
    );
  }
  if (pending.attempts >= 5) {
    //check remaning apptempt
    const error = createHttpError(
      429,
      "Too many incorrect attempts. Please request a new verification code.",
    );
    error.code = "TOO_MANY_VERIFICATION_ATTEMPTS";
    error.attemptsRemaining = 0;
    return next(error);
  }
  const submittedHash = hashOtp(code);
  if (submittedHash !== pending.otpHash) {
    const newAttempt = pending.attempts + 1;
    await addAttemptsPending(pending.id);
    const attemptsRemaining = Math.max(0, 5 - newAttempt);
    if (attemptsRemaining === 0) {
      const error = createHttpError(
        429,
        "Too many incorrect attempts,Please try again later!",
      );
      error.code = "TOO_MANY_VERIFICATION_ATTEMPTS";
      error.attemptsRemaining = 0;
      return next(error);
    }
    const error = createHttpError(
      400,
      "Incorrect verification code .Please try again",
    );
    error.code = "INVALID_VERIFICATION_CODE";
    error.attemptsRemaining = attemptsRemaining;
    return next(error);
  }
  const pendindUser = await createUserFromPending(pending);
  const { passwordHash: pw, createdAt, ...userData } = pendindUser;
  return res.status(201).json({
    message: "Register success.Please Login",
    user: userData,
  });
};

export const resendEmailOtp = async (req, res, next) => {
  const { email } = resendVerificationSchema.parse(req.body);

  await cleanExpirePending(); //clean up the expired pending user

  const pending = await getPendingByEmail(email);
  if (!pending) {
    // if user come with mail not registered yet, return
    return next(
      createHttpError(
        404,
        "Registration has expired or does not exist. Please register again.",
        { code: "PENDING_REGISTRATION_NOT_FOUND" },
      ),
    );
  }

  const retryAfterSecond = getOtpCooldownSeconds(pending.lastSentAt); // second between 60 and 1
  if (retryAfterSecond > 0) {
    const error = createHttpError(
      429,
      `Please wait ${retryAfterSecond} seconds to request another code.`,
    );
    ((error.code = "OTP_RESEND_COOLDOWN"),
      (error.retryAfterSecond = retryAfterSecond));
  }

  const otp = generateOtp(); //get new otp
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); //target 10 minutes

  await updatePendingOtp({ email, otpHash, expiresAt });
  await sendRegistrationOtp(email, otp); //resend to user
  const resendAvailableAt = new Date(Date.now() + 60 * 1000);
  return res.status(200).json({
    success: true,
    code: "VERIFICATION_CODE_RESENT",
    message: "A new verificatioin code has sent to your eamil.",
    expiresAt,
    resendAvailableAt,
  });
};

//                   REGISTER
//                      │
//          Email + Password
//                      ↓
//                     OTP
//                      ↓
//               Verify Email
//                      ↓
//                 Create User
//                      │
//                      │
//           ┌──────────┴──────────┐
//           │                     │
//           ↓                     ↓
//  Email + Password Login    Google Login
//           │                     │
//           │              Verify Google
//           │                     ↓
//           │              Find EXISTING User
//           │                     │
//           └──────────┬──────────┘
//                      ↓
//               createSession()
//                      ↓
//               Access Token
//               Refresh Token
//                      ↓
//                  Dashboard
