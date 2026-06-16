import {
  ShipmentStatus,
  EscrowStatus,
  EscrowHolderType,
  AuditActorType,
  type EscrowRecord,
} from "@prisma/client";
import { assertTransition } from "@/lib/domain/state-machine";
import { assertEscrowTransition } from "@/lib/domain/escrow";
import { ApiError } from "@/lib/api/errors";
import type { NotificationSpec } from "@/lib/domain/notifications";
import type {
  Repositories,
  ShipmentWithItems,
  ApplyEscrowChangeResult,
  ArmEscrowResult,
} from "@/lib/db/ports";

/** Phase-1 manual-hub-escrow release condition (OQ-1). */
export const RELEASE_CONDITION =
  "Receiver delivery confirmation received and no open dispute.";

export interface EscrowChangeResult {
  escrow: EscrowRecord;
  shipment: ShipmentWithItems;
}

/**
 * EscrowService — the money-hold lifecycle for manual hub escrow (OQ-1, Constraint
 * 2.5: holds a logistics fee, never moves users' cash, never auto-releases on a
 * dispute). Orchestrates the pure escrow + shipment state machines over the ports;
 * every fund-moving change is atomic with its shipment transition.
 */
export class EscrowService {
  constructor(private readonly repos: Repositories) {}

  /**
   * Arm escrow when a shipment is created: open a PENDING hold for the quoted price
   * and advance RULES_VALIDATED → AWAITING_HUB_INTAKE in one transaction.
   */
  async armForShipment(
    shipment: ShipmentWithItems,
    notifications?: NotificationSpec[],
  ): Promise<EscrowChangeResult> {
    assertTransition(shipment.status, ShipmentStatus.AWAITING_HUB_INTAKE, {});
    const result = await this.repos.escrows.armShipment({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      amountEtb: Number(shipment.totalPriceEtb),
      holderType: EscrowHolderType.HUB,
      releaseCondition: RELEASE_CONDITION,
      toStatus: ShipmentStatus.AWAITING_HUB_INTAKE,
      actorType: AuditActorType.SYSTEM,
      ...(notifications ? { notifications } : {}),
    });
    return this.unwrapArm(result);
  }

  async getForShipment(shipmentId: string): Promise<EscrowRecord> {
    const escrow = await this.repos.escrows.findByShipmentId(shipmentId);
    if (!escrow) throw ApiError.notFound("Escrow record not found.");
    return escrow;
  }

  /**
   * Mark the held funds HELD when custody transfers to the traveler. Called by the
   * traveler-accept flow (Milestone 6); kept here so the money lifecycle is one unit.
   */
  async markHeld(shipmentId: string, actorId?: string): Promise<EscrowRecord> {
    const escrow = await this.getForShipment(shipmentId);
    assertEscrowTransition(escrow.status, EscrowStatus.HELD);
    const result = await this.repos.escrows.applyChange({
      shipmentId,
      escrowToStatus: EscrowStatus.HELD,
      actorType: AuditActorType.SYSTEM,
      ...(actorId ? { actorId } : {}),
    });
    return this.unwrapChange(result).escrow;
  }

  /**
   * Mark HELD on custody transfer ONLY if this shipment has an escrow — escrow is
   * optional (it can't always be provided), so a shipment without one simply has no
   * money-hold step. Returns null when there is no escrow.
   */
  async markHeldIfPresent(
    shipmentId: string,
    actorId?: string,
  ): Promise<EscrowRecord | null> {
    const escrow = await this.repos.escrows.findByShipmentId(shipmentId);
    if (!escrow) return null;
    return this.markHeld(shipmentId, actorId);
  }

  /**
   * Admin release. Allowed ONLY when the shipment is DELIVERY_CONFIRMED (so never on
   * a DISPUTED shipment) and the escrow is HELD. Pairs RELEASED with the shipment's
   * DELIVERY_CONFIRMED → ESCROW_RELEASED transition atomically.
   */
  async release(input: {
    shipmentId: string;
    expectedVersion: number;
    adminId: string;
  }): Promise<EscrowChangeResult> {
    const shipment = await this.requireShipment(input.shipmentId);
    const escrow = await this.getForShipment(input.shipmentId);

    if (escrow.status !== EscrowStatus.HELD) {
      throw ApiError.unprocessable(
        `Escrow must be HELD to release (currently ${escrow.status}).`,
      );
    }
    if (shipment.status !== ShipmentStatus.DELIVERY_CONFIRMED) {
      throw ApiError.unprocessable(
        `Escrow can only be released after delivery is confirmed (shipment is ${shipment.status}).`,
      );
    }

    assertEscrowTransition(escrow.status, EscrowStatus.RELEASED);
    assertTransition(shipment.status, ShipmentStatus.ESCROW_RELEASED, {});

    const result = await this.repos.escrows.applyChange({
      shipmentId: input.shipmentId,
      escrowToStatus: EscrowStatus.RELEASED,
      shipmentToStatus: ShipmentStatus.ESCROW_RELEASED,
      expectedVersion: input.expectedVersion,
      actorType: AuditActorType.ADMIN,
      actorId: input.adminId,
      releasedBy: input.adminId,
      reason: "escrow released",
    });
    return this.unwrapChange(result, shipment.version);
  }

  /**
   * Admin refund of a non-settled hold (sender cancellation, return, or a dispute
   * resolved in the sender's favour). Changes only the escrow; the admin routes the
   * shipment to its terminal/return state via the transition endpoint, because the
   * correct shipment outcome (CANCELLED vs RETURNED_TO_SENDER) is context-dependent.
   */
  async refund(input: {
    shipmentId: string;
    adminId: string;
    reason?: string;
  }): Promise<EscrowRecord> {
    await this.requireShipment(input.shipmentId);
    const escrow = await this.getForShipment(input.shipmentId);
    assertEscrowTransition(escrow.status, EscrowStatus.REFUNDED);

    const result = await this.repos.escrows.applyChange({
      shipmentId: input.shipmentId,
      escrowToStatus: EscrowStatus.REFUNDED,
      actorType: AuditActorType.ADMIN,
      actorId: input.adminId,
      reason: input.reason ?? "escrow refunded",
    });
    return this.unwrapChange(result).escrow;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async requireShipment(id: string): Promise<ShipmentWithItems> {
    const shipment = await this.repos.shipments.findById(id);
    if (!shipment) throw ApiError.notFound("Shipment not found.");
    return shipment;
  }

  private unwrapArm(result: ArmEscrowResult): EscrowChangeResult {
    if (result.ok) return { escrow: result.escrow, shipment: result.shipment };
    if (result.reason === "NOT_FOUND") throw ApiError.notFound("Shipment not found.");
    if (result.reason === "ALREADY_EXISTS") {
      throw ApiError.conflict("Escrow already exists for this shipment.");
    }
    throw ApiError.conflict(
      "Shipment was modified concurrently; reload and retry.",
    );
  }

  private unwrapChange(
    result: ApplyEscrowChangeResult,
    currentVersion?: number,
  ): EscrowChangeResult {
    if (result.ok) return { escrow: result.escrow, shipment: result.shipment };
    if (result.reason === "NOT_FOUND") {
      throw ApiError.notFound("Escrow record not found.");
    }
    throw ApiError.conflict(
      "Shipment was modified concurrently; reload and retry.",
      currentVersion !== undefined ? { currentVersion } : undefined,
    );
  }
}
