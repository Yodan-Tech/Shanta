import { describe, it, expect } from "vitest";
import { EscrowStatus } from "@prisma/client";
import { DomainError } from "./types";
import {
  assertEscrowTransition,
  canEscrowTransition,
  ESCROW_TERMINAL,
} from "./escrow";

describe("escrow status machine", () => {
  it("allows the manual-hub-escrow happy path", () => {
    expect(canEscrowTransition(EscrowStatus.PENDING, EscrowStatus.HELD)).toBe(true);
    expect(canEscrowTransition(EscrowStatus.HELD, EscrowStatus.RELEASED)).toBe(true);
    expect(canEscrowTransition(EscrowStatus.HELD, EscrowStatus.REFUNDED)).toBe(true);
    expect(canEscrowTransition(EscrowStatus.PENDING, EscrowStatus.REFUNDED)).toBe(true);
  });

  it("forbids releasing a PENDING escrow — funds must be HELD first", () => {
    expect(canEscrowTransition(EscrowStatus.PENDING, EscrowStatus.RELEASED)).toBe(false);
    expect(() =>
      assertEscrowTransition(EscrowStatus.PENDING, EscrowStatus.RELEASED),
    ).toThrow(DomainError);
  });

  it("treats RELEASED and REFUNDED as terminal (settled)", () => {
    expect(ESCROW_TERMINAL.has(EscrowStatus.RELEASED)).toBe(true);
    expect(ESCROW_TERMINAL.has(EscrowStatus.REFUNDED)).toBe(true);
    expect(() =>
      assertEscrowTransition(EscrowStatus.RELEASED, EscrowStatus.REFUNDED),
    ).toThrow(/settled/);
    expect(() =>
      assertEscrowTransition(EscrowStatus.REFUNDED, EscrowStatus.RELEASED),
    ).toThrow(DomainError);
  });
});
