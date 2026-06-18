import { ShipmentStatus } from "@prisma/client";
import { DomainError, type Actor } from "./types";

/**
 * Shipment state machine — encodes docs/STATE_MACHINE.md.
 *
 * Pure and data-driven: `TRANSITIONS` is the single source of legality. Guards
 * (verification photo, acknowledgment, seal-after-verification, admin review,
 * Phase-2 gating) are enforced by `assertTransition`. Actor identity is metadata
 * here; authorization (is THIS user allowed) is a service-layer concern.
 */

type S = ShipmentStatus;

export interface TransitionSpec {
  to: S;
  /** Primary actor that drives this transition (informational). */
  actor: Actor;
  requiresHandoff?: boolean;
  requiresVerificationPhoto?: boolean;
  requiresAcknowledgment?: boolean;
  requiresSealApplied?: boolean;
  requiresAdminReview?: boolean;
  /** Phase-2-only transition (Addis customs transit, Constraint 2.3). */
  phase2?: boolean;
}

export interface TransitionContext {
  hasHandoff?: boolean | undefined;
  hasVerificationPhoto?: boolean | undefined;
  acknowledged?: boolean | undefined;
  sealApplied?: boolean | undefined;
  adminReviewed?: boolean | undefined;
  /** Must be explicitly true to use Phase-2 transitions. */
  allowPhase2?: boolean | undefined;
}

/** Terminal states have no outgoing transitions (docs/STATE_MACHINE.md). */
export const TERMINAL_STATES: ReadonlySet<S> = new Set([
  ShipmentStatus.COMPLETED,
  ShipmentStatus.CANCELLED,
]);

// Cross-cutting state sets ----------------------------------------------------

/** Pre-custody states a sender/admin may cancel outright. */
const CANCELLABLE: readonly S[] = [
  ShipmentStatus.DRAFT,
  ShipmentStatus.SUBMITTED,
  ShipmentStatus.RULES_VALIDATED,
  ShipmentStatus.AWAITING_HUB_INTAKE,
  ShipmentStatus.AT_ORIGIN_HUB,
  ShipmentStatus.WEIGHT_DISCREPANCY,
  ShipmentStatus.CONTENTS_VERIFIED,
  ShipmentStatus.SEALED,
  ShipmentStatus.CONSOLIDATED,
  ShipmentStatus.AWAITING_MATCH,
  ShipmentStatus.MATCHED_TO_TRAVELER,
  ShipmentStatus.TRAVELER_REVIEWED,
  ShipmentStatus.TRAVELER_REJECTED,
];

/** Active states an admin/system may pause. */
const HOLDABLE: readonly S[] = [
  ShipmentStatus.AT_ORIGIN_HUB,
  ShipmentStatus.CONTENTS_VERIFIED,
  ShipmentStatus.SEALED,
  ShipmentStatus.CONSOLIDATED,
  ShipmentStatus.AWAITING_MATCH,
  ShipmentStatus.MATCHED_TO_TRAVELER,
  ShipmentStatus.TRAVELER_REVIEWED,
  ShipmentStatus.WITH_TRAVELER,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.AT_TRANSIT_HUB,
  ShipmentStatus.AT_DESTINATION_HUB,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERY_ATTEMPTED,
];

/** States where physical custody exists, so the item can be returned to sender. */
const RETURNABLE: readonly S[] = [
  ShipmentStatus.AT_ORIGIN_HUB,
  ShipmentStatus.WEIGHT_DISCREPANCY,
  ShipmentStatus.CONTENTS_VERIFIED,
  ShipmentStatus.SEALED,
  ShipmentStatus.CONSOLIDATED,
  ShipmentStatus.AWAITING_MATCH,
  ShipmentStatus.MATCHED_TO_TRAVELER,
  ShipmentStatus.TRAVELER_REVIEWED,
  ShipmentStatus.WITH_TRAVELER,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.AT_TRANSIT_HUB,
  ShipmentStatus.AT_DESTINATION_HUB,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERY_FAILED,
  ShipmentStatus.DISPUTED,
  ShipmentStatus.CUSTOMS_FLAGGED,
];

/** Operational states a held shipment may resume into. */
const RESUME_TARGETS: readonly S[] = [
  ShipmentStatus.AT_ORIGIN_HUB,
  ShipmentStatus.AWAITING_MATCH,
  ShipmentStatus.WITH_TRAVELER,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.AT_DESTINATION_HUB,
  ShipmentStatus.OUT_FOR_DELIVERY,
];

// Build the transition map ----------------------------------------------------

