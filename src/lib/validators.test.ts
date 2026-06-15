import { describe, it, expect } from "vitest";
import { isValidPhone, otpSchema } from "@/lib/validators";

describe("phone validation (E.164)", () => {
  it("accepts valid Ethiopian + international numbers", () => {
    expect(isValidPhone("+251911223344")).toBe(true);
    expect(isValidPhone("+14155552671")).toBe(true);
  });

  it("rejects malformed numbers", () => {
    expect(isValidPhone("0911223344")).toBe(false); // no country code
    expect(isValidPhone("+0911223344")).toBe(false); // leading 0 after +
    expect(isValidPhone("+1")).toBe(false); // too short
    expect(isValidPhone("not-a-phone")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("otp validation", () => {
  it("accepts exactly 6 digits", () => {
    expect(otpSchema.safeParse("123456").success).toBe(true);
  });
  it("rejects non-6-digit codes", () => {
    expect(otpSchema.safeParse("12345").success).toBe(false);
    expect(otpSchema.safeParse("1234567").success).toBe(false);
    expect(otpSchema.safeParse("12a456").success).toBe(false);
  });
});
