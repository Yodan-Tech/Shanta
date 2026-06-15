import { z } from "zod";

/** E.164 phone number, e.g. +251911223344. */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Invalid phone number");

export function isValidPhone(value: string): boolean {
  return phoneSchema.safeParse(value).success;
}

/** 6-digit numeric OTP. */
export const otpSchema = z.string().regex(/^\d{6}$/, "Invalid code");
