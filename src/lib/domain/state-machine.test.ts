import { describe, it, expect } from "vitest";
import { ShipmentStatus as S } from "@prisma/client";
import { DomainError } from "./types";
import {
  assertTransition,
  canTransition,
  getNextStates,
  isTerminal,
  TRANSITIONS,
} from "./state-machine";

describe("state machine — legal transitions", () => {
  it("allows the documented forward happy path", () => {
    expect(canTransition(S.DRAFT, S.SUBMITTED)).toBe(true);
    expect(canTransition(S.SUBMITTED, S.RULES_VALIDATED)).toBe(true);
    expect(canTransition(S.RULES_VALIDATED, S.AWAITING_HUB_INTAKE)).toBe(true);
    expect(canTransition(S.AWAITING_HUB_INTAKE, S.AT_ORIGIN_HUB)).toBe(true);
    expect(canTransition(S.AT_ORIGIN_HUB, S.CONTENTS_VERIFIED)).toBe(true);
    expect(canTransition(S.CONTENTS_VERIFIED, S.SEALED)).toBe(true);
    expect(canTransition(S.SEALED, S.AWAITING_MATCH)).toBe(true);
    expect(canTransition(S.AWAITING_MATCH, S.MATCHED_TO_TRAVELER)).toBe(true);
    expect(canTransition(S.MATCHED_TO_TRAVELER, S.TRAVELER_REVIEWED)).toBe(true);
    expect(canTransition(S.TRAVELER_REVIEWED, S.TRAVELER_ACCEPTED)).toBe(true);
    expect(canTransition(S.TRAVELER_ACCEPTED, S.WITH_TRAVELER)).toBe(true);
    expect(canTransition(S.WITH_TRAVELER, S.IN_TRANSIT)).toBe(true);
    expect(canTransition(S.DELIVERED, S.DELIVERY_CONFIRMED)).toBe(true);
    expect(canTransition(S.DELIVERY_CONFIRMED, S.ESCROW_RELEASED)).toBe(true);
    expect(canTransition(S.ESCROW_RELEASED, S.COMPLETED)).toBe(true);
  });

  it("treats traveler rejection as a normal (re-queue) transition", () => {
    expect(canTransition(S.TRAVELER_REVIEWED, S.TRAVELER_REJECTED)).toBe(true);
    expect(canTransition(S.TRAVELER_REJECTED, S.AWAITING_MATCH)).toBe(true);
  });

  it("supports weight-discrepancy and delivery-attempt branches", () => {
    expect(canTransition(S.AT_ORIGIN_HUB, S.WEIGHT_DISCREPANCY)).toBe(true);
    expect(canTransition(S.WEIGHT_DISCREPANCY, S.AT_ORIGIN_HUB)).toBe(true);
    expect(canTransition(S.OUT_FOR_DELIVERY, S.DELIVERY_ATTEMPTED)).toBe(true);
    expect(canTransition(S.DELIVERY_ATTEMPTED, S.DELIVERY_FAILED)).toBe(true);
    expect(canTransition(S.DELIVERY_FAILED, S.RETURNED_TO_SENDER)).toBe(true);
  });
});

describe("state machine — illegal transitions are rejected", () => {
  const illegal: [S, S][] = [
    [S.DELIVERED, S.SUBMITTED],
    [S.SEALED, S.CONTENTS_VERIFIED], // sealing follows verification, never reverse
    [S.AT_ORIGIN_HUB, S.SEALED], // cannot seal before verification
    [S.MATCHED_TO_TRAVELER, S.WITH_TRAVELER], // must review + accept first
    [S.RULES_VALIDATED, S.DELIVERED],
    [S.DRAFT, S.COMPLETED],
  ];

  it.each(illegal)("rejects %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(DomainError);
  });

  it("terminal states have no outgoing transitions", () => {
    expect(getNextStates(S.COMPLETED)).toHaveLength(0);
    expect(getNextStates(S.CANCELLED)).toHaveLength(0);
    expect(isTerminal(S.COMPLETED)).toBe(true);
    expect(isTerminal(S.CANCELLED)).toBe(true);
    expect(() => assertTransition(S.COMPLETED, S.SUBMITTED)).toThrow(
      /terminal/i,
    );
  });
});

