Canonical reference for the current Shanta codebase. Update this file whenever the product or implementation changes.

# Shanta

## 1. Name & Brand

Shanta is the product name used in the codebase and docs. The brand is rooted in the Ethiopian idea of luggage and travel, but the system itself is a trust network for moving goods through people.

| Field | Value |
|---|---|
| Name | Shanta |
| Meaning | Amharic for bag / suitcase |
| Tagline | Carry More Than Luggage |
| Promise | Send what matters through people you can trust |
| Voice | Trust-first, practical, premium, human |
| Languages | English and Amharic are both first-class in the UI shell |

Actual code uses a navy + amber brand palette, Inter + Noto Sans Ethiopic, and a two-language locale cookie via `next-intl`.

## 2. What Shanta Is

Shanta is a single web application built with Next.js. It formalizes the informal economy of moving goods through travelers by combining identity, verification, pricing, matching, escrow, notifications, and admin ops in one stack.

What is actually built:

| Area | Implemented reality |
|---|---|
| App shape | One Next.js App Router web app, not a separate mobile client |
| Auth | Supabase Auth for end users; Telegram login is primary in the public UI, with email OTP and phone OTP also available |
| Sender flow | Public `/send` preview page collects route and item details before auth |
| Data | Supabase Postgres 16 via Prisma 6; project ref `plvrkjkoeybarlgmfqcv` |
| Files | Supabase Storage for handoff photos and KYC documents |
| Business logic | Server-side services under `src/lib/services/` plus pure domain code under `src/lib/domain/` |
| Admin | Full in-app admin dashboard with intelligence analytics, escrow, users, rules, reliability, and receiver-requests pages |
| Receivers | SMS-first; no login required for pickup confirmation. Receivers can also submit item requests without a sender account |
| Automation | Vercel Cron jobs (daily on Hobby plan) drain notifications and run operational checks |
| Deployment | Live at `https://shanta-ygebrekidann-4376s-projects.vercel.app` |

What the code does not contain:

| Missing from repo | Notes |
|---|---|
| Flutter app | No Flutter source exists in this repo |
| Fastify API server | Route handlers are Next.js, not a separate Fastify app |
| Railway deployment | Vercel is the deployed web target |
| R2 storage | Supabase Storage is the implemented storage backend |
| Custom OTP/refresh token system | Supabase Auth owns sessions and OTP |
| Payment automation | Manual hub escrow only; no payment rails |

## 3. The Four-Node Model

| Node | Code representation | What it does |
|---|---|---|
| Node 1 — Sender | `Profile.roles` includes `SENDER` | Creates shipments and pays the quoted price |
| Node 2a — Traveler / Carrier | `Profile.roles` includes `TRAVELER`; `Trip` and `TripLeg` | Posts capacity and physically carries items |
| Node 2b — Agent | `Role.AIRPORT_AGENT`; `Trip.agentId`; `HubType.AGENT` | Coordinates supply; can overlap with a hub operator |
| Node 3 — Aggregator Hub | `Hub`, `HandoffRecord`, hub intake / verify / seal flows | Receives, inspects, seals, and consolidates shipments |
| Node 4 — Receiver | `Shipment.receiverName`, `receiverPhone`, optional `receiverUserId` | Confirms receipt by SMS token; can also create `ReceiverRequest` without a sender |

A **fifth demand vector** now exists: `ReceiverRequest`. A receiver can ask a traveler to bring something from the origin region — no sender needed. This is tracked and surfaced in the admin intelligence dashboard as demand-side signal.

| Question | Code reality |
|---|---|
| Are Agent and Hub the same thing? | No. The code keeps them separate, but they can overlap in one real-world operator |
| Is the Agent role purely recruitment? | No. Agent is a coordinating supply node; no dedicated agent UI yet |
| Does one entity hold both roles? | Yes, via role flags and hub/operator relationships |

## 4. Shipment Flow

Happy path in code:

| Step | Implemented path |
|---|---|
| 1 | Public landing routes sender to `/send`, a preview-first page asking for route and item details before auth |
| 2 | Auth is deferred until booking intent is clear; the login page carries route context forward |
| 3 | Telegram login is the primary sign-in path; email OTP and phone OTP are alternatives |
| 4 | `/verify` completes OTP and returns user to preserved booking context |
| 5 | Sender lands on `/shipments/new` with route/item fields pre-filled from draft |
| 6 | Sender creates shipment via `POST /api/v1/shipments` |
| 7 | Route context resolved from `RouteConfig`; rules validated via rules engine |
| 8 | Pricing computed from `CorridorPricing` + any active `PricingTier` multipliers; stored in `Shipment.pricingSnapshot` |
| 9 | Shipment created in `RULES_VALIDATED` → `AWAITING_HUB_INTAKE`; optional manual hub escrow armed |
| 10 | Hub intake records photos, actual weights, cash check → `AT_ORIGIN_HUB` or `WEIGHT_DISCREPANCY` |
| 11 | Hub verifies contents with photos → `CONTENTS_VERIFIED` |
| 12 | Hub applies tamper seal → `SEALED` → `AWAITING_MATCH` |
| 13 | Matching finds eligible travelers; assigns trip leg |
| 14 | Traveler reviews sealed evidence, accepts custody; escrow marked `HELD` if present |
| 15 | Hub releases shipment; receiver sent SMS token with no-login pickup link |
| 16 | Receiver confirms pickup by SMS token → `DELIVERY_CONFIRMED`; disputes go to `DISPUTED` |
| 17 | Admin releases or refunds escrow |

Aggregation-only path: `SEALED → CONSOLIDATED → DELIVERED` without platform carrier.

## 5. Tech Stack

