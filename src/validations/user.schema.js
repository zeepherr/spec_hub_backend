import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อ")
    .max(50, "ชื่อต้องไม่เกิน 50 ตัวอักษร")
    .optional(),

  lastName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกนามสกุล")
    .max(50, "นามสกุลต้องไม่เกิน 50 ตัวอักษร")
    .optional(),

  phone: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^0[0-9]{8,9}$/, "เบอร์โทรศัพท์ไม่ถูกต้อง"),
    ])
    .optional(),

  address: z
    .string()
    .trim()
    .max(500, "ที่อยู่ต้องไม่เกิน 500 ตัวอักษร")
    .optional(),
});