function add(map: Map<S, TransitionSpec[]>, from: S, spec: TransitionSpec): void {
  const list = map.get(from) ?? [];
  if (!list.some((s) => s.to === spec.to)) list.push(spec);
  map.set(from, list);
}

function build(): Record<S, TransitionSpec[]> {
  const m = new Map<S, TransitionSpec[]>();
  const E = ShipmentStatus;

  // Forward happy path + documented branches.
  add(m, E.DRAFT, { to: E.SUBMITTED, actor: "SENDER" });
  add(m, E.SUBMITTED, { to: E.RULES_VALIDATED, actor: "SYSTEM" });
  add(m, E.RULES_VALIDATED, { to: E.AWAITING_HUB_INTAKE, actor: "SYSTEM" });
  add(m, E.AWAITING_HUB_INTAKE, {
    to: E.AT_ORIGIN_HUB,
    actor: "AGGREGATOR",
    requiresHandoff: true,
  });
  add(m, E.AT_ORIGIN_HUB, { to: E.WEIGHT_DISCREPANCY, actor: "SYSTEM" });
  add(m, E.WEIGHT_DISCREPANCY, { to: E.AT_ORIGIN_HUB, actor: "SYSTEM" });
  add(m, E.AT_ORIGIN_HUB, {
    to: E.CONTENTS_VERIFIED,
    actor: "AGGREGATOR",
    requiresVerificationPhoto: true,
  });
  add(m, E.CONTENTS_VERIFIED, {
    to: E.SEALED,
    actor: "AGGREGATOR",
    requiresSealApplied: true,
  });
  add(m, E.SEALED, { to: E.AWAITING_MATCH, actor: "SYSTEM" });

  // Aggregation-only service (ADR-0003): the hub consolidates and hands off to the
  // sender's own carrier or the receiver — no platform matching/transit. Gated by
  // Shipment.serviceType at the service layer.
  add(m, E.SEALED, { to: E.CONSOLIDATED, actor: "AGGREGATOR" });
  add(m, E.CONSOLIDATED, {
    to: E.DELIVERED,
    actor: "AGGREGATOR",
    requiresHandoff: true,
  });

  add(m, E.AWAITING_MATCH, { to: E.MATCHED_TO_TRAVELER, actor: "AGGREGATOR" });
  add(m, E.MATCHED_TO_TRAVELER, {
    to: E.TRAVELER_REVIEWED,
    actor: "TRAVELER",
    requiresHandoff: true,
  });
  add(m, E.TRAVELER_REVIEWED, {
    to: E.TRAVELER_ACCEPTED,
    actor: "TRAVELER",
    requiresAcknowledgment: true,
  });
  add(m, E.TRAVELER_REVIEWED, { to: E.TRAVELER_REJECTED, actor: "TRAVELER" });
  add(m, E.TRAVELER_REJECTED, { to: E.AWAITING_MATCH, actor: "SYSTEM" });
  add(m, E.TRAVELER_ACCEPTED, { to: E.WITH_TRAVELER, actor: "TRAVELER" });
  add(m, E.WITH_TRAVELER, { to: E.IN_TRANSIT, actor: "TRAVELER" });

  // Phase 2 — Addis customs transit (Constraint 2.3).
  add(m, E.IN_TRANSIT, { to: E.CUSTOMS_CLEARANCE, actor: "TRAVELER", phase2: true });
  add(m, E.CUSTOMS_CLEARANCE, {
    to: E.AT_TRANSIT_HUB,
    actor: "AGGREGATOR",
    requiresHandoff: true,
    phase2: true,
  });
  add(m, E.CUSTOMS_CLEARANCE, { to: E.CUSTOMS_FLAGGED, actor: "SYSTEM", phase2: true });
  add(m, E.AT_TRANSIT_HUB, { to: E.AWAITING_MATCH, actor: "AGGREGATOR", phase2: true });

  // Delivery.
  add(m, E.IN_TRANSIT, {
    to: E.AT_DESTINATION_HUB,
    actor: "AGGREGATOR",
    requiresHandoff: true,
  });
  add(m, E.IN_TRANSIT, { to: E.DELIVERED, actor: "TRAVELER", requiresHandoff: true });
  add(m, E.AT_DESTINATION_HUB, { to: E.OUT_FOR_DELIVERY, actor: "AGGREGATOR" });
  add(m, E.OUT_FOR_DELIVERY, {
    to: E.DELIVERED,
    actor: "TRAVELER",
    requiresHandoff: true,
  });
  add(m, E.OUT_FOR_DELIVERY, { to: E.DELIVERY_ATTEMPTED, actor: "TRAVELER" });
  add(m, E.DELIVERY_ATTEMPTED, { to: E.OUT_FOR_DELIVERY, actor: "TRAVELER" });
  add(m, E.DELIVERY_ATTEMPTED, { to: E.DELIVERY_FAILED, actor: "SYSTEM" });
  add(m, E.DELIVERY_FAILED, { to: E.RETURNED_TO_SENDER, actor: "AGGREGATOR" });

  // Confirmation, dispute, escrow, completion.
  add(m, E.DELIVERED, {
    to: E.DELIVERY_CONFIRMED,
    actor: "RECEIVER",
    requiresHandoff: true,
  });
  add(m, E.DELIVERED, { to: E.DISPUTED, actor: "RECEIVER" });
  add(m, E.DELIVERY_CONFIRMED, { to: E.ESCROW_RELEASED, actor: "ADMIN" });
  add(m, E.DISPUTED, {
    to: E.ESCROW_RELEASED,
    actor: "ADMIN",
    requiresAdminReview: true,
  });
  add(m, E.DISPUTED, {
    to: E.RETURNED_TO_SENDER,
    actor: "ADMIN",
    requiresAdminReview: true,
  });
  add(m, E.CUSTOMS_FLAGGED, { to: E.DISPUTED, actor: "ADMIN" });
  add(m, E.ESCROW_RELEASED, { to: E.COMPLETED, actor: "SYSTEM" });

  // Cross-cutting: cancel (pre-custody), hold/resume, return-to-sender.
  for (const s of CANCELLABLE) add(m, s, { to: E.CANCELLED, actor: "SENDER" });
  for (const s of HOLDABLE) add(m, s, { to: E.ON_HOLD, actor: "ADMIN" });
  for (const s of RETURNABLE) add(m, s, { to: E.RETURNED_TO_SENDER, actor: "ADMIN" });
  for (const s of RESUME_TARGETS) add(m, E.ON_HOLD, { to: s, actor: "ADMIN" });
  add(m, E.ON_HOLD, { to: E.CANCELLED, actor: "ADMIN" });

  // Fill empty arrays for completeness so the record is total over the enum.
  const out = {} as Record<S, TransitionSpec[]>;
  for (const s of Object.values(ShipmentStatus)) out[s] = m.get(s) ?? [];
  return out;
}

