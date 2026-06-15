import { EscrowStatus } from "@prisma/client";
import { DomainError } from "./types";

/**
 * Escrow status machine — the money-hold lifecycle (docs/DATA_MODEL.md EscrowRecord,
 * OQ-1 manual hub escrow). Pure and data-driven, mirroring the shipment state machine.
 *
 * The legality of an escrow status change lives here; the *business* guards that
 * depend on the shipment (e.g. "release only when DELIVERY_CONFIRMED and not
 * DISPUTED") live in EscrowService, because they need shipment state. Constraint 2.5:
 * escrow holds a logistics fee — it never moves cash for users and never auto-releases.
 */

type ES = EscrowStatus;

const ESCROW_TRANSITIONS: Record<ES, readonly ES[]> = {
  [EscrowStatus.PENDING]: [EscrowStatus.HELD, EscrowStatus.REFUNDED],
  [EscrowStatus.HELD]: [
    EscrowStatus.RELEASE_REQUESTED,
    EscrowStatus.RELEASED,
    EscrowStatus.REFUNDED,
    EscrowStatus.DISPUTED,
  ],
  [EscrowStatus.RELEASE_REQUESTED]: [
    EscrowStatus.RELEASED,
    EscrowStatus.REFUNDED,
    EscrowStatus.DISPUTED,
  ],
  [EscrowStatus.DISPUTED]: [EscrowStatus.RELEASED, EscrowStatus.REFUNDED],
  [EscrowStatus.RELEASED]: [],
  [EscrowStatus.REFUNDED]: [],
};

/** Terminal escrow states — funds have settled and cannot move again. */
export const ESCROW_TERMINAL: ReadonlySet<ES> = new Set([
  EscrowStatus.RELEASED,
  EscrowStatus.REFUNDED,
]);

export function canEscrowTransition(from: ES, to: ES): boolean {
  return ESCROW_TRANSITIONS[from].includes(to);
}

/** Throws a DomainError when an escrow status change is not allowed. */
export function assertEscrowTransition(from: ES, to: ES): void {
  if (canEscrowTransition(from, to)) return;
  if (ESCROW_TERMINAL.has(from)) {
    throw new DomainError(
      "TERMINAL_STATE",
      `Escrow is ${from} (settled); no further status change is allowed (attempted → ${to}).`,
    );
  }
  throw new DomainError(
    "ILLEGAL_TRANSITION",
    `Illegal escrow transition ${from} → ${to}.`,
  );
}
