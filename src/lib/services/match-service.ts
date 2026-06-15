import {
  ShipmentStatus,
  HandoffType,
  CaptureMethod,
  AuditActorType,
  RestrictionDirection,
  type HandoffRecord,
} from "@prisma/client";
import { assertTransition } from "@/lib/domain/state-machine";
import { resolveRule, checkCrowding } from "@/lib/domain/rules-engine";
import { ApiError } from "@/lib/api/errors";
import { EscrowService } from "@/lib/services/escrow-service";
import type {
  Repositories,
  ShipmentWithItems,
  AssignTravelerResult,
  ReleaseMatchResult,
  RecordHandoffResult,
} from "@/lib/db/ports";

type Item = ShipmentWithItems["items"][number];
const weightOf = (it: Item): number =>
  Number(it.actualWeightKg ?? it.declaredWeightKg);

/**
 * MatchService — the traveler-assignment lifecycle (Constraints 2.1 + 2.2).
 * Complements the read-only MatchingService (search/ranking). Every safety check is
 * re-run SERVER-SIDE at assignment (capacity, crowding, KYC/active) and the traveler
 * cannot take custody without the verbatim acknowledgment + an intact seal. Traveler
 * frequency is used only internally for ranking and is NEVER surfaced to a client.
 */
export class MatchService {
  private readonly escrow: EscrowService;
  constructor(private readonly repos: Repositories) {
    this.escrow = new EscrowService(repos);
  }

  /** Aggregator assigns a ranked traveler's trip leg. Re-checks everything server-side. */
  async match(input: {
    shipmentId: string;
    tripLegId: string;
    operatorId: string;
    countryCode: string;
  }): Promise<{ shipment: ShipmentWithItems }> {
    const shipment = await this.requireShipment(input.shipmentId);
    assertTransition(shipment.status, ShipmentStatus.MATCHED_TO_TRAVELER, {});

    const totalWeight = shipment.items.reduce((s, it) => s + weightOf(it), 0);
    const category = dominantCategory(shipment.items);
    const categoryWeight = shipment.items
      .filter((i) => i.category === category)
      .reduce((s, it) => s + weightOf(it), 0);

    const info = await this.repos.match.getTripLegMatchInfo(input.tripLegId, category);
    if (!info) throw ApiError.notFound("Trip leg not found.");
    if (info.legStatus !== "ACTIVE" || info.tripStatus !== "ACTIVE") {
      throw ApiError.unprocessable("Trip leg is not active.");
    }
    if (!info.travelerActive || !info.travelerKycVerified) {
      throw ApiError.unprocessable("Traveler is not active or not KYC-verified.");
    }
    if (info.availableCapacityKg < totalWeight) {
      throw ApiError.unprocessable("Insufficient capacity on the trip leg.");
    }
    const rules = await this.repos.rules.findActive(input.countryCode);
    const rule = resolveRule(category, null, new Date(), rules, RestrictionDirection.BOTH);
    const categoryLimitKg = rule?.maxWeightKg ?? Number.POSITIVE_INFINITY;
    if (!checkCrowding(info.categoryWeightAcceptedKg, categoryWeight, categoryLimitKg)) {
      throw ApiError.unprocessable(
        "Category crowding limit reached for this traveler on this leg.",
      );
    }

    const res = await this.repos.match.assignTraveler({
      shipmentId: shipment.id,
      tripLegId: input.tripLegId,
      travelerId: info.travelerId,
      weightKg: totalWeight,
      expectedVersion: shipment.version,
      toStatus: ShipmentStatus.MATCHED_TO_TRAVELER,
      actorId: input.operatorId,
    });
    // Note: info.tripCountLast90Days is deliberately NOT returned to the client (2.1).
    return { shipment: this.unwrapAssign(res, shipment.version) };
  }

  /** Traveler reviews the verified contents (shown the sealed-parcel evidence). */
  async review(input: {
    shipmentId: string;
    travelerId: string;
  }): Promise<{ handoff: HandoffRecord; shipment: ShipmentWithItems }> {
    const shipment = await this.requireShipment(input.shipmentId);
    assertTransition(shipment.status, ShipmentStatus.TRAVELER_REVIEWED, {
      hasHandoff: true,
    });
    const photoUrls = await this.evidencePhotos(input.shipmentId);
    const res = await this.repos.handoffs.record({
      shipmentId: shipment.id,
      handoffType: HandoffType.HUB_TO_TRAVELER,
      fromActorId: input.travelerId,
      toActorId: input.travelerId,
      photoUrls,
      captureMethod: CaptureMethod.LIVE,
      capturedAt: new Date(),
      expectedVersion: shipment.version,
      toStatus: ShipmentStatus.TRAVELER_REVIEWED,
      actorType: AuditActorType.USER,
      actorId: input.travelerId,
      reason: "traveler reviewed contents",
    });
    return this.unwrapHandoff(res, shipment.version);
  }