| Layer | Actual tech in repo |
|---|---|
| Framework | Next.js 16.2.9 App Router |
| Runtime | React 19, TypeScript strict, Node 20 |
| Auth | Supabase Auth via `@supabase/ssr` and `@supabase/supabase-js` |
| Database | Supabase Postgres 16 via Prisma 6; pooled `DATABASE_URL` + direct `DIRECT_URL` |
| Storage | Supabase Storage (private buckets: `kyc-docs`, `handoff-photos`) |
| Validation | Zod v4 |
| i18n | `next-intl` with `messages/en.json` and `messages/am.json` |
| Styling | Tailwind CSS v4 + Shadcn/ui-style primitives |
| Testing | Vitest (unit/integration), Playwright (smoke + e2e) |
| Deployment | Vercel Hobby plan; cron jobs daily (Hobby limit) |
| Session guard | `src/proxy.ts` refreshes Supabase sessions and rate limits sensitive paths |
| Supabase project | `plvrkjkoeybarlgmfqcv` (eu-central-1) |

Package scripts:

| Script | Purpose |
|---|---|
| `dev` | Start Next.js dev server |
| `build` | Build the app (`pnpm build`) |
| `start` | Start production server |
| `lint` | ESLint |
| `typecheck` | `tsc --noEmit` |
| `test` | Vitest unit tests |
| `test:e2e` | Playwright full suite |
| `test:smoke` | Playwright smoke test |
| `db:generate` | Prisma client generation |
| `db:migrate` | Prisma dev migration |
| `db:deploy` | Prisma migrate deploy (run locally — not in Vercel build) |
| `db:push` | Prisma db push |
| `db:seed` | Seed the database |
| `db:studio` | Prisma Studio |

## 6. Application Architecture

| Directory | Role |
|---|---|
| `src/app` | Pages, layouts, server actions, and all `/api/v1` route handlers |
| `src/components` | Shared UI shell, logo, locale switcher, and design-system primitives |
| `src/lib/domain` | Pure business logic: state machine, rules engine, pricing, matching, escrow, notifications, shared types |
| `src/lib/services` | Transactional orchestration: analytics, delivery, escrow, handoff, KYC, match, notification, shipment, trip |
| `src/lib/db` | Prisma repositories and in-memory test doubles |
| `src/lib/supabase` | Browser/server/service-role Supabase clients and middleware helpers |
| `src/lib/telegram` | Telegram login, webhook, bot router, and profile linkage |
| `src/lib/sms` | SMS sender port, templates, and webhook helpers |
| `src/lib/storage` | Handoff photo and KYC document validation/upload/signing |
| `src/lib/api` | Route validation schemas, error envelope, response helpers, upload parsing |
| `src/lib/delivery` | Receiver delivery token generation and validation |
| `prisma` | Schema (`schema.prisma`), seed (`seed.ts`), and migrations |
| `messages` | English and Amharic message bundles |
| `e2e` | Playwright smoke tests |
| `docs` | Product and architecture docs (some still describe pre-ADR stack; this file is authoritative) |
| `Branding` | Logo and brand assets |
| `prompts` | Role-specific agent prompts |

Request path:

| Layer | Responsibility |
|---|---|
| Pages and forms | Collect input and call the API or server actions |
| Route handlers | Validate with Zod, enforce auth, call services, return `{ data }` / `{ error }` envelopes |
| Services | Orchestrate state transitions, rules, pricing, escrow, handoffs, matching, analytics |
| Repositories | Read/write Prisma models in transactions |
| Domain | Pure functions for state legality, rules, pricing, matching, escrow transitions |

Page surfaces:

| Surface | Status |
|---|---|
| `/` | Public landing page |
| `/send` | Public preview-first sender flow |
| `/carry` | Public preview-first traveler capacity flow |
| `/login`, `/verify` | Public multi-channel auth (Telegram, email OTP, phone OTP) |
| `/confirm` | Public receiver pickup confirmation (SMS token, no login) |
| `/hub/login`, `/hub/verify` | Hub operator login / OTP flow |
| `/onboarding` | Protected role selection |
| `/dashboard` | Protected sender/traveler chooser |
| `/shipments`, `/shipments/new`, `/shipments/[id]` | Protected sender flow |
| `/trips`, `/trips/new`, `/trips/[id]` | Protected traveler flow |
| `/hub`, `/hub/intake/[shipmentId]`, `/hub/[shipmentId]`, `/hub/dashboard` | Protected aggregator flow |
| `/admin` | Admin KPI dashboard with trend charts |
| `/admin/shipments` | Paginated shipment list with status filters |
| `/admin/disputes` | Open disputes with escrow and evidence chain |
| `/admin/kyc` | KYC review queue |
| `/admin/escrow` | Escrow ledger with total held ETB, release/refund actions |
| `/admin/users` | User list with roles, KYC status, suspend action |
| `/admin/rules` | Item restriction rules (all columns including duty/unit caps) |
| `/admin/audit` | Immutable audit log |
| `/admin/intelligence` | Full intelligence dashboard (demand, supply, customs, routes, pricing, revenue) |
| `/admin/receiver-requests` | Receiver-initiated item demand requests |
| `/admin/reliability` | Traveler trust metrics (ops-internal, never public) |

## 7. Data Models

### Enums

