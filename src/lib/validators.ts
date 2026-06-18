import { z } from "zod";

/** E.164 phone number, e.g. +251911223344. */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Invalid phone number");

export function isValidPhone(value: string): boolean {
  return phoneSchema.safeParse(value).success;
}

/** Email — login channel for diaspora/abroad users (email-OTP). */
export const emailSchema = z.string().email("Invalid email");

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

/** Telegram numeric user id (as string). */
export const telegramIdSchema = z.string().regex(/^\d{5,20}$/, "Invalid Telegram id");

/** 6-digit numeric OTP. */
export const otpSchema = z.string().regex(/^\d{6}$/, "Invalid code");