  /**
   * Traveler accepts: records the verbatim acknowledgment + an intact-seal check,
   * advances → TRAVELER_ACCEPTED → WITH_TRAVELER, and marks escrow HELD if present.
   */
  async accept(input: {
    shipmentId: string;
    travelerId: string;
    acknowledgmentText: string;
    sealIntact: boolean;
  }): Promise<{ shipment: ShipmentWithItems; escrowHeld: boolean }> {
    const shipment = await this.requireShipment(input.shipmentId);
    if (!input.sealIntact) {
      throw ApiError.unprocessable(
        "Cannot accept: the tamper seal is not intact — raise a dispute instead (Constraint 2.2).",
      );
    }
    if (!input.acknowledgmentText.trim()) {
      throw ApiError.badRequest("The traveler acknowledgment text is required.");
    }
    assertTransition(shipment.status, ShipmentStatus.TRAVELER_ACCEPTED, {
      acknowledged: true,
    });

    const photoUrls = await this.evidencePhotos(input.shipmentId);
    const accepted = this.unwrapHandoff(
      await this.repos.handoffs.record({
        shipmentId: shipment.id,
        handoffType: HandoffType.HUB_TO_TRAVELER,
        fromActorId: input.travelerId,
        toActorId: input.travelerId,
        photoUrls,
        captureMethod: CaptureMethod.LIVE,
        acknowledged: true,
        acknowledgmentText: input.acknowledgmentText,
        sealIntact: true,
        capturedAt: new Date(),
        expectedVersion: shipment.version,
        toStatus: ShipmentStatus.TRAVELER_ACCEPTED,
        actorType: AuditActorType.USER,
        actorId: input.travelerId,
        reason: "traveler accepted custody",
      }),
      shipment.version,
    );

    // Custody transfer → WITH_TRAVELER.
    const custody = await this.systemTransition(
      accepted.shipment,
      ShipmentStatus.WITH_TRAVELER,
      input.travelerId,
      "custody transferred to traveler",
    );
    // Money-hold if (and only if) an escrow exists for this shipment.
    const escrow = await this.escrow.markHeldIfPresent(input.shipmentId, input.travelerId);
    return { shipment: custody, escrowHeld: escrow !== null };
  }

  /** Traveler rejects (a normal outcome): restore capacity and re-queue for matching. */
  async reject(input: {
    shipmentId: string;
    travelerId: string;
    reason?: string;
  }): Promise<{ shipment: ShipmentWithItems }> {
    const shipment = await this.requireShipment(input.shipmentId);
    assertTransition(shipment.status, ShipmentStatus.TRAVELER_REJECTED, {});
    const totalWeight = shipment.items.reduce((s, it) => s + weightOf(it), 0);

    const released = this.unwrapRelease(
      await this.repos.match.releaseMatch({
        shipmentId: shipment.id,
        weightKg: totalWeight,
        expectedVersion: shipment.version,
        toStatus: ShipmentStatus.TRAVELER_REJECTED,
        actorType: AuditActorType.USER,
        actorId: input.travelerId,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
      shipment.version,
    );
    const requeued = await this.systemTransition(
      released,
      ShipmentStatus.AWAITING_MATCH,
      input.travelerId,
      "re-queued after traveler rejection",
    );
    return { shipment: requeued };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async requireShipment(id: string): Promise<ShipmentWithItems> {
    const shipment = await this.repos.shipments.findById(id);
    if (!shipment) throw ApiError.notFound("Shipment not found.");
    return shipment;
  }

  /** The sealed-parcel evidence photos (seal handoff), shown to the traveler. */
  private async evidencePhotos(shipmentId: string): Promise<string[]> {
    const handoffs = await this.repos.handoffs.listByShipment(shipmentId);
    const seal = [...handoffs]
      .reverse()
      .find((h) => h.sealApplied && h.photoUrls.length > 0);
    const photos = seal?.photoUrls ?? [];
    if (photos.length < 1) {
      throw ApiError.unprocessable("No sealed-parcel evidence photos found for this shipment.");
    }
    return photos;
  }

  private async systemTransition(
    shipment: ShipmentWithItems,
    to: ShipmentStatus,
    actorId: string,
    reason: string,
  ): Promise<ShipmentWithItems> {
    assertTransition(shipment.status, to, {});
    const res = await this.repos.shipments.applyTransition({
      shipmentId: shipment.id,
      expectedVersion: shipment.version,
      toStatus: to,
      actorType: AuditActorType.SYSTEM,
      actorId,
      reason,
    });
    if (!res.ok) {
      throw ApiError.conflict("Shipment was modified concurrently; reload and retry.");
    }
    return res.shipment;
  }

  private unwrapAssign(res: AssignTravelerResult, version: number): ShipmentWithItems {
    if (res.ok) return res.shipment;
    switch (res.reason) {
      case "NOT_FOUND":
        throw ApiError.notFound("Shipment or trip leg not found.");
      case "CAPACITY":
        throw ApiError.unprocessable("Insufficient capacity on the trip leg.");
      case "LEG_INACTIVE":
        throw ApiError.unprocessable("Trip leg is not active.");
      default:
        throw ApiError.conflict("Shipment was modified concurrently; reload and retry.", {
          expectedVersion: version,
        });
    }
  }

  private unwrapRelease(res: ReleaseMatchResult, version: number): ShipmentWithItems {
    if (res.ok) return res.shipment;
    if (res.reason === "NOT_FOUND") throw ApiError.notFound("Shipment not found.");
    throw ApiError.conflict("Shipment was modified concurrently; reload and retry.", {
      expectedVersion: version,
    });
  }

  private unwrapHandoff(
    res: RecordHandoffResult,
    version: number,
  ): { handoff: HandoffRecord; shipment: ShipmentWithItems } {
    if (res.ok) return { handoff: res.handoff, shipment: res.shipment };
    if (res.reason === "NOT_FOUND") throw ApiError.notFound("Shipment not found.");
    throw ApiError.conflict("Shipment was modified concurrently; reload and retry.", {
      expectedVersion: version,
    });
  }
}

/** The category carrying the most weight in the shipment (for the crowding check). */
function dominantCategory(items: Item[]): string {
  const byCategory = new Map<string, number>();
  for (const it of items) {
    byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + weightOf(it));
  }
  let best = items[0]?.category ?? "OTHER";
  let bestW = -1;
  for (const [cat, w] of byCategory) {
    if (w > bestW) {
      best = cat;
      bestW = w;
    }
  }
  return best;
}