| Enum | Values of note |
|---|---|
| `Role` | `SENDER`, `TRAVELER`, `AGGREGATOR`, `RECEIVER`, `AIRPORT_AGENT` |
| `TravelerTier` | `CASUAL`, `PROFESSIONAL` |
| `KycStatus` | `UNVERIFIED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED` |
| `TripStatus` | `DRAFT`, `ACTIVE`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `TripLegStatus` | `ACTIVE`, `FULL`, `CANCELLED`, `COMPLETED` |
| `HubType` | `ORIGIN`, `TRANSIT`, `DESTINATION`, `AGENT` |
| `HubStatus` | `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`, `CLOSED` |
| `ShipmentStatus` | Full 28-value lifecycle (see state machine) |
| `HandoffType` | `SENDER_TO_HUB`, `HUB_TO_TRAVELER`, `TRAVELER_TO_HUB`, `HUB_TO_RECEIVER`, `TRAVELER_TO_RECEIVER` |
| `CaptureMethod` | `LIVE`, `GALLERY` |
| `RestrictionDirection` | `ENTRY`, `EXIT`, `BOTH` |
| `RestrictionCheckTrigger` | `SUBMISSION`, `HUB_INTAKE`, `RE_MATCH` |
| `RestrictionCheckResult` | `PASS`, `FAIL`, `NEEDS_PERMIT`, `NEEDS_DECLARATION` |
| `EscrowHolderType` | `HUB`, `PAYMENT_PROVIDER` |
| `EscrowStatus` | `PENDING`, `HELD`, `RELEASE_REQUESTED`, `RELEASED`, `REFUNDED`, `DISPUTED` |
| `NotificationChannel` | `SMS`, `PUSH`, `TELEGRAM` |
| `ServiceType` | `FULL`, `AGGREGATION_ONLY` |
| `DemandSignalSource` | `SEARCH`, `NO_MATCH`, `BOT_QUERY` |
| `CustomsOutcome` | `CLEARED`, `FLAGGED`, `TAXED`, `SEIZED` |
| `AdminRole` | `SUPER_ADMIN`, `OPERATIONS`, `KYC_REVIEWER`, `FINANCE` |
| `WebhookProvider` | `AFRICA_TALKING`, `TELE_BIRR`, `INNGEST` |
| `ReceiverRequestStatus` (DB enum) | `OPEN`, `OFFERED`, `ACCEPTED`, `FULFILLED`, `EXPIRED`, `CANCELLED` |

### Core tables

| Model | Purpose | Key fields |
|---|---|---|
| `Profile` | End-user identity keyed to `auth.users.id` | `id`, `phone`, `email`, `telegramUserId`, `fullName`, `roles[]`, `travelerTier`, `kycStatus`, `preferredLanguage`, `countryCode`, `status`, `deletedAt` |
| `TravelProfile` | Per-traveler risk/frequency tracking (Constraint 2.1) | `userId`, `tripCountLast30Days`, `tripCountLast90Days`, `tripCountLifetime`, `lastTripAt`, `customsFrequencyTier`, `riskFlags` |
| `TravelerReliability` | Ops-internal trust scoring (dispute rate, no-shows, seal tampers) | `travelerId`, `completedDeliveries`, `disputedDeliveries`, `noShowCount`, `lateHandoffCount`, `weightDiscrepancyCount`, `sealTamperCount`, `disputeRate`, `reliabilityScore`, `reliabilityTier`, `flagReason` |
| `AdminUser` | Admin staff lookup keyed to `auth.users.id` | `id`, `email`, `role`, `active`, `lastLoginAt` |
| `Trip` | Traveler trip container | `travelerId`, `status`, `mode`, `agentId`, `countryCode`, `version`, `deletedAt` |
| `TripLeg` | One leg of a trip | `tripId`, `sequence`, `originRegion`, `destinationRegion`, `departAt`, `totalCapacityKg`, `availableCapacityKg`, `status` |
| `Hub` | Physical aggregation / operator location | `name`, `operatorUserId`, `hubTypes[]`, `region`, `address`, `geoLat`, `geoLng`, `operatingHours`, `status`, `countryCode` |
| `Shipment` | End-to-end delivery record | `senderId`, `receiverName`, `receiverPhone`, `receiverUserId`, `originRegion`, `destinationRegion`, `serviceType`, `status`, `version`, `pricingSnapshot`, `carrierFeeEtb`, `aggregatorFeeEtb`, `platformFeeEtb`, `insurancePremiumEtb`, `taxAmountEtb`, `totalPriceEtb`, `pricingBasis`, `insuranceOptedIn`, `currency`, `countryCode`, `deletedAt` |
| `ShipmentLeg` | One hop of a shipment | `shipmentId`, `sequence`, `tripLegId`, `originHubId`, `destinationHubId`, `travelerId`, `status`, `version` |
| `Item` | Physical item in a shipment | `shipmentId`, `shipmentLegId`, `category`, `description`, `quantity`, `declaredWeightKg`, `actualWeightKg`, `declaredValueEtb`, `sealId`, `deletedAt` |
| `HandoffRecord` | Immutable custody evidence (Constraint 2.2) | `shipmentId`, `shipmentLegId`, `handoffType`, `fromActorId`, `toActorId`, `photoUrls`, `videoUrl`, `captureMethod`, `acknowledgmentText`, `acknowledged`, `sealApplied`, `sealId`, `sealIntact`, `geoLat`, `geoLng`, `capturedAt` |
| `ItemRestriction` | Configurable customs rule (Constraint 2.4) | `itemCategory`, `corridorCode`, `corridorOverrideOf`, `maxWeightKg`, `maxValueEtb`, `maxUnitsPerTraveler`, `dutyApplies`, `dutyNote`, `frequencySensitive`, `maxWeightKgFrequent`, `requiresDeclaration`, `requiresSpecialPermit`, `prohibited`, `direction`, `sourceRegulation`, `effectiveFrom`, `effectiveUntil` |
| `RestrictionCheck` | Audit of rules evaluation | `shipmentId`, `itemId`, `trigger`, `result`, `failedRuleId`, `detail`, `travelerFrequencyTier` |
| `EscrowRecord` | Manual or future automated money hold | `shipmentId`, `amountEtb`, `currency`, `holderType`, `holderId`, `status`, `releaseCondition`, `heldAt`, `releasedAt`, `refundedAt`, `releasedBy`, `providerRef` |
| `CorridorPricing` | Versioned per-route base price | `originRegion`, `destinationRegion`, `ratePerKgEtb`, `minChargeEtb`, `aggregatorFlatFeeEtb`, `platformCommissionRate`, `insuranceRate`, `taxRate`, `effectiveFrom`, `effectiveUntil` |
| `PricingTier` | Per-item-category pricing overrides | `itemCategory`, `corridorCode`, `rateMultiplier`, `flatFeeEtb`, `minChargeEtb`, `pricingBasis` (PER_KG / PER_ITEM / PER_LUGGAGE / FLAT), `luggageFlatFeeEtb`, `active` |
| `ReceiverRequest` | Receiver-initiated item demand (no sender required) | `receiverName`, `receiverPhone`, `receiverUserId`, `originRegion`, `destinationRegion`, `itemCategory`, `itemDescription`, `estimatedValueEtb`, `quantity`, `neededBy`, `status`, `offeredByTravelerId`, `shipmentId` |
| `Notification` | Outbox row for SMS / Telegram / push | `userId`, `recipientPhone`, `channel`, `templateKey`, `payload`, `language`, `status`, `attempts`, `providerRef`, `sentAt` |
| `ShipmentStatusHistory` | Append-only shipment transition log | `shipmentId`, `fromStatus`, `toStatus`, `actorType`, `actorId`, `handoffRecordId`, `reason`, `createdAt` |
| `AuditLog` | Immutable admin/system audit log | `actorType`, `actorId`, `action`, `entityType`, `entityId`, `beforeState`, `afterState`, `metadata`, `ipAddress` |
| `WebhookLog` | Inbound webhook processing log | `provider`, `eventType`, `eventId`, `payload`, `signatureValid`, `processedAt`, `processingError` |
| `AppConfig` | Runtime config / feature flags | `key`, `value`, `description`, `updatedAt`, `updatedBy` |
| `OperationalNote` | Human note on a profile or shipment | `entityType`, `entityId`, `note`, `createdBy`, `createdAt` |
| `IdempotencyKey` | Mutating-request dedupe store | `key`, `scope`, `responseBody`, `createdAt` |
| `RouteConfig` | Route behavior layer | `code`, `originRegion`, `destinationRegion`, `international`, `currency`, `customsIntelligence`, `allowAggregationOnly`, `config`, `active`, `countryCode` |
| `DemandSignal` | Search / unmet demand capture | `originRegion`, `destinationRegion`, `itemCategory`, `source`, `actorId`, `detail`, `fulfilledByTravelerId`, `fulfilledAt`, `estimatedValueEtb`, `neededBy` |
| `CustomsEvent` | Actual customs outcome capture | `shipmentId`, `itemCategory`, `originRegion`, `destinationRegion`, `outcome`, `travelerFrequencyTier`, `taxAmountEtb`, `detail`, `recordedBy` |

