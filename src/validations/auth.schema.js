import { z } from "zod";

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address"),
    firstName: z.string().min(3, "First name is required more than 3 chars!"),
    lastName: z.string().min(3, "Last name is requred more than 3 chars!"),
    password: z.string().min(4, "password required at least 4 characters"),
    role: z
      .literal("MEMBER", {
        error: 'Only "MEMBER" role is allowed during registration',
      })
      .optional(),
  })
  .strict();

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z.string().min(4, "password required at least 4 characters"),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),

  code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});