export const TRANSITIONS: Record<S, TransitionSpec[]> = build();

// Public API ------------------------------------------------------------------

export function isTerminal(state: S): boolean {
  return TERMINAL_STATES.has(state);
}

export function getNextStates(from: S): S[] {
  return TRANSITIONS[from].map((s) => s.to);
}

export function getTransition(from: S, to: S): TransitionSpec | undefined {
  return TRANSITIONS[from].find((s) => s.to === to);
}

export function canTransition(from: S, to: S): boolean {
  return getTransition(from, to) !== undefined;
}

/**
 * Validates a transition and its guards. Returns the matched spec, or throws a
 * DomainError. Does NOT check actor authorization (service-layer concern).
 */
export function assertTransition(
  from: S,
  to: S,
  ctx: TransitionContext = {},
): TransitionSpec {
  const spec = getTransition(from, to);
  if (!spec) {
    if (isTerminal(from)) {
      throw new DomainError(
        "TERMINAL_STATE",
        `${from} is terminal and has no outgoing transitions (attempted → ${to}).`,
      );
    }
    throw new DomainError(
      "ILLEGAL_TRANSITION",
      `Illegal transition ${from} → ${to}.`,
    );
  }

  const fail = (msg: string): never => {
    throw new DomainError("GUARD_UNMET", `${from} → ${to}: ${msg}`);
  };

  if (spec.phase2 && !ctx.allowPhase2) {
    fail("Phase-2 transition not enabled in this phase.");
  }
  if (spec.requiresHandoff && !ctx.hasHandoff) {
    fail("a handoff record is required.");
  }
  if (spec.requiresVerificationPhoto && !ctx.hasVerificationPhoto) {
    fail("at least one contents verification photo is required (Constraint 2.2).");
  }
  if (spec.requiresAcknowledgment && !ctx.acknowledged) {
    fail("the traveler acknowledgment is required (Constraint 2.2).");
  }
  if (spec.requiresSealApplied && !ctx.sealApplied) {
    fail("a tamper seal must be applied after verification (Constraint 2.2).");
  }
  if (spec.requiresAdminReview && !ctx.adminReviewed) {
    fail("admin review is required before this transition.");
  }

  return spec;
}