Important schema facts:

| Fact | Reality |
|---|---|
| There is no `User` table | `Profile` is the domain user table keyed to `auth.users.id` |
| There are no custom OTP or refresh-token models | Supabase Auth owns those concerns |
| `countryCode` is present broadly | Phase 3 seed for multi-tenancy; default `ET` |
| `Shipment` does not persist `corridorCode` | Route context resolved at create time; later stages cannot fully re-resolve route-specific rules |
| `TravelerReliability` is ops-internal | Never surfaced publicly; not used as a matching ranking input (Constraint 2.1) |
| `PricingTier` is additive | It multiplies / supplements `CorridorPricing`, not replaces it |

## 8. API Reference

All API routes live under `/api/v1`. Responses use `{ data: ... }` on success and `{ error: { code, message, correlation_id, details? } }` on failure.

### Public / no-login routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/health` | none | Liveness check; returns `{status:"ok", checks:{database:"ok"}}` |
| `POST` | `/api/v1/delivery/confirm` | SMS token only | Receiver confirms pickup or reports a problem |
| `POST` | `/api/v1/auth/telegram` | Telegram widget signature + bot token | Mint a Supabase session from a verified Telegram login |
| `POST` | `/api/v1/telegram/webhook` | Telegram webhook secret | Telegram bot webhook for the self-serve bot |

### Sender / traveler / aggregator routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/shipments` | `SENDER` | Create shipment, validate rules, compute price, optionally arm escrow |
| `GET` | `/api/v1/shipments` | `SENDER` | List current sender's shipments |
| `GET` | `/api/v1/shipments/:id` | `SENDER` | Fetch one sender-owned shipment |
| `POST` | `/api/v1/shipments/:id/intake` | `AGGREGATOR` | Hub intake: photos, actual weights, cash check |
| `POST` | `/api/v1/shipments/:id/verify` | `AGGREGATOR` | Contents verification with photos |
| `POST` | `/api/v1/shipments/:id/seal` | `AGGREGATOR` | Apply tamper seal and queue for matching |
| `POST` | `/api/v1/shipments/:id/match` | `AGGREGATOR` | Assign a ranked traveler trip leg |
| `POST` | `/api/v1/shipments/:id/review` | `TRAVELER` | Traveler reviews sealed evidence |
| `POST` | `/api/v1/shipments/:id/accept` | `TRAVELER` | Traveler accepts custody |
| `POST` | `/api/v1/shipments/:id/reject` | `TRAVELER` | Traveler rejects custody; re-queues shipment |
| `POST` | `/api/v1/shipments/:id/out-for-delivery` | `AGGREGATOR` | Move to pickup-ready release state |
| `POST` | `/api/v1/shipments/:id/delivery-attempted` | `TRAVELER` | Record a failed delivery attempt |
| `POST` | `/api/v1/shipments/:id/deliver` | `AGGREGATOR` | Release for destination pickup; mint receiver token |
| `POST` | `/api/v1/shipments/:id/transition` | admin only | Manual state transition (operations / runbook) |
| `POST` | `/api/v1/trips` | `TRAVELER` | Publish a trip with one or more legs |
| `GET` | `/api/v1/trips` | `TRAVELER` | List current traveler's trips |
| `GET` | `/api/v1/matching` | `AGGREGATOR` | Find ranked eligible travelers for a route and item |
| `GET` | `/api/v1/rules` | any authenticated | Get active item-restriction rules for the user's country |
| `POST` | `/api/v1/kyc/submit` | any authenticated | Upload KYC identity document |

