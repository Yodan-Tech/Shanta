import { describe, it, expect, beforeEach } from "vitest";
import { TripMode } from "@prisma/client";
import type { PricingRule } from "@/lib/domain/types";
import { makeInMemoryRepositories } from "@/lib/db/memory";
import { TripService } from "./trip-service";

const PRICING: PricingRule = {
  ratePerKgEtb: 120, minChargeEtb: 200, aggregatorFlatFeeEtb: 50,
  platformCommissionRate: 0.15, insuranceRate: 0.02, taxRate: 0,
};

const TRAVELER_ID = "traveler-uuid-1";
const ADMIN_ID = "admin-uuid-1";
const TRIP_INPUT = {
  travelerId: TRAVELER_ID,
  mode: TripMode.FLIGHT,
  countryCode: "ET",
  legs: [{
    sequence: 1,
    originRegion: "Addis Ababa",
    destinationRegion: "Hawassa",
    departAt: new Date("2026-07-01T08:00:00Z"),
    totalCapacityKg: 20,
  }],
};

let repos: ReturnType<typeof makeInMemoryRepositories>;
let tripSvc: TripService;

beforeEach(() => {
  repos = makeInMemoryRepositories({ pricing: PRICING });
  tripSvc = new TripService(repos);
});

describe("KYC gate — TripService.create", () => {
  it("blocks an UNVERIFIED traveler from creating a trip", async () => {
    repos.kyc.seed(TRAVELER_ID, { kycStatus: "UNVERIFIED" });
    await expect(tripSvc.create(TRIP_INPUT)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks a PENDING_REVIEW traveler from creating a trip", async () => {
    repos.kyc.seed(TRAVELER_ID, { kycStatus: "PENDING_REVIEW" });
    await expect(tripSvc.create(TRIP_INPUT)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks a REJECTED traveler from creating a trip", async () => {
    repos.kyc.seed(TRAVELER_ID, { kycStatus: "REJECTED" });
    await expect(tripSvc.create(TRIP_INPUT)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a VERIFIED traveler to create a trip", async () => {
    repos.kyc.seed(TRAVELER_ID, { kycStatus: "VERIFIED" });
    const trip = await tripSvc.create(TRIP_INPUT);
    expect(trip.travelerId).toBe(TRAVELER_ID);
    expect(trip.legs).toHaveLength(1);
  });

  it("blocks a traveler with no KYC record (null status)", async () => {
    // No seed — getStatus returns null
    await expect(tripSvc.create(TRIP_INPUT)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("KYC repository — approve / reject audit trail", () => {
  it("approve sets status to VERIFIED and writes audit log", async () => {
    repos.kyc.seed(TRAVELER_ID, { kycStatus: "PENDING_REVIEW" });
    await repos.kyc.approve({ userId: TRAVELER_ID, reviewedBy: ADMIN_ID });

    const status = await repos.kyc.getStatus(TRAVELER_ID);
    expect(status).toBe("VERIFIED");

    const approveEntry = repos.kyc.auditLog.find(
      (e) => e.action === "kyc.approve" && e.userId === TRAVELER_ID,
    );
    expect(approveEntry).toBeDefined();
    expect(approveEntry!.actorId).toBe(ADMIN_ID);
  });

  it("reject sets status to REJECTED and records reason in audit log", async () => {
    repos.kyc.seed(TRAVELER_ID, { kycStatus: "PENDING_REVIEW" });
    await repos.kyc.reject({
      userId: TRAVELER_ID,
      reviewedBy: ADMIN_ID,
      reason: "ID document is unreadable",
    });

    const status = await repos.kyc.getStatus(TRAVELER_ID);
    expect(status).toBe("REJECTED");

    const rejectEntry = repos.kyc.auditLog.find(
      (e) => e.action === "kyc.reject" && e.userId === TRAVELER_ID,
    );
    expect(rejectEntry).toBeDefined();
    expect(rejectEntry!.detail).toBe("ID document is unreadable");
  });

  it("listPending only returns PENDING_REVIEW profiles", async () => {
    repos.kyc.seed("u1", { kycStatus: "PENDING_REVIEW" });
    repos.kyc.seed("u2", { kycStatus: "VERIFIED" });
    repos.kyc.seed("u3", { kycStatus: "PENDING_REVIEW" });

    const queue = await repos.kyc.listPending(10);
    expect(queue).toHaveLength(2);
    expect(queue.every((q) => q.kycStatus === "PENDING_REVIEW")).toBe(true);
  });
});
