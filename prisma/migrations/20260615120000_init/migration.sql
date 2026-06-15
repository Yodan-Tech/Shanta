-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SENDER', 'TRAVELER', 'AGGREGATOR', 'RECEIVER');

-- CreateEnum
CREATE TYPE "TravelerTier" AS ENUM ('CASUAL', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycMethod" AS ENUM ('MANUAL', 'FAYDA');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'AM');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CustomsFrequencyTier" AS ENUM ('NON_FREQUENT', 'FREQUENT');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripMode" AS ENUM ('FLIGHT', 'ROAD', 'BUS', 'OTHER');

-- CreateEnum
CREATE TYPE "TripLegStatus" AS ENUM ('ACTIVE', 'FULL', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HubType" AS ENUM ('ORIGIN', 'TRANSIT', 'DESTINATION');

-- CreateEnum
CREATE TYPE "HubStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RULES_VALIDATED', 'AWAITING_HUB_INTAKE', 'AT_ORIGIN_HUB', 'WEIGHT_DISCREPANCY', 'CONTENTS_VERIFIED', 'SEALED', 'AWAITING_MATCH', 'MATCHED_TO_TRAVELER', 'TRAVELER_REVIEWED', 'TRAVELER_ACCEPTED', 'TRAVELER_REJECTED', 'WITH_TRAVELER', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'AT_TRANSIT_HUB', 'AT_DESTINATION_HUB', 'OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'DELIVERY_CONFIRMED', 'ESCROW_RELEASED', 'COMPLETED', 'CUSTOMS_FLAGGED', 'DISPUTED', 'ON_HOLD', 'DELIVERY_FAILED', 'RETURNED_TO_SENDER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentLegStatus" AS ENUM ('PLANNED', 'MATCHED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "HandoffType" AS ENUM ('SENDER_TO_HUB', 'HUB_TO_TRAVELER', 'TRAVELER_TO_HUB', 'HUB_TO_RECEIVER', 'TRAVELER_TO_RECEIVER');

-- CreateEnum
CREATE TYPE "CaptureMethod" AS ENUM ('LIVE', 'GALLERY');

-- CreateEnum
CREATE TYPE "RestrictionDirection" AS ENUM ('ENTRY', 'EXIT', 'BOTH');

-- CreateEnum
CREATE TYPE "RestrictionCheckTrigger" AS ENUM ('SUBMISSION', 'HUB_INTAKE', 'RE_MATCH');

-- CreateEnum
CREATE TYPE "RestrictionCheckResult" AS ENUM ('PASS', 'FAIL', 'NEEDS_PERMIT', 'NEEDS_DECLARATION');

-- CreateEnum
CREATE TYPE "EscrowHolderType" AS ENUM ('HUB', 'PAYMENT_PROVIDER');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING', 'HELD', 'RELEASE_REQUESTED', 'RELEASED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS', 'KYC_REVIEWER', 'FINANCE');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('AFRICA_TALKING', 'TELE_BIRR', 'INNGEST');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "phone" TEXT,
    "fullName" TEXT,
    "roles" "Role"[] DEFAULT ARRAY['RECEIVER']::"Role"[],
    "travelerTier" "TravelerTier",
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "kycMethod" "KycMethod",
    "kycSubmittedAt" TIMESTAMP(3),
    "kycReviewedAt" TIMESTAMP(3),
    "kycReviewedBy" UUID,
    "idDocumentUrl" TEXT,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'AM',
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tripCountLast30Days" INTEGER NOT NULL DEFAULT 0,
    "tripCountLast90Days" INTEGER NOT NULL DEFAULT 0,
    "tripCountLifetime" INTEGER NOT NULL DEFAULT 0,
    "lastTripAt" TIMESTAMP(3),
    "customsFrequencyTier" "CustomsFrequencyTier" NOT NULL DEFAULT 'NON_FREQUENT',
    "riskFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "travelerId" UUID NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "TripMode" NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_legs" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "originRegion" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "originHubId" UUID,
    "destinationHubId" UUID,
    "departAt" TIMESTAMP(3) NOT NULL,
    "arriveAt" TIMESTAMP(3),
    "totalCapacityKg" DECIMAL(10,3) NOT NULL,
    "availableCapacityKg" DECIMAL(10,3) NOT NULL,
    "status" "TripLegStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hubs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "operatorUserId" UUID NOT NULL,
    "hubTypes" "HubType"[],
    "region" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "geoLat" DECIMAL(9,6),
    "geoLng" DECIMAL(9,6),
    "operatingHours" JSONB,
    "status" "HubStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverPhone" TEXT NOT NULL,
    "receiverUserId" UUID,
    "originRegion" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "pricingSnapshot" JSONB,
    "carrierFeeEtb" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "aggregatorFeeEtb" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "platformFeeEtb" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "insurancePremiumEtb" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "taxAmountEtb" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPriceEtb" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "insuranceOptedIn" BOOLEAN NOT NULL DEFAULT false,
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_legs" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "tripLegId" UUID,
    "originHubId" UUID,
    "destinationHubId" UUID,
    "travelerId" UUID,
    "status" "ShipmentLegStatus" NOT NULL DEFAULT 'PLANNED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "shipmentLegId" UUID,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "declaredWeightKg" DECIMAL(10,3) NOT NULL,
    "actualWeightKg" DECIMAL(10,3),
    "declaredValueEtb" DECIMAL(12,2),
    "sealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoff_records" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "shipmentLegId" UUID,
    "handoffType" "HandoffType" NOT NULL,
    "fromActorId" UUID NOT NULL,
    "toActorId" UUID NOT NULL,
    "photoUrls" TEXT[],
    "videoUrl" TEXT,
    "captureMethod" "CaptureMethod" NOT NULL DEFAULT 'LIVE',
    "acknowledgmentText" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "sealApplied" BOOLEAN NOT NULL DEFAULT false,
    "sealId" TEXT,
    "sealIntact" BOOLEAN,
    "geoLat" DECIMAL(9,6),
    "geoLng" DECIMAL(9,6),
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handoff_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_restrictions" (
    "id" UUID NOT NULL,
    "itemCategory" TEXT NOT NULL,
    "corridorCode" TEXT,
    "corridorOverrideOf" UUID,
    "maxWeightKg" DECIMAL(10,3),
    "maxValueEtb" DECIMAL(12,2),
    "frequencySensitive" BOOLEAN NOT NULL DEFAULT false,
    "maxWeightKgFrequent" DECIMAL(10,3),
    "requiresDeclaration" BOOLEAN NOT NULL DEFAULT false,
    "requiresSpecialPermit" BOOLEAN NOT NULL DEFAULT false,
    "prohibited" BOOLEAN NOT NULL DEFAULT false,
    "direction" "RestrictionDirection" NOT NULL DEFAULT 'BOTH',
    "notes" TEXT,
    "sourceRegulation" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "item_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restriction_checks" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "itemId" UUID,
    "trigger" "RestrictionCheckTrigger" NOT NULL,
    "result" "RestrictionCheckResult" NOT NULL,
    "failedRuleId" UUID,
    "detail" JSONB,
    "travelerFrequencyTier" "CustomsFrequencyTier",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restriction_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_records" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "amountEtb" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "holderType" "EscrowHolderType" NOT NULL DEFAULT 'HUB',
    "holderId" TEXT,
    "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING',
    "releaseCondition" TEXT NOT NULL,
    "heldAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "releasedBy" UUID,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corridor_pricing" (
    "id" UUID NOT NULL,
    "originRegion" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "ratePerKgEtb" DECIMAL(12,2) NOT NULL,
    "minChargeEtb" DECIMAL(12,2) NOT NULL,
    "aggregatorFlatFeeEtb" DECIMAL(12,2) NOT NULL,
    "platformCommissionRate" DECIMAL(5,4) NOT NULL,
    "insuranceRate" DECIMAL(5,4) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corridor_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "recipientPhone" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'AM',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerRef" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_status_history" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "fromStatus" "ShipmentStatus",
    "toStatus" "ShipmentStatus" NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" UUID,
    "handoffRecordId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" UUID NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "operational_notes" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_phone_key" ON "profiles"("phone");

-- CreateIndex
CREATE INDEX "profiles_countryCode_status_idx" ON "profiles"("countryCode", "status");

-- CreateIndex
CREATE INDEX "profiles_kycStatus_idx" ON "profiles"("kycStatus");

-- CreateIndex
CREATE UNIQUE INDEX "travel_profiles_userId_key" ON "travel_profiles"("userId");

-- CreateIndex
CREATE INDEX "travel_profiles_tripCountLast90Days_idx" ON "travel_profiles"("tripCountLast90Days");

-- CreateIndex
CREATE INDEX "travel_profiles_customsFrequencyTier_idx" ON "travel_profiles"("customsFrequencyTier");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "trips_travelerId_idx" ON "trips"("travelerId");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trip_legs_originRegion_destinationRegion_departAt_idx" ON "trip_legs"("originRegion", "destinationRegion", "departAt");

-- CreateIndex
CREATE INDEX "trip_legs_tripId_sequence_idx" ON "trip_legs"("tripId", "sequence");

-- CreateIndex
CREATE INDEX "trip_legs_status_idx" ON "trip_legs"("status");

-- CreateIndex
CREATE INDEX "hubs_region_status_idx" ON "hubs"("region", "status");

-- CreateIndex
CREATE INDEX "hubs_operatorUserId_idx" ON "hubs"("operatorUserId");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_senderId_idx" ON "shipments"("senderId");

-- CreateIndex
CREATE INDEX "shipments_originRegion_destinationRegion_idx" ON "shipments"("originRegion", "destinationRegion");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_senderId_idempotencyKey_key" ON "shipments"("senderId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "shipment_legs_shipmentId_sequence_idx" ON "shipment_legs"("shipmentId", "sequence");

-- CreateIndex
CREATE INDEX "shipment_legs_tripLegId_idx" ON "shipment_legs"("tripLegId");

-- CreateIndex
CREATE INDEX "shipment_legs_travelerId_status_idx" ON "shipment_legs"("travelerId", "status");

-- CreateIndex
CREATE INDEX "items_shipmentId_idx" ON "items"("shipmentId");

-- CreateIndex
CREATE INDEX "items_shipmentLegId_category_idx" ON "items"("shipmentLegId", "category");

-- CreateIndex
CREATE INDEX "handoff_records_shipmentId_idx" ON "handoff_records"("shipmentId");

-- CreateIndex
CREATE INDEX "handoff_records_shipmentLegId_handoffType_idx" ON "handoff_records"("shipmentLegId", "handoffType");

-- CreateIndex
CREATE INDEX "handoff_records_capturedAt_idx" ON "handoff_records"("capturedAt");

-- CreateIndex
CREATE INDEX "item_restrictions_itemCategory_corridorCode_effectiveFrom_idx" ON "item_restrictions"("itemCategory", "corridorCode", "effectiveFrom");

-- CreateIndex
CREATE INDEX "item_restrictions_prohibited_idx" ON "item_restrictions"("prohibited");

-- CreateIndex
CREATE INDEX "restriction_checks_shipmentId_idx" ON "restriction_checks"("shipmentId");

-- CreateIndex
CREATE INDEX "restriction_checks_result_idx" ON "restriction_checks"("result");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_records_shipmentId_key" ON "escrow_records"("shipmentId");

-- CreateIndex
CREATE INDEX "escrow_records_status_idx" ON "escrow_records"("status");

-- CreateIndex
CREATE INDEX "corridor_pricing_originRegion_destinationRegion_effectiveFr_idx" ON "corridor_pricing"("originRegion", "destinationRegion", "effectiveFrom");

-- CreateIndex
CREATE INDEX "notifications_status_channel_idx" ON "notifications"("status", "channel");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "shipment_status_history_shipmentId_createdAt_idx" ON "shipment_status_history"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "webhook_logs_provider_eventId_idx" ON "webhook_logs"("provider", "eventId");

-- CreateIndex
CREATE INDEX "operational_notes_entityType_entityId_idx" ON "operational_notes"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "travel_profiles" ADD CONSTRAINT "travel_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_legs" ADD CONSTRAINT "shipment_legs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_legs" ADD CONSTRAINT "shipment_legs_tripLegId_fkey" FOREIGN KEY ("tripLegId") REFERENCES "trip_legs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_legs" ADD CONSTRAINT "shipment_legs_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_shipmentLegId_fkey" FOREIGN KEY ("shipmentLegId") REFERENCES "shipment_legs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_records" ADD CONSTRAINT "handoff_records_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_records" ADD CONSTRAINT "handoff_records_shipmentLegId_fkey" FOREIGN KEY ("shipmentLegId") REFERENCES "shipment_legs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_records" ADD CONSTRAINT "handoff_records_fromActorId_fkey" FOREIGN KEY ("fromActorId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_records" ADD CONSTRAINT "handoff_records_toActorId_fkey" FOREIGN KEY ("toActorId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_restrictions" ADD CONSTRAINT "item_restrictions_corridorOverrideOf_fkey" FOREIGN KEY ("corridorOverrideOf") REFERENCES "item_restrictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restriction_checks" ADD CONSTRAINT "restriction_checks_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restriction_checks" ADD CONSTRAINT "restriction_checks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restriction_checks" ADD CONSTRAINT "restriction_checks_failedRuleId_fkey" FOREIGN KEY ("failedRuleId") REFERENCES "item_restrictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_records" ADD CONSTRAINT "escrow_records_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "shipment_status_history_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