### Admin routes

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/admin/kpis` | `OPERATIONS`, `SUPER_ADMIN` | Full KPI summary: totals, rates, 14-day trend arrays, receiver request count, total revenue |
| `GET` | `/api/v1/admin/launch-gate` | `OPERATIONS`, `SUPER_ADMIN` | Go/No-Go gate with 5 named pass/fail checks |
| `GET` | `/api/v1/admin/shipments` | `OPERATIONS`, `SUPER_ADMIN` | Paginated shipment list with status filters |
| `GET` | `/api/v1/admin/disputes` | `OPERATIONS`, `SUPER_ADMIN` | Open disputes with escrow and evidence chain |
| `GET` | `/api/v1/admin/audit` | `SUPER_ADMIN` | Paginated audit log |
| `GET` | `/api/v1/admin/escrow` | `FINANCE`, `SUPER_ADMIN` | Paginated escrow list |
| `POST` | `/api/v1/admin/escrow/:id/release` | `FINANCE`, `SUPER_ADMIN` | Release HELD escrow |
| `POST` | `/api/v1/admin/escrow/:id/refund` | `FINANCE`, `SUPER_ADMIN` | Refund a non-settled escrow |
| `GET` | `/api/v1/admin/kyc/queue` | `KYC_REVIEWER`, `SUPER_ADMIN` | Pending KYC queue with signed document URLs |
| `POST` | `/api/v1/admin/kyc/:userId/approve` | `KYC_REVIEWER`, `SUPER_ADMIN` | Approve KYC |
| `POST` | `/api/v1/admin/kyc/:userId/reject` | `KYC_REVIEWER`, `SUPER_ADMIN` | Reject KYC |
| `GET` | `/api/v1/admin/rules` | `OPERATIONS`, `SUPER_ADMIN` | List item restrictions (all columns) |
| `POST` | `/api/v1/admin/rules` | `SUPER_ADMIN` | Create an item restriction |
| `PUT` | `/api/v1/admin/rules/:id` | `SUPER_ADMIN` | Update an item restriction |
| `DELETE` | `/api/v1/admin/rules/:id` | `SUPER_ADMIN` | Soft-expire an item restriction |
| `GET` | `/api/v1/admin/users` | `OPERATIONS`, `SUPER_ADMIN` | Paginated profile list |
| `POST` | `/api/v1/admin/users/:userId/suspend` | `OPERATIONS`, `SUPER_ADMIN` | Suspend a user |
| `GET` | `/api/v1/admin/receiver-requests` | `OPERATIONS`, `SUPER_ADMIN` | All receiver-initiated requests with status filter |
| `GET` | `/api/v1/admin/pricing-tiers` | `OPERATIONS`, `FINANCE`, `SUPER_ADMIN` | List active per-item pricing tiers |
| `POST` | `/api/v1/admin/pricing-tiers` | `SUPER_ADMIN` | Create a per-item pricing tier |
| `GET` | `/api/v1/admin/intelligence/demand` | `OPERATIONS` | Top searched routes, unmet demand, receiver request stats, demand-by-day time series |
| `GET` | `/api/v1/admin/intelligence/supply` | `OPERATIONS` | Active trips, capacity by route, frequency tiers, reliability tiers, traveler KYC counts |
| `GET` | `/api/v1/admin/intelligence/routes` | `OPERATIONS` | Per-route volume, completion rate, avg price, total revenue, international flag |
| `GET` | `/api/v1/admin/intelligence/customs` | `OPERATIONS` | Customs outcomes by category, tax collected, flag rate by route, recent events |
| `POST` | `/api/v1/admin/intelligence/customs` | `OPERATIONS` | Record a real customs outcome |
| `GET` | `/api/v1/admin/intelligence/pricing` | `OPERATIONS`, `FINANCE`, `SUPER_ADMIN` | Corridor rates, pricing tiers, revenue by category/route, full fee breakdown |
| `GET` | `/api/v1/admin/intelligence/reliability` | `OPERATIONS`, `SUPER_ADMIN` | Traveler reliability tier breakdown, flagged traveler list, overall stats |

### Cron routes (Vercel daily schedule, Hobby plan)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/cron/drain-notifications` | `CRON_SECRET` bearer | Drain the notification outbox |
| `GET` | `/api/v1/cron/check-stuck-shipments` | `CRON_SECRET` bearer | Alert on stale shipments |
| `GET` | `/api/v1/cron/escrow-timeout` | `CRON_SECRET` bearer | Alert on HELD escrows older than timeout |
| `GET` | `/api/v1/cron/frequency-report` | `CRON_SECRET` bearer | Recompute traveler frequency tiers |

## 9. Auth Model

| Auth path | Implemented behavior |
|---|---|
| Public user login | `/login` offers Telegram first, then email OTP and phone OTP |
| OTP verification | `/verify` completes OTP and restores draft booking context |
| Telegram login | `POST /api/v1/auth/telegram` verifies widget payload and mints a Supabase session |
| Telegram bot | `POST /api/v1/telegram/webhook` routes self-serve commands |
| Receiver confirmation | No login; SMS token in pickup link is the authorization |
| Admin access | `requireAdmin()` / `requireApiAdminRole()` check `admin_users` table for valid staff record |

Profile lifecycle:

