import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { prisma } from "@/lib/prisma";

const MATCHED_STATUSES = [
  "MATCHED_TO_TRAVELER",
  "TRAVELER_REVIEWED",
  "TRAVELER_ACCEPTED",
  "WITH_TRAVELER",
  "IN_TRANSIT",
  "AT_DESTINATION_HUB",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_CONFIRMED",
  "COMPLETED",
  "ESCROW_RELEASED",
];

/**
 * GET /api/v1/admin/kpis — Phase-1 validation-gate metrics.
 * Constraint 2.1: TravelProfile frequency data is NEVER included.
 */
export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "SUPER_ADMIN");

    const [
      totalShipments,
      matchedShipments,
      completedShipments,
      disputedShipments,
      activeTrips,
      pendingKyc,
      openEscrow,
    ] = await Promise.all([
      prisma.shipment.count({ where: { deletedAt: null } }),
      prisma.shipment.count({
        where: { status: { in: MATCHED_STATUSES as never[] }, deletedAt: null },
      }),
      prisma.shipment.count({
        where: { status: { in: ["COMPLETED", "ESCROW_RELEASED"] }, deletedAt: null },
      }),
      prisma.shipment.count({ where: { status: "DISPUTED", deletedAt: null } }),
      prisma.trip.count({ where: { status: "ACTIVE", deletedAt: null } }),
      prisma.profile.count({ where: { kycStatus: "PENDING_REVIEW", deletedAt: null } }),
      prisma.escrowRecord.count({ where: { status: "HELD" } }),
    ]);

    const matchRate =
      totalShipments > 0
        ? Math.round((matchedShipments / totalShipments) * 100)
        : 0;
    const completionRate =
      totalShipments > 0
        ? Math.round((completedShipments / totalShipments) * 100)
        : 0;

    return ok({
      totalShipments,
      matchedShipments,
      completedShipments,
      disputedShipments,
      activeTrips,
      pendingKyc,
      openEscrow,
      matchRate,
      completionRate,
    });
  });
}
