import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import {
  hasRole,
  needsOnboarding,
  normaliseSelectedRoles,
  SELECTABLE_ROLES,
} from "@/lib/roles";

describe("roles", () => {
  it("hasRole detects membership", () => {
    expect(hasRole([Role.SENDER, Role.RECEIVER], Role.SENDER)).toBe(true);
    expect(hasRole([Role.RECEIVER], Role.TRAVELER)).toBe(false);
  });

  it("needsOnboarding is true when only the implicit RECEIVER role is held", () => {
    expect(needsOnboarding([Role.RECEIVER])).toBe(true);
    expect(needsOnboarding([])).toBe(true);
  });

  it("needsOnboarding is false once an active role is held", () => {
    expect(needsOnboarding([Role.RECEIVER, Role.SENDER])).toBe(false);
    expect(needsOnboarding([Role.AGGREGATOR])).toBe(false);
  });

  it("normaliseSelectedRoles keeps valid roles, drops junk, adds RECEIVER", () => {
    expect(normaliseSelectedRoles(["SENDER", "junk", "TRAVELER"])).toEqual(
      expect.arrayContaining([Role.SENDER, Role.TRAVELER, Role.RECEIVER]),
    );
    // junk is excluded
    expect(normaliseSelectedRoles(["junk"])).toEqual([Role.RECEIVER]);
    // no duplicates
    const out = normaliseSelectedRoles(["SENDER", "SENDER"]);
    expect(out.filter((r) => r === Role.SENDER)).toHaveLength(1);
  });

  it("SELECTABLE_ROLES never includes RECEIVER (it is implicit)", () => {
    expect(SELECTABLE_ROLES).not.toContain(Role.RECEIVER);
  });
});