describe("state machine — guards (Constraint 2.2 + admin review)", () => {
  it("verification requires a contents photo", () => {
    expect(() =>
      assertTransition(S.AT_ORIGIN_HUB, S.CONTENTS_VERIFIED, {}),
    ).toThrow(/photo/i);
    expect(
      assertTransition(S.AT_ORIGIN_HUB, S.CONTENTS_VERIFIED, {
        hasVerificationPhoto: true,
      }).to,
    ).toBe(S.CONTENTS_VERIFIED);
  });

  it("sealing requires the seal to be applied (after verification)", () => {
    expect(() => assertTransition(S.CONTENTS_VERIFIED, S.SEALED, {})).toThrow(
      /seal/i,
    );
    expect(
      assertTransition(S.CONTENTS_VERIFIED, S.SEALED, { sealApplied: true }).to,
    ).toBe(S.SEALED);
  });

  it("custody requires the traveler acknowledgment", () => {
    expect(() =>
      assertTransition(S.TRAVELER_REVIEWED, S.TRAVELER_ACCEPTED, {}),
    ).toThrow(/acknowledgment/i);
    expect(
      assertTransition(S.TRAVELER_REVIEWED, S.TRAVELER_ACCEPTED, {
        acknowledged: true,
      }).to,
    ).toBe(S.TRAVELER_ACCEPTED);
  });

  it("disputed → escrow release requires admin review", () => {
    expect(() =>
      assertTransition(S.DISPUTED, S.ESCROW_RELEASED, {}),
    ).toThrow(/admin review/i);
    expect(
      assertTransition(S.DISPUTED, S.ESCROW_RELEASED, { adminReviewed: true })
        .to,
    ).toBe(S.ESCROW_RELEASED);
  });

  it("phase-2 transitions are gated unless explicitly allowed", () => {
    expect(canTransition(S.IN_TRANSIT, S.CUSTOMS_CLEARANCE)).toBe(true);
    expect(() =>
      assertTransition(S.IN_TRANSIT, S.CUSTOMS_CLEARANCE, {}),
    ).toThrow(/phase-2/i);
    expect(
      assertTransition(S.IN_TRANSIT, S.CUSTOMS_CLEARANCE, { allowPhase2: true })
        .to,
    ).toBe(S.CUSTOMS_CLEARANCE);
  });
});

describe("state machine — cross-cutting transitions", () => {
  it("pre-custody states are cancellable; post-custody are not", () => {
    expect(canTransition(S.AWAITING_MATCH, S.CANCELLED)).toBe(true);
    expect(canTransition(S.WITH_TRAVELER, S.CANCELLED)).toBe(false);
  });

  it("custody states can return to sender and be held", () => {
    expect(canTransition(S.WITH_TRAVELER, S.RETURNED_TO_SENDER)).toBe(true);
    expect(canTransition(S.IN_TRANSIT, S.ON_HOLD)).toBe(true);
    expect(canTransition(S.ON_HOLD, S.IN_TRANSIT)).toBe(true);
  });
});

describe("state machine — Flow A (simple domestic) is fully legal", () => {
  it("traces Addis→Hawassa happy path through assertTransition", () => {
    const steps: [S, S, Parameters<typeof assertTransition>[2]?][] = [
      [S.DRAFT, S.SUBMITTED],
      [S.SUBMITTED, S.RULES_VALIDATED],
      [S.RULES_VALIDATED, S.AWAITING_HUB_INTAKE],
      [S.AWAITING_HUB_INTAKE, S.AT_ORIGIN_HUB, { hasHandoff: true }],
      [S.AT_ORIGIN_HUB, S.CONTENTS_VERIFIED, { hasVerificationPhoto: true }],
      [S.CONTENTS_VERIFIED, S.SEALED, { sealApplied: true }],
      [S.SEALED, S.AWAITING_MATCH],
      [S.AWAITING_MATCH, S.MATCHED_TO_TRAVELER],
      [S.MATCHED_TO_TRAVELER, S.TRAVELER_REVIEWED, { hasHandoff: true }],
      [S.TRAVELER_REVIEWED, S.TRAVELER_ACCEPTED, { acknowledged: true }],
      [S.TRAVELER_ACCEPTED, S.WITH_TRAVELER],
      [S.WITH_TRAVELER, S.IN_TRANSIT],
      [S.IN_TRANSIT, S.DELIVERED, { hasHandoff: true }],
      [S.DELIVERED, S.DELIVERY_CONFIRMED, { hasHandoff: true }],
      [S.DELIVERY_CONFIRMED, S.ESCROW_RELEASED],
      [S.ESCROW_RELEASED, S.COMPLETED],
    ];
    for (const [from, to, ctx] of steps) {
      expect(() => assertTransition(from, to, ctx)).not.toThrow();
    }
  });
});

describe("state machine — totality", () => {
  it("every ShipmentStatus has an entry in TRANSITIONS", () => {
    for (const s of Object.values(S)) {
      expect(TRANSITIONS[s]).toBeDefined();
    }
  });
});