| Behavior | Code reality |
|---|---|
| Primary identity | `Profile.id` equals `auth.users.id` |
| First sign-in | `getOrCreateProfile()` upserts the profile; mirrors phone/email |
| Default role | New profiles get `[RECEIVER]` only |
| Onboarding | `saveRoles()` persists `SENDER`, `TRAVELER`, or `AGGREGATOR` and lifts the onboarding block |
| Active role gate | `requireActiveRole()` redirects `RECEIVER`-only profiles to `/onboarding` |

Session and route guarding:

| Mechanism | Role |
|---|---|
| `src/proxy.ts` | Refreshes Supabase session; redirects unauthenticated page visits; rate limits sensitive paths |
| `requireProfile` / `requireAdmin` | Page-level server guards |
| `requireApiProfile` / `requireApiRole` / `requireApiAdminRole` | API route guards |
| `signOut` server action | Logs the user out and returns to `/` |

## 10. Pricing Model

Pricing is ETB-denominated. It is a two-layer system:

**Layer 1 — `CorridorPricing`** (base rate per route):

| Component | Formula |
|---|---|
| Carrier fee | `max(declaredWeightKg × ratePerKgEtb, minChargeEtb)` |
| Aggregator fee | `aggregatorFlatFeeEtb` (flat, per shipment) |
| Platform fee | `(carrierFee + aggregatorFee) × platformCommissionRate` |
| Insurance | `declaredValueEtb × insuranceRate` (optional) |
| Tax | `totalBeforeTax × taxRate` (currently 0 in all seeded corridors) |

**Layer 2 — `PricingTier`** (per-item-category overrides on top):

| Basis | How it works |
|---|---|
| `PER_KG` | `rateMultiplier` applied to corridor `ratePerKgEtb`; `flatFeeEtb` added to result |
| `PER_ITEM` | `flatFeeEtb` charged per unit of this category (weight-independent) |
| `PER_LUGGAGE` | `luggageFlatFeeEtb` replaces the carrier fee entirely for this item type |
| `FLAT` | `luggageFlatFeeEtb` as a shipment-level flat rate |

Seeded pricing tiers:

| Category | Corridor | Basis | Rate | Notes |
|---|---|---|---|---|
| `ELECTRONICS` | All | PER_KG | 1.2× multiplier | 20% surcharge |
| `FRAGILE` | All | PER_KG | +50 ETB flat | Handling surcharge |
| `FULL_BAG` | All | PER_LUGGAGE | 800 ETB flat | Whole bag flat rate |
| `CLOTHING` | All | PER_KG | 1.0× | Standard rate |
| `FOOD` | All | PER_KG | 0.9× | 10% discount |
| `DOCUMENTS` | All | PER_ITEM | 200 ETB | Weight-independent |
| `COFFEE` | ET_DUBAI | PER_KG | 1.5× | Export surcharge |
| `ELECTRONICS_LAPTOP` | DUBAI-ADDIS | PER_ITEM | +300 ETB | Item-level fee |
| `ELECTRONICS_PHONE` | DUBAI-ADDIS | PER_ITEM | +150 ETB | Item-level fee |

Seeded corridor base rates (all corridors):

| Field | Value |
|---|---|
| `ratePerKgEtb` | 120.00 |
| `minChargeEtb` | 200.00 |
| `aggregatorFlatFeeEtb` | 50.00 |
| `platformCommissionRate` | 15% |
| `insuranceRate` | 2% |
| `taxRate` | 0% |

## 11. Customs & Regulatory Rules

Rules engine is data-driven via `ItemRestriction`. All seeded rules are marked as secondary research, unverified until OQ-3 (official customs regulation) is resolved.

| Category | Rule |
|---|---|
| COFFEE | 2 kg exit cap; declaration + special permit required |
| SPICES | 5 kg cap |
| BUTTER | 5 kg cap |
| JEWELRY | 100 g (non-frequent) / 50 g (frequent); declaration required; frequency-sensitive |
| CASH | Prohibited (platform policy, Constraint 2.5) |
| ELECTRONICS | Declaration required |
| PHARMA | Prohibited (Phase 1) |
| PLASTIC_DRUM | Prohibited on ADDIS_INBOUND corridor (ENTRY) |
| LAPTOP (DUBAI-ADDIS) | 1 unit/traveler; declaration; duty note surfaced |
| PHONE (DUBAI-ADDIS) | 2 units/traveler; declaration; duty note surfaced |
| COSMETICS (DUBAI-ADDIS) | 5 kg; duty note surfaced |
| BABY_PRODUCTS (DUBAI-ADDIS) | 10 kg |
| CLOTHING (DUBAI-ADDIS) | 15 kg |

Rule engine behavior:

| Behavior | Code reality |
|---|---|
| Resolution order | Corridor-specific active rule wins over base rule |
| Direction | `ENTRY`, `EXIT`, `BOTH` respected |
| Frequency sensitivity | Applies stricter cap for `FREQUENT` travelers |
| Unit caps | `maxUnitsPerTraveler` enforced as aggregate across shipment |
| Evaluation points | Submission, hub intake, re-match |
| Duty transparency | `dutyApplies` + `dutyNote` surfaced as compliance info only |

Known gaps in enforcement:

| Gap | Effect |
|---|---|
| `Shipment` has no `corridorCode` field | Route-specific rules cannot be re-resolved at later stages |
| `RouteConfig.allowAggregationOnly` not fully enforced | Route behavior layer partially inactive |
| Manifest diversity logic dormant | `assessManifestDiversity()` exists in domain but no service calls it |
| `crowding.max_distinct_senders_per_category` seeded but not enforced | Only weight-based crowding is active |

## 12. Escrow

Manual hub escrow is the Phase 1 design. `holderType = HUB`; payment-provider automation is a future path.

