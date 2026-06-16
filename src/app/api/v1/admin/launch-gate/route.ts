import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/admin/launch-gate — Phase-1 go/no-go gate metrics.
 * Returns the key indicators with a pass/fail for each gate.
 * The admin can see at a glance whether the pilot corridor is ready to open.
 */
export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "SUPER_ADMIN");

    const [
      verifiedTravelers,
      activeTrips,
      completedShipments,
      disputedShipments,
      pendingKyc,
      corridors,
    ] = await Promise.all([
      prisma.profile.count({
        where: { kycStatus: "VERIFIED", roles: { has: "TRAVELER" }, deletedAt: null },
      }),
      prisma.trip.count({ where: { status: "ACTIVE", deletedAt: null } }),
      prisma.shipment.count({
        where: { status: { in: ["COMPLETED", "ESCROW_RELEASED", "DELIVERY_CONFIRMED"] } },
      }),
      prisma.shipment.count({ where: { status: "DISPUTED" } }),
      prisma.profile.count({ where: { kycStatus: "PENDING_REVIEW", deletedAt: null } }),
      prisma.corridorPricing.count({
        where: {
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date() } }],
        },
      }),
    ]);

    const gates = [
      {
        name: "KYC-verified travelers",
        value: verifiedTravelers,
        target: 5,
        pass: verifiedTravelers >= 5,
        note: "Need ≥ 5 verified travelers with active trips on corridor",
      },
      {
        name: "Active trips",
        value: activeTrips,
        target: 5,
        pass: activeTrips >= 5,
        note: "Traveler supply depth",
      },
      {
        name: "End-to-end completed shipments",
        value: completedShipments,
        target: 1,
        pass: completedShipments >= 1,
        note: "At least one full flow verified end-to-end",
      },
      {
        name: "Open disputes",
        value: disputedShipments,
        target: 0,
        pass: disputedShipments === 0,
        note: "Zero trust incidents at launch",
      },
      {
        name: "Active corridor prices",
        value: corridors,
        target: 1,
        pass: corridors >= 1,
        note: "At least one corridor seeded with pricing",
      },
    ];

    const allPass = gates.every((g) => g.pass);

    return ok({
      verdict: allPass ? "GO" : "NO_GO",
      allPass,
      gates,
      pendingKyc,
      openQuestions: {
        OQ_3_customs_reg: "UNRESOLVED — required before adjusting prohibition rules",
        OQ_5_pilot_corridor: "MUST be confirmed by founder before launch",
        OQ_10_sms_provider: "REQUIRED for OTP and delivery confirmation",
      },
    });
  });
}
