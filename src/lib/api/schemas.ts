import { z } from "zod";
import { ShipmentStatus, TripMode } from "@prisma/client";
import { phoneSchema } from "@/lib/validators";

/** Zod schemas for /api/v1 request bodies. Every route validates input here. */

export const createItemSchema = z.object({
  category: z.string().min(1).max(64),
  description: z.string().min(1).max(500),
  declaredWeightKg: z.number().positive().max(100),
  declaredValueEtb: z.number().nonnegative().optional(),
});

export const createShipmentSchema = z.object({
  receiverName: z.string().min(1).max(120),
  receiverPhone: phoneSchema,
  originRegion: z.string().min(1).max(80),
  destinationRegion: z.string().min(1).max(80),
  insuranceOptedIn: z.boolean().default(false),
  idempotencyKey: z.string().uuid().optional(),
  items: z.array(createItemSchema).min(1).max(20),
});
export type CreateShipmentBody = z.infer<typeof createShipmentSchema>;

export const transitionContextSchema = z
  .object({
    hasHandoff: z.boolean().optional(),
    hasVerificationPhoto: z.boolean().optional(),
    acknowledged: z.boolean().optional(),
    sealApplied: z.boolean().optional(),
    adminReviewed: z.boolean().optional(),
    allowPhase2: z.boolean().optional(),
  })
  .optional();

/** Admin/manual transition (RUNBOOK operations). Safety-critical user transitions
 *  get dedicated endpoints later that derive context server-side. */
export const adminTransitionSchema = z.object({
  toStatus: z.nativeEnum(ShipmentStatus),
  expectedVersion: z.number().int().nonnegative(),
  reason: z.string().max(500).optional(),
  context: transitionContextSchema,
});
export type AdminTransitionBody = z.infer<typeof adminTransitionSchema>;

/** Admin escrow release — optimistic lock on the shipment (FINANCE/SUPER_ADMIN). */
export const escrowReleaseSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});
export type EscrowReleaseBody = z.infer<typeof escrowReleaseSchema>;

/** Admin escrow refund — reason is recorded on the audit trail. */
export const escrowRefundSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type EscrowRefundBody = z.infer<typeof escrowRefundSchema>;

export const createTripLegSchema = z.object({
  sequence: z.number().int().positive(),
  originRegion: z.string().min(1).max(80),
  destinationRegion: z.string().min(1).max(80),
  departAt: z.coerce.date(),
  arriveAt: z.coerce.date().optional(),
  totalCapacityKg: z.number().positive().max(100),
});

export const createTripSchema = z.object({
  mode: z.nativeEnum(TripMode),
  legs: z.array(createTripLegSchema).min(1).max(6),
});
export type CreateTripBody = z.infer<typeof createTripSchema>;

export const candidateSearchSchema = z.object({
  originRegion: z.string().min(1),
  destinationRegion: z.string().min(1),
  windowStart: z.coerce.date(),
  windowEnd: z.coerce.date(),
  itemCategory: z.string().min(1),
});

/** Matching query (operator finds travelers for an item on a corridor + window). */
export const matchingQuerySchema = candidateSearchSchema.extend({
  itemWeightKg: z.coerce.number().positive().max(100),
});
export type MatchingQuery = z.infer<typeof matchingQuerySchema>;

/** Parse helper that throws an ApiError-friendly ZodError (mapped by the route). */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}