| Step | Code reality |
|---|---|
| Shipment creation | Optional `EscrowRecord` armed immediately; `status = PENDING` |
| Traveler accepts custody | Escrow marked `HELD` if present |
| Pickup confirmed | Admin manually releases via `POST /api/v1/admin/escrow/:id/release` |
| Dispute | Escrow stays `HELD`; no auto-release |
| Cancellation / return | Admin refunds via `POST /api/v1/admin/escrow/:id/refund` |

| Question | Answer |
|---|---|
| Is payment automation implemented? | No |
| Is cross-border settlement implemented? | No |
| Is manual hub escrow implemented? | Yes |
| Is escrow optional? | Yes; shipment flows without it |

## 13. Data Intelligence & Analytics

The `AnalyticsService` (`src/lib/services/analytics-service.ts`) is the single source for all admin analytics. All methods are read-only aggregations.

| Method | What it returns |
|---|---|
| `kpis()` | Total shipments, match/completion rates, revenue, pending KYC, held escrow, open receiver requests, 14-day shipment + revenue trend arrays |
| `demand(windowDays)` | Top searched routes, unmet routes (NO_MATCH), top shipped categories, receiver request counts + top categories + top routes, demand-by-day time series |
| `supply()` | Active trip count, total capacity kg, avg kg/trip, capacity by route, frequency tier distribution, reliability tier distribution, traveler KYC counts |
| `customs()` | Outcomes by category + outcome (with tax totals), taxed-by-category table, flag rate by route from restriction checks, recent 20 customs events |
| `routes()` | Per-route: total, completed, completion rate %, avg price ETB, total revenue ETB, international flag |
| `pricing()` | Corridor rates, active pricing tiers, revenue by category, revenue by route, full fee breakdown (carrier / aggregator / platform / insurance / tax / grand total) |
| `reliability()` | Tier breakdown with avg scores, flagged/suspended traveler list with all metrics, overall stats |

Traveler reliability scoring (Constraint 2.1 compliant):

| Metric tracked | What it means |
|---|---|
| `completedDeliveries` | Successful custody-to-delivery count |
| `disputedDeliveries` | Deliveries that ended in a dispute |
| `noShowCount` | Accepted custody but didn't appear at hub |
| `lateHandoffCount` | Handoff more than X hours after scheduled |
| `weightDiscrepancyCount` | Times intake flagged their shipments |
| `sealTamperCount` | Times seal was reported broken on their custody |
| `disputeRate` | `disputedDeliveries / max(1, completedDeliveries)` |
| `reliabilityScore` | 0–1 composite, computed by reliability cron |
| `reliabilityTier` | `NEW` / `TRUSTED` / `FLAGGED` / `SUSPENDED` |

This data is **ops-internal only** — never surfaced to travelers, never used as a public ranking or matching preference lever.

## 14. Supabase Production State

| Item | Detail |
|---|---|
| Project ref | `plvrkjkoeybarlgmfqcv` |
| Region | `aws-1-eu-central-1` |
| Migrations applied | 4 Prisma migrations + 2 MCP-applied migrations (RLS + indexes + new tables) |
| Tables | 28 tables in `public` schema |
| RLS | Enabled + policies on every table (0 security advisor warnings) |
| Missing FK indexes | Fixed (6 indexes added) |
| Seed data | Item restrictions (13 rules), corridor pricing (9 corridors), route configs (12 routes), pricing tiers (9 tiers), AppConfig (10 keys) |

Active Vercel environment variables (production):
`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COUNTRY_CODE`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `DELIVERY_TOKEN_SECRET`

Missing (not yet configured): `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `AT_API_KEY`, `AT_USERNAME`, `AT_SHORTCODE`

## 15. Corridors

| Corridor | Type | Status |
|---|---|---|
| Addis Ababa ↔ Hawassa | Domestic | Active |
| Addis Ababa ↔ Dire Dawa | Domestic | Active |
| Addis Ababa ↔ Bahir Dar | Domestic | Active |
| Addis Ababa ↔ Adama | Domestic | Active |
| Addis Ababa ↔ Mekelle | Domestic | Active |
| Addis Ababa ↔ Jimma | Domestic | Active (route config only, no pricing yet) |
| Addis Ababa ↔ Dubai | International | Active; customs intelligence on |
| Dubai ↔ Addis Ababa | International | Active; customs intelligence on |

Route config behavior:
- Domestic routes: `international=false`, `customsIntelligence=false`
- Ethio↔Dubai: `international=true`, `customsIntelligence=true`, corridor code used for rule overrides

## 16. Deployment

| Item | Detail |
|---|---|
| Platform | Vercel Hobby |
| Live URL | `https://shanta-ygebrekidann-4376s-projects.vercel.app` |
| Stable URL | `https://shanta-ygebrekidann-4376s-projects.vercel.app` (canonical production) |
| Build command | `pnpm build` (migrations run separately via `pnpm db:deploy` from local) |
| Cron schedule | All 4 crons run daily (Hobby plan limit) |
| CI | GitHub Actions on `Yodan-Tech/Shanta`; typecheck + lint + tests + build + smoke E2E |
| CI status | Passing on commit `c8e8e95` (Open Camera selector fix) |
| Health check | `GET /api/v1/health` → `{"status":"ok","checks":{"database":"ok"}}` |

Cron jobs:

| Path | Schedule | Purpose |
|---|---|---|
| `/api/v1/cron/drain-notifications` | `0 6 * * *` | Drain notification outbox |
| `/api/v1/cron/check-stuck-shipments` | `0 7 * * *` | Alert on stale shipments |
| `/api/v1/cron/escrow-timeout` | `0 8 * * *` | Alert on long-held escrows |
| `/api/v1/cron/frequency-report` | `0 9 * * 0` | Recompute traveler frequency tiers |

## 17. Risk Register

