-- M16–M20: multi-channel auth, customs intelligence, routes/aggregation-only,
-- airport agents, and data-intelligence capture. All changes are additive.

-- ── Enums (new) ───────────────────────────────────────────────────────────────
CREATE TYPE "ServiceType" AS ENUM ('FULL', 'AGGREGATION_ONLY');
CREATE TYPE "DemandSignalSource" AS ENUM ('SEARCH', 'NO_MATCH', 'BOT_QUERY');
CREATE TYPE "CustomsOutcome" AS ENUM ('CLEARED', 'FLAGGED', 'TAXED', 'SEIZED');

-- ── Enums (new values; not used elsewhere in this migration → safe in one tx) ──
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AIRPORT_AGENT';
ALTER TYPE "HubType" ADD VALUE IF NOT EXISTS 'AGENT';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'CONSOLIDATED';
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'TELEGRAM';

-- ── Profile: email + Telegram identity (M16) ─────────────────────────────────
ALTER TABLE "profiles"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "telegramUserId" TEXT,
  ADD COLUMN "telegramUsername" TEXT,
  ADD COLUMN "telegramLinkedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");
CREATE UNIQUE INDEX "profiles_telegramUserId_key" ON "profiles"("telegramUserId");

-- ── ItemRestriction: per-person unit cap + duty transparency (M18) ───────────
ALTER TABLE "item_restrictions"
  ADD COLUMN "maxUnitsPerTraveler" INTEGER,
  ADD COLUMN "dutyApplies" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dutyNote" TEXT;

-- ── Item: per-line quantity for unit caps (M18) ──────────────────────────────
ALTER TABLE "items" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- ── Shipment: service type (M19) ─────────────────────────────────────────────
ALTER TABLE "shipments"
  ADD COLUMN "serviceType" "ServiceType" NOT NULL DEFAULT 'FULL';

-- ── Trip: airport-agent attribution (M19) ────────────────────────────────────
ALTER TABLE "trips" ADD COLUMN "agentId" UUID;

-- ── RouteConfig: per-route behavior layer (M19) ──────────────────────────────
CREATE TABLE "route_configs" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "originRegion" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "international" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "customsIntelligence" BOOLEAN NOT NULL DEFAULT false,
    "allowAggregationOnly" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "route_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "route_configs_code_key" ON "route_configs"("code");
CREATE INDEX "route_configs_originRegion_destinationRegion_idx" ON "route_configs"("originRegion", "destinationRegion");
CREATE INDEX "route_configs_active_idx" ON "route_configs"("active");

-- ── DemandSignal: unmet/observed demand capture (M20) ────────────────────────
CREATE TABLE "demand_signals" (
    "id" UUID NOT NULL,
    "originRegion" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "itemCategory" TEXT,
    "source" "DemandSignalSource" NOT NULL,
    "actorId" UUID,
    "detail" JSONB,
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demand_signals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "demand_signals_originRegion_destinationRegion_createdAt_idx" ON "demand_signals"("originRegion", "destinationRegion", "createdAt");
CREATE INDEX "demand_signals_itemCategory_idx" ON "demand_signals"("itemCategory");
CREATE INDEX "demand_signals_source_idx" ON "demand_signals"("source");

-- ── CustomsEvent: real customs outcome capture (M20) ─────────────────────────
CREATE TABLE "customs_events" (
    "id" UUID NOT NULL,
    "shipmentId" UUID,
    "itemCategory" TEXT NOT NULL,
    "originRegion" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "outcome" "CustomsOutcome" NOT NULL,
    "travelerFrequencyTier" "CustomsFrequencyTier",
    "taxAmountEtb" DECIMAL(12,2),
    "detail" JSONB,
    "recordedBy" UUID,
    "countryCode" TEXT NOT NULL DEFAULT 'ET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customs_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customs_events_itemCategory_outcome_idx" ON "customs_events"("itemCategory", "outcome");
CREATE INDEX "customs_events_originRegion_destinationRegion_idx" ON "customs_events"("originRegion", "destinationRegion");