| Risk | Current mitigation | Residual gap |
|---|---|---|
| Unwitting mule / contraband | Intake photo, contents-verification photo, tamper seal, traveler acknowledgment, pickup evidence | Route context loss weakens route-specific re-checks at later stages |
| Frequent travelers losing customs allowance | `TravelProfile` frequency tracking; low-frequency preference in matching | Seeded config key inconsistency (`frequency.tier_threshold_90d` vs `traveler.frequent_threshold_90d`) |
| Aggregator hub failure | `ON_HOLD`, `RETURNED_TO_SENDER`, manual admin transition | No hub-to-shipment linkage or hub management UI/API |
| SMS provider absent | Pluggable sender interface; `LoggingSmsSender` for dev | Real SMS not wired; `AT_API_KEY` not set in production |
| Telegram identity split from phone/email | Telegram profile linkage exists | Cross-channel account merging not implemented |
| Duplicate submissions / mobile retries | Idempotency keys; optimistic versioning | Some UI forms still use fragile flows |
| Admin errors / audit gaps | Immutable audit logs; manual transitions; full RLS | Admin provisioning has no UI (manual DB setup + Supabase user creation required) |
| Cold-start rate limit reset | In-memory sliding window in `src/proxy.ts` | Resets on cold start; not durable |
| Slow candidate matching at scale | Works for pilot load | Per-leg aggregates and category weight computed per candidate |
| Notification drain slowness | Fine for pilot | Sequential sending + per-row profile lookups |
| Receiver photo not persisted | Confirm page captures photo | API confirmation uses SMS token only; server does not enforce live photo |
| State name mismatch | `DELIVERY_CONFIRMED` is the DB state | UI calls it "pickup confirmation" — semantic drift |

## 18. Known Gaps (Implementation vs Intent)

| Gap | Where it shows | Why it matters |
|---|---|---|
| Sender flow is split across pages | `/send`, `/login`, `/verify`, `/shipments/new` | Not yet a continuous booking wizard |
| Email/phone OTP depend on Supabase client auth directly | `/login` and `/verify` | No custom auth API; depends on Supabase being configured correctly |
| Google / OAuth absent | No OAuth button or route | Diaspora friction remains higher than intended |
| Hub intake payload mismatch | `/hub/intake/[shipmentId]` | UI does not send `payload.itemWeights` JSON that the API expects |
| `Shipment` has no `corridorCode` | All shipment-related services | Route-specific customs rules and pricing tiers cannot be re-resolved after creation |
| Route behavior flags not fully wired | `RouteConfig.allowAggregationOnly`, `RouteConfig.currency` | Route behavior layer only partially active |
| AppConfig key inconsistency | `frequency.tier_threshold_90d` vs `traveler.frequent_threshold_90d` | Frequency tiering can drift depending on which key a job reads |
| Manifest diversity dormant | `assessManifestDiversity()` in domain | Carrier-protection logic present but no service invokes it |
| Real SMS not wired | `getSmsSender()` always returns `LoggingSmsSender` | OTP and receiver SMS are logged, not actually sent |
| Admin provisioning has no UI | `admin_users` requires manual DB insert + Supabase user creation | Admin setup is a fully manual process |
| Agent / hub management incomplete | `AIRPORT_AGENT`, `Hub` exist | No agent demand feed, no hub management UI/API, shipments not linked to hubs |
| Receiver reliability feature incomplete | `TravelerReliability` schema exists | Score computation cron not implemented; scores stay at defaults |
| `PricingTier` applied per item type | Schema + admin UI exist | Not yet wired into `ShipmentService` pricing calculation |
| Older docs describe pre-ADR stack | `docs/TRD.md`, `docs/ARCHITECTURE.md`, etc. | `shanta.md` and the Prisma schema are the authoritative source of truth |

## 19. What Shanta Is Not

| Not | Why not |
|---|---|
| E-commerce / shopping platform | Shanta moves items through travelers; not a marketplace for shopping carts |
| Licensed freight carrier | Platform coordinates peer travel capacity, not licensed freight |
| Customs broker | Encodes rules and compliance context; does not act as a broker |
| Payment provider | Manual hub escrow only; no payment rails built |
| Flight search / booking platform | Trips are user-posted capacity, not flight inventory |
| Real-time GPS tracker | Status updates and evidence used instead |
| Reputation leaderboard | Traveler reliability is ops-internal risk data; never a public score |
| Commercial document generator | No AWB, invoice, manifest, or customs document generation |
| Forex workaround or cash-movement tool | Cash is prohibited in the rules engine (Constraint 2.5) |
| Microservices / Kubernetes / GraphQL / websockets | Premature for current load and phase |
| Flutter mobile app | Not present in this repo |

## 20. Launch Checklist Status

Per `docs/LAUNCH_CHECKLIST.md`:

| Item | Status |
|---|---|
| Supabase production migrated and seeded | ✅ Done |
| Vercel env vars set | ✅ Done (core vars; Telegram + SMS vars still needed) |
| Health check passing | ✅ `{"status":"ok","database":"ok"}` |
| Vercel cron jobs visible | ✅ 4 daily crons configured |
| RLS policies applied | ✅ Done (zero security advisors) |
| Admin user in DB | ❌ Needs manual creation |
| SMS provider (OQ-10) | ❌ Blocking — `AT_API_KEY` not configured |
| Telegram bot (optional) | ❌ `TELEGRAM_BOT_TOKEN` not configured |
| Pilot corridor confirmed (OQ-5) | ❌ Founder decision pending |
| ≥5 KYC-verified travelers | ❌ Pilot operational requirement |
| ≥1 hub operator trained | ❌ Pilot operational requirement |
| Official customs regulation (OQ-3) | ❌ Pending; all rules currently marked unverified |

Last updated: **June 20, 2026** — reflects commits through `05423ff` (complete admin data intelligence stack).
