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
| Data | Supabase Postgres via Prisma |
| Files | Supabase Storage for handoff photos and KYC documents |
| Business logic | Server-side services under `src/lib/services/` plus pure domain code under `src/lib/domain/` |
| Admin | In-app admin dashboard and admin API routes |
| Receivers | SMS-first; no login required for pickup confirmation |
| Automation | Vercel Cron routes drain notifications and run operational checks |

What the code does not contain:

| Missing from repo | Notes |
|---|---|
| Flutter app | No Flutter source exists in this repo |
| Fastify API server | Route handlers are Next.js, not a separate Fastify app |
| Railway deployment | Vercel is the deployed web target in the codebase |
| R2 storage | Supabase Storage is the implemented storage backend |
| Custom OTP/refresh token system | Supabase Auth owns sessions and OTP |

## 3. The Four-Node Model

The data model keeps the four nodes separate, but some roles can overlap on the same person or entity.

| Node | Code representation | What it does |
|---|---|---|
| Node 1 - Sender | `Profile.roles` includes `SENDER` | Creates shipments and pays the quoted price |
| Node 2a - Traveler / Carrier | `Profile.roles` includes `TRAVELER`; `Trip` and `TripLeg` | Posts capacity and physically carries items |
| Node 2b - Agent | `Role.AIRPORT_AGENT` exists; `Trip.agentId` and `HubType.AGENT` exist | Coordinates supply, looks at sender demand to source the right traveler, and can overlap with a hub operator |
| Node 3 - Aggregator Hub | `Hub`, `HandoffRecord`, hub intake / verify / seal flows | Receives, inspects, seals, and consolidates shipments |
| Node 4 - Receiver | `Shipment.receiverName`, `receiverPhone`, optional `receiverUserId` | Confirms receipt, usually by SMS token and without the app |

Important code reality:

| Question | Code reality |
|---|---|
| Are Agent and Hub the same thing? | No. The code keeps them separate, but they can overlap in one real-world operator |
| Is the Agent role purely recruitment? | No. The code treats Agent as a coordinating supply node; there is no dedicated agent UI yet |
| Does one entity hold both roles? | Yes, the schema allows it conceptually via role flags and hub/operator relationships |

## 4. Shipment Flow

This is the implemented happy path in code, not the aspirational UX path.

| Step | Implemented path |
|---|---|
| 1 | Public landing routes sender traffic to `/send`, a preview-first page that asks for route and item details before auth |
| 2 | The sender reviews live route supply counts, search demand, and featured corridors |
| 3 | Auth is deferred until booking intent is clear; the login page carries route context forward |
| 4 | Telegram login is the primary sign-in path, with email OTP and phone OTP as alternatives |
| 5 | `/verify` completes the email or phone OTP flow and returns the user to the preserved booking context |
| 6 | After auth, the sender lands on `/shipments/new` with route/item fields prefixed from the draft |
| 7 | Sender creates a shipment through `/api/v1/shipments` |
| 8 | Route context is resolved from `RouteConfig` and rules are validated |
| 9 | Pricing is computed from `CorridorPricing` and stored in `Shipment.pricingSnapshot` |
| 10 | Shipment is created in `RULES_VALIDATED` and moved to `AWAITING_HUB_INTAKE` |
| 11 | Optional manual hub escrow is armed at creation time |
| 12 | Aggregator intake records photos, actual weights, and a cash check |
| 13 | Intake can advance to `AT_ORIGIN_HUB` or flag `WEIGHT_DISCREPANCY` |
| 14 | Aggregator verifies contents with photos, then seals the shipment |
| 15 | Sealing advances to `SEALED` and then `AWAITING_MATCH` |
| 16 | Matching finds eligible travelers, then assigns a trip leg |
| 17 | Traveler reviews sealed evidence, accepts custody, and escrow is marked HELD if present |
| 18 | Hub release creates the pickup handoff and sends the receiver a no-login pickup link |
| 19 | Receiver confirms pickup by SMS token; disputes go to `DISPUTED` |
| 20 | Admin can release or refund escrow, depending on outcome |

There is also an aggregation-only path:

| Branch | Implemented path |
|---|---|
| Aggregation-only | `SEALED -> CONSOLIDATED -> DELIVERED` without platform matching or traveler transit |

Code reality on the public UX:

| Expected product behavior | Current code behavior |
|---|---|
| Defer auth until after route/item exploration | Implemented via the public `/send` preview page |
| Preserve sender intent through auth | Implemented via `next` plus route/item query parameters |
| Route preview before sign-in | Implemented, but still separate from the final shipment creation form |

## 5. Tech Stack

| Layer | Actual tech in repo |
|---|---|
| Framework | Next.js 16 App Router |
| Runtime | React 19, TypeScript strict, Node 20 |
| Auth | Supabase Auth via `@supabase/ssr` and `@supabase/supabase-js` |
| Database | Supabase Postgres 16 via Prisma 6 |
| Storage | Supabase Storage |
| Validation | Zod |
| i18n | `next-intl` with `messages/en.json` and `messages/am.json` |
| Styling | Tailwind CSS v4 + Shadcn/ui-style primitives |
| Testing | Vitest for unit/integration logic, Playwright for smoke and e2e |
| Deployment | Vercel, with cron jobs in `vercel.json` |
| Session guard | `src/proxy.ts` refreshes Supabase sessions and rate limits sensitive paths |

Package scripts in `package.json`:

| Script | Purpose |
|---|---|
| `dev` | Start Next.js dev server |
| `build` | Build the app |
| `start` | Start production server |
| `lint` | ESLint |
| `typecheck` | `tsc --noEmit` |
| `test` | Vitest unit tests |
| `test:e2e` | Playwright suite |
| `test:smoke` | Playwright smoke test |
| `db:generate` | Prisma client generation |
| `db:migrate` | Prisma dev migration |
| `db:deploy` | Prisma deploy migration |
| `db:push` | Prisma db push |
| `db:seed` | Seed the database |
| `db:studio` | Prisma Studio |

## 6. Application Architecture

The repo is organized as a Next.js web app plus supporting domain, storage, and operational code.

| Directory | Role |
|---|---|
| `src/app` | Pages, layouts, server actions, and all `/api/v1` route handlers |
| `src/components` | Shared UI shell, logo, locale switcher, and design-system primitives |
| `src/lib/domain` | Pure business logic: state machine, rules engine, pricing, matching, escrow, notifications, shared types |
| `src/lib/services` | Transactional orchestration over repositories and domain logic |
| `src/lib/db` | Prisma repositories and in-memory test doubles |
| `src/lib/supabase` | Browser/server/service-role Supabase clients and middleware helpers |
| `src/lib/telegram` | Telegram login, webhook, bot router, and profile linkage |
| `src/lib/sms` | SMS sender port, templates, and webhook helpers |
| `src/lib/storage` | Handoff photo and KYC document validation/upload/signing |
| `src/lib/api` | Route validation schemas, error envelope, response helpers, upload parsing |
| `prisma` | Schema, seed, and migrations |
| `messages` | English and Amharic message bundles |
| `e2e` | Playwright smoke tests |
| `docs` | Product and architecture docs, many of which still describe the pre-ADR stack |
| `Branding` | Logo and brand assets |
| `prompts` | Role-specific agent prompts |

Key request path:

| Layer | Responsibility |
|---|---|
| Pages and forms | Collect input and call the API or server actions |
| Route handlers | Validate with Zod, enforce auth, call services, return `{ data }` / `{ error }` envelopes |
| Services | Orchestrate state transitions, rules, pricing, escrow, handoffs, matching |
| Repositories | Read/write Prisma models in transactions |
| Domain | Pure functions for state legality, rules, pricing, matching, escrow transitions |

Public and protected page surfaces in the app:

| Surface | Status |
|---|---|
| `/` | Public landing page |
| `/send` | Public preview-first sender flow |
| `/login`, `/verify` | Public multi-channel auth flow with Telegram, email OTP, and phone OTP |
| `/confirm` | Public receiver pickup confirmation page |
| `/hub/login`, `/hub/verify` | Hub operator login / OTP flow |
| `/onboarding` | Protected role selection |
| `/dashboard` | Protected sender/traveler chooser |
| `/shipments`, `/shipments/new`, `/shipments/[id]` | Protected sender flow |
| `/trips`, `/trips/new`, `/trips/[id]` | Protected traveler flow |
| `/hub`, `/hub/intake/[shipmentId]`, `/hub/[shipmentId]` | Protected aggregator flow |
| `/admin` and admin subpages | Protected admin area |

## 7. Data Models

Enums used by the schema and services:

| Enum | Values of note |
|---|---|
| `Role` | `SENDER`, `TRAVELER`, `AGGREGATOR`, `RECEIVER`, `AIRPORT_AGENT` |
| `TravelerTier` | `CASUAL`, `PROFESSIONAL` |
| `KycStatus` | `UNVERIFIED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED` |
| `TripStatus` | `DRAFT`, `ACTIVE`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `TripLegStatus` | `ACTIVE`, `FULL`, `CANCELLED`, `COMPLETED` |
| `HubType` | `ORIGIN`, `TRANSIT`, `DESTINATION`, `AGENT` |
| `HubStatus` | `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`, `CLOSED` |
| `ShipmentStatus` | Full multi-hop lifecycle plus dispute / hold / return states |
| `HandoffType` | Sender/hub/traveler/receiver custody transfer types |
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

Core tables:

| Model | Purpose | Key fields |
|---|---|---|
| `Profile` | End-user identity keyed to `auth.users.id` | `id`, `phone`, `email`, `telegramUserId`, `fullName`, `roles[]`, `travelerTier`, `kycStatus`, `kycMethod`, `preferredLanguage`, `countryCode`, `status`, `deletedAt` |
| `TravelProfile` | Per-traveler risk/frequency tracking | `userId`, `tripCountLast30Days`, `tripCountLast90Days`, `tripCountLifetime`, `lastTripAt`, `customsFrequencyTier`, `riskFlags` |
| `AdminUser` | Admin staff lookup keyed to `auth.users.id` | `id`, `email`, `role`, `active`, `lastLoginAt` |
| `Trip` | Traveler trip container | `travelerId`, `status`, `mode`, `agentId`, `countryCode`, `version`, `deletedAt` |
| `TripLeg` | One leg of a trip | `tripId`, `sequence`, `originRegion`, `destinationRegion`, `originHubId`, `destinationHubId`, `departAt`, `arriveAt`, `totalCapacityKg`, `availableCapacityKg`, `status` |
| `Hub` | Physical aggregation / operator location | `name`, `operatorUserId`, `hubTypes[]`, `region`, `address`, `geoLat`, `geoLng`, `operatingHours`, `status`, `countryCode` |
| `Shipment` | End-to-end delivery record | `senderId`, `receiverName`, `receiverPhone`, `receiverUserId`, `originRegion`, `destinationRegion`, `serviceType`, `status`, `version`, `idempotencyKey`, pricing fields, `pricingSnapshot`, `insuranceOptedIn`, `currency`, `countryCode`, `deletedAt` |
| `ShipmentLeg` | One hop of a shipment | `shipmentId`, `sequence`, `tripLegId`, `originHubId`, `destinationHubId`, `travelerId`, `status`, `version` |
| `Item` | Physical item in a shipment | `shipmentId`, `shipmentLegId`, `category`, `description`, `quantity`, `declaredWeightKg`, `actualWeightKg`, `declaredValueEtb`, `sealId`, `deletedAt` |
| `HandoffRecord` | Immutable custody evidence | `shipmentId`, `shipmentLegId`, `handoffType`, `fromActorId`, `toActorId`, `photoUrls`, `videoUrl`, `captureMethod`, `acknowledgmentText`, `acknowledged`, `sealApplied`, `sealId`, `sealIntact`, `geoLat`, `geoLng`, `capturedAt` |
| `ItemRestriction` | Configurable customs rule | `itemCategory`, `corridorCode`, `corridorOverrideOf`, `maxWeightKg`, `maxValueEtb`, `maxUnitsPerTraveler`, `dutyApplies`, `dutyNote`, `frequencySensitive`, `maxWeightKgFrequent`, `requiresDeclaration`, `requiresSpecialPermit`, `prohibited`, `direction`, `sourceRegulation`, `effectiveFrom`, `effectiveUntil`, `countryCode` |
| `RestrictionCheck` | Audit of rules evaluation | `shipmentId`, `itemId`, `trigger`, `result`, `failedRuleId`, `detail`, `travelerFrequencyTier` |
| `EscrowRecord` | Manual or future automated money hold | `shipmentId`, `amountEtb`, `currency`, `holderType`, `holderId`, `status`, `releaseCondition`, `heldAt`, `releasedAt`, `refundedAt`, `releasedBy`, `providerRef` |
| `CorridorPricing` | Versioned price config per route | `originRegion`, `destinationRegion`, `ratePerKgEtb`, `minChargeEtb`, `aggregatorFlatFeeEtb`, `platformCommissionRate`, `insuranceRate`, `taxRate`, `effectiveFrom`, `effectiveUntil`, `countryCode` |
| `Notification` | Outbox row for SMS / Telegram / push | `userId`, `recipientPhone`, `channel`, `templateKey`, `payload`, `language`, `status`, `attempts`, `providerRef`, `sentAt` |
| `ShipmentStatusHistory` | Append-only shipment transition log | `shipmentId`, `fromStatus`, `toStatus`, `actorType`, `actorId`, `handoffRecordId`, `reason`, `createdAt` |
| `AuditLog` | Immutable admin/system audit log | `actorType`, `actorId`, `action`, `entityType`, `entityId`, `beforeState`, `afterState`, `metadata`, `ipAddress` |
| `WebhookLog` | Inbound webhook processing log | `provider`, `eventType`, `eventId`, `payload`, `signatureValid`, `processedAt`, `processingError` |
| `AppConfig` | Runtime config / feature flags | `key`, `value`, `description`, `updatedAt`, `updatedBy` |
| `OperationalNote` | Human note on a profile or shipment | `entityType`, `entityId`, `note`, `createdBy`, `createdAt` |
| `IdempotencyKey` | Mutating-request dedupe store | `key`, `scope`, `responseBody`, `createdAt` |
| `RouteConfig` | Route behavior layer | `code`, `originRegion`, `destinationRegion`, `international`, `currency`, `customsIntelligence`, `allowAggregationOnly`, `config`, `active`, `countryCode` |
| `DemandSignal` | Search / unmet demand capture | `originRegion`, `destinationRegion`, `itemCategory`, `source`, `actorId`, `detail`, `countryCode` |
| `CustomsEvent` | Actual customs outcome capture | `shipmentId`, `itemCategory`, `originRegion`, `destinationRegion`, `outcome`, `travelerFrequencyTier`, `taxAmountEtb`, `detail`, `recordedBy`, `countryCode` |

Important schema fact:

| Fact | Reality |
|---|---|
| There is no `User` table | `Profile` is the domain user table keyed to `auth.users.id` |
| There are no custom OTP or refresh-token models | Supabase Auth owns those concerns |
| `countryCode` is present broadly | This is a Phase 3 seed for multi-tenancy |
| `Shipment` does not store `corridorCode` | Route context is resolved at create time, then lost for later stages |

## 8. API Reference

All API routes live under `/api/v1`. Responses use the envelope `{ data: ... }` on success and `{ error: { code, message, correlation_id, details? } }` on failure.

Public sender/auth UX does not go through a custom auth API for email or phone OTP. The client uses Supabase Auth directly for those channels, then `/verify` finishes the OTP exchange and restores the draft booking context. Telegram login is the only public auth path that hits a custom API route.

### Public or no-login routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/health` | none | Liveness check |
| `POST` | `/api/v1/delivery/confirm` | none, SMS token only | Receiver confirms pickup at the hub or reports a problem |
| `POST` | `/api/v1/auth/telegram` | Telegram widget signature + bot token | Mint a Supabase session from a verified Telegram login |
| `POST` | `/api/v1/telegram/webhook` | Telegram webhook secret | Telegram bot webhook for the self-serve bot |

### Sender / traveler / aggregator routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/shipments` | `Role.SENDER` | Create a shipment, validate rules, compute price, optionally arm escrow |
| `GET` | `/api/v1/shipments` | `Role.SENDER` | List the current sender's shipments |
| `GET` | `/api/v1/shipments/:id` | `Role.SENDER` | Fetch one sender-owned shipment |
| `POST` | `/api/v1/shipments/:id/intake` | `Role.AGGREGATOR` | Hub intake with photos, actual weights, and cash check |
| `POST` | `/api/v1/shipments/:id/verify` | `Role.AGGREGATOR` | Contents verification with photos |
| `POST` | `/api/v1/shipments/:id/seal` | `Role.AGGREGATOR` | Apply tamper seal and queue for matching |
| `POST` | `/api/v1/shipments/:id/match` | `Role.AGGREGATOR` | Assign a ranked traveler trip leg |
| `POST` | `/api/v1/shipments/:id/review` | `Role.TRAVELER` | Traveler reviews sealed evidence |
| `POST` | `/api/v1/shipments/:id/accept` | `Role.TRAVELER` | Traveler accepts custody |
| `POST` | `/api/v1/shipments/:id/reject` | `Role.TRAVELER` | Traveler rejects custody and re-queues shipment |
| `POST` | `/api/v1/shipments/:id/out-for-delivery` | `Role.AGGREGATOR` | Move the shipment into pickup-ready release state |
| `POST` | `/api/v1/shipments/:id/delivery-attempted` | `Role.TRAVELER` | Record a failed delivery attempt |
| `POST` | `/api/v1/shipments/:id/deliver` | `Role.AGGREGATOR` | Release the shipment for destination pickup, capture evidence, and mint receiver token |
| `POST` | `/api/v1/shipments/:id/transition` | admin only | Manual state transition for operations / runbook use |
| `POST` | `/api/v1/trips` | `Role.TRAVELER` | Publish a trip with one or more legs |
| `GET` | `/api/v1/trips` | `Role.TRAVELER` | List the current traveler's trips |
| `GET` | `/api/v1/matching` | `Role.AGGREGATOR` | Find ranked eligible travelers for a route and item |
| `GET` | `/api/v1/rules` | any authenticated user | Get active item-restriction rules for the user's country |
| `POST` | `/api/v1/kyc/submit` | any authenticated user | Upload KYC identity document and submit for review |

### Admin routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/admin/launch-gate` | `AdminRole.OPERATIONS` or `SUPER_ADMIN` | Launch readiness gate metrics |
| `GET` | `/api/v1/admin/kpis` | `AdminRole.OPERATIONS` or `SUPER_ADMIN` | Core KPI dashboard |
| `GET` | `/api/v1/admin/shipments` | `AdminRole.OPERATIONS` or `SUPER_ADMIN` | Paginated shipment list |
| `GET` | `/api/v1/admin/disputes` | `AdminRole.OPERATIONS` or `SUPER_ADMIN` | Open disputes with escrow and evidence chain |
| `GET` | `/api/v1/admin/audit` | `AdminRole.SUPER_ADMIN` | Audit log query |
| `GET` | `/api/v1/admin/escrow` | `AdminRole.FINANCE` or `SUPER_ADMIN` | Paginated escrow list |
| `POST` | `/api/v1/admin/escrow/:id/release` | `AdminRole.FINANCE` or `SUPER_ADMIN` | Release HELD escrow after pickup confirmation |
| `POST` | `/api/v1/admin/escrow/:id/refund` | `AdminRole.FINANCE` or `SUPER_ADMIN` | Refund a non-settled escrow |
| `GET` | `/api/v1/admin/kyc/queue` | `AdminRole.KYC_REVIEWER` or `SUPER_ADMIN` | Pending KYC queue with signed document URLs |
| `POST` | `/api/v1/admin/kyc/:userId/approve` | `AdminRole.KYC_REVIEWER` or `SUPER_ADMIN` | Approve KYC |
| `POST` | `/api/v1/admin/kyc/:userId/reject` | `AdminRole.KYC_REVIEWER` or `SUPER_ADMIN` | Reject KYC |
| `GET` | `/api/v1/admin/rules` | `AdminRole.OPERATIONS` or `SUPER_ADMIN` | List item restrictions |
| `POST` | `/api/v1/admin/rules` | `AdminRole.SUPER_ADMIN` | Create an item restriction |
| `PUT` | `/api/v1/admin/rules/:id` | `AdminRole.SUPER_ADMIN` | Update an item restriction |
| `DELETE` | `/api/v1/admin/rules/:id` | `AdminRole.SUPER_ADMIN` | Soft-expire an item restriction |
| `GET` | `/api/v1/admin/users` | `AdminRole.OPERATIONS` or `SUPER_ADMIN` | Paginated profile list |
| `POST` | `/api/v1/admin/users/:userId/suspend` | `AdminRole.OPERATIONS` or `SUPER_ADMIN` | Suspend a user |
| `GET` | `/api/v1/admin/intelligence/demand` | `AdminRole.OPERATIONS` | Demand / unmet-demand analytics |
| `GET` | `/api/v1/admin/intelligence/supply` | `AdminRole.OPERATIONS` | Supply and frequency analytics |
| `GET` | `/api/v1/admin/intelligence/routes` | `AdminRole.OPERATIONS` | Shipment volume and completion by route |
| `GET` | `/api/v1/admin/intelligence/customs` | `AdminRole.OPERATIONS` | Customs outcomes and rule-flag analytics |
| `POST` | `/api/v1/admin/intelligence/customs` | `AdminRole.OPERATIONS` | Record a real customs outcome |

### Cron routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/cron/drain-notifications` | `CRON_SECRET` bearer | Drain the notification outbox |
| `GET` | `/api/v1/cron/check-stuck-shipments` | `CRON_SECRET` bearer | Alert on stale shipments |
| `GET` | `/api/v1/cron/escrow-timeout` | `CRON_SECRET` bearer | Alert on HELD escrows older than the timeout |
| `GET` | `/api/v1/cron/frequency-report` | `CRON_SECRET` bearer | Recompute traveler frequency tiers |

Route shape notes:

| Endpoint | Actual request shape |
|---|---|
| `POST /api/v1/shipments` | JSON body with `receiverName`, `receiverPhone`, `originRegion`, `destinationRegion`, `insuranceOptedIn`, `items[]`; `Idempotency-Key` header supported |
| `POST /api/v1/shipments/:id/intake` | Multipart form with `photo` files and `payload` JSON containing `itemWeights[]`, `cashChecked`, optional geo |
| `POST /api/v1/shipments/:id/verify` | Multipart form with `photo` files |
| `POST /api/v1/shipments/:id/seal` | Multipart form with `photo` files and `payload` JSON containing `sealId` |
| `POST /api/v1/shipments/:id/deliver` | Multipart form with `photo` files and `payload` JSON containing `captureMethod` and optional geo; used by the hub release step before receiver pickup |
| `POST /api/v1/shipments/:id/accept` | JSON body with `acknowledgmentText` and `sealIntact` |
| `POST /api/v1/delivery/confirm` | JSON body with `token`, `problem`, optional `reason` |
| `POST /api/v1/kyc/submit` | Multipart form with `id_document` file |

## 9. Auth Model

| Auth path | Implemented behavior |
|---|---|
| Public user login | Public `/login` page offers Telegram login first, then email OTP and phone OTP |
| OTP verification | `/verify` completes the email or phone OTP flow and restores the draft booking context |
| Telegram login | `POST /api/v1/auth/telegram` verifies a Telegram login widget payload and mints a Supabase session |
| Telegram bot | `POST /api/v1/telegram/webhook` accepts signed Telegram updates and routes self-serve commands |
| Receiver confirmation | No login; pickup token in SMS link is the authorization |
| Admin access | `requireAdmin()` / `requireApiAdminRole()` check that the Supabase auth user id exists in `admin_users` |

How profiles work:

| Behavior | Code reality |
|---|---|
| Primary identity | `Profile.id` equals `auth.users.id` |
| First sign-in | `getOrCreateProfile()` upserts the profile and mirrors phone/email |
| Default role | New profiles get `[RECEIVER]` only |
| Onboarding | `saveRoles()` persists `SENDER`, `TRAVELER`, or `AGGREGATOR` and removes the onboarding block |
| Active role gate | `requireActiveRole()` redirects profiles with only `RECEIVER` to `/onboarding` |

Supported login options in the repo right now:

| Option | Status |
|---|---|
| Telegram login | Implemented in the public UI and API |
| Email OTP | Implemented in the public UI via Supabase Auth and completed in `/verify` |
| Phone OTP | Implemented in the public UI via Supabase Auth and completed in `/verify` |
| Google / OAuth | Not implemented |

Implementation detail:

| Admin auth detail | Reality |
|---|---|
| Admin record shape | `AdminUser` contains `id`, `email`, `role`, `active`, `lastLoginAt` |
| Separate admin session model | Not implemented as a distinct auth system in code |
| Password / TOTP fields | Not present in the Prisma schema |

Session and route guarding:

| Mechanism | Role |
|---|---|
| `src/proxy.ts` | Refreshes Supabase session and redirects unauthenticated page visits |
| `requireProfile` / `requireAdmin` | Page-level server guards |
| `requireApiProfile` / `requireApiRole` / `requireApiAdminRole` | API route guards |
| `signOut` server action | Logs the user out and returns to `/` |

## 10. Customs & Regulatory Rules

The rules engine is data-driven through `ItemRestriction` rows. Current seeded restrictions are compliance-positive and marked as unverified secondary research until the official regulation is confirmed.

Seeded rule set:

| Category / route | Implemented rule |
|---|---|
| Coffee | 2 kg exit cap, declaration required, special permit required |
| Spices | 5 kg cap |
| Butter | 5 kg cap |
| Jewelry | 100 g for non-frequent travelers, 50 g for frequent travelers, declaration required |
| Cash | Prohibited outright |
| Electronics | Declaration required |
| Pharma | Prohibited in Phase 1 |
| Plastic drums | Prohibited on the Addis inbound corridor |
| Laptop on Dubai -> Ethiopia | 1 unit per traveler, declaration required, duty transparency surfaced |
| Phone on Dubai -> Ethiopia | 2 units per traveler, declaration required, duty transparency surfaced |
| Cosmetics on Dubai -> Ethiopia | 5 kg guideline, duty transparency surfaced |
| Baby products on Dubai -> Ethiopia | 10 kg guideline |
| Clothing on Dubai -> Ethiopia | 15 kg guideline |

How the engine works:

| Rule behavior | Code reality |
|---|---|
| Resolution order | Corridor-specific active rule wins over the base rule |
| Direction | `ENTRY`, `EXIT`, `BOTH` are respected in the pure engine |
| Frequency sensitivity | Jewelry uses the stricter cap for frequent travelers |
| Unit caps | `maxUnitsPerTraveler` is enforced as an aggregate across the shipment |
| Evaluation points | Submission, hub intake, and re-match are supported by the domain model |
| Transparency | `dutyApplies` and `dutyNote` are surfaced as compliance context, not as evasion guidance |

Current enforcement coverage:

| Stage | Enforced today |
|---|---|
| Shipment creation | Yes |
| Hub intake | Yes, on actual weighed values |
| Traveler matching | Yes, but corridor context is not persisted on the shipment |
| Route-specific later re-checks | Partial; route context is lost after create |

Important code gaps in this area:

| Gap | Effect |
|---|---|
| `Shipment` does not persist corridor code | Later stages cannot fully re-resolve route-specific customs rules |
| `RouteConfig.allowAggregationOnly` is not enforced | The route behavior layer is not fully wired into service enforcement |
| `RouteConfig.currency` is not threaded into pricing | International currency behavior is not implemented in the money flow |
| Manifest diversity checks exist in domain code but are not wired into services | Carrier-protection logic is present but dormant |
| `crowding.max_distinct_senders_per_category` is seeded but not enforced | Only weight-based crowding is currently active |

## 11. Payments & Escrow

Pricing is ETB-denominated in the current code.

| Component | Behavior |
|---|---|
| Carrier fee | Weight-based with a minimum charge |
| Aggregator fee | Flat fee |
| Platform fee | Commission on carrier + aggregator fee |
| Insurance | Optional, based on declared value |
| Tax | Present in the model, currently seeded at 0 |

Escrow behavior:

| Step | Code reality |
|---|---|
| Create shipment | Optional manual hub escrow may be armed immediately |
| Default mode | HUB holder, not payment-provider settlement |
| Custody transfer to traveler | Escrow, if present, is marked HELD |
| Receiver confirmation | Admin can release only after the existing `DELIVERY_CONFIRMED` status is reached, even though the UI frames it as pickup confirmation |
| Dispute | Escrow remains HELD; there is no auto-release on dispute |
| Cancellation / return | Admin can refund a non-settled hold |

Escrow model details:

| Field | Meaning |
|---|---|
| `holderType` | `HUB` today; `PAYMENT_PROVIDER` exists for future automation |
| `holderId` | Hub id or provider reference |
| `releaseCondition` | Human-readable release rule stored with the record |

Code reality:

| Question | Answer from the repo |
|---|---|
| Is payment automation implemented? | No |
| Is cross-border settlement implemented? | No |
| Is manual hub escrow implemented? | Yes |
| Is escrow optional? | Yes; shipment flow can proceed without an escrow record |

## 12. Risk Register

| Risk | Current mitigation | Residual gap |
|---|---|---|
| Unwitting mule / hidden contraband | Intake photo, contents verification photo, tamper seal, traveler acknowledgment, pickup evidence | Route context loss weakens later route-specific re-checks |
| Frequent travelers lose customs allowance | `TravelProfile` frequency tracking and low-frequency ranking in matching | Seeded threshold key mismatch and no public exposure of risk data |
| Aggregator hub failure | `ON_HOLD`, `RETURNED_TO_SENDER`, manual admin transition | No real hub-to-shipment linkage or hub management workflow |
| SMS provider absence | Logging SMS sender + pluggable sender interface | Real SMS is not wired; launch SMS paths are not production-real |
| Telegram / phone identity split | Telegram profile linkage exists | Cross-channel account merging is not implemented |
| Duplicate submissions and mobile retries | Idempotency keys and optimistic versioning | Some UI forms still use hard-coded / fragile flows |
| Admin errors | Audit logs and manual transitions | Missing admin pages and some broken admin links |
| Cold-start rate limit reset | In-memory sliding window in `src/proxy.ts` | Reset on cold start; not durable at scale |
| N+1 candidate matching | Works for pilot load | Scales poorly because each candidate computes category weight separately |
| Notification drain serializes work | Fine for pilot | Sequential sending and per-row profile lookups will become slow |

## 13. Launch Corridors & Go-to-Market

Seeded corridors in the code:

| Corridor | Status in seed data |
|---|---|
| Addis Ababa -> Hawassa | Seeded corridor pricing |
| Addis Ababa -> Dire Dawa | Seeded corridor pricing |
| Addis Ababa -> Bahir Dar | Seeded corridor pricing |
| Addis Ababa -> Adama | Seeded corridor pricing |
| Addis Ababa -> Mekelle | Seeded corridor pricing |
| Hawassa -> Addis Ababa | Seeded corridor pricing |
| Dire Dawa -> Addis Ababa | Seeded corridor pricing |
| Addis Ababa -> Dubai | Seeded corridor pricing and route config |
| Dubai -> Addis Ababa | Seeded corridor pricing and route config |

Route behavior:

| Route config | Code reality |
|---|---|
| Domestic routes | `international=false`, `customsIntelligence=false` |
| Ethio-Dubai routes | `international=true`, `customsIntelligence=true` |
| Corridor code | Used as the route behavior key and rule override key |

Go-to-market mechanics present in the code:

| Surface | What it does |
|---|---|
| Landing page | Sender / traveler choice plus hub login hint |
| Telegram bot | Browse travelers, see packable caps, post send/trip, check status, set language |
| Admin launch gate | Shows readiness metrics and open questions |
| Hub queue | Shows shipments waiting for intake / verification / sealing |
| Admin intelligence | Captures demand, supply, route volume, and customs outcomes |

Code reality on corridor choice:

| Topic | Reality |
|---|---|
| Launch corridor selection | Still an operator decision; the code is corridor-agnostic at the service layer |
| Hard-coded UI route lists | Present in `shipments/new` and `trips/new` as a limited subset |
| Route-config-driven UI | Not implemented |

## 14. UX Principles

These are the principles the codebase tries to express, even when the implementation is incomplete.

| Principle | Current expression in code |
|---|---|
| Trust first | Price breakdown, status badges, photo evidence, seal tracking, audit logs |
| Mobile first | Responsive layouts, large touch targets, camera capture on hub and receiver screens |
| Bilingual | Locale cookie and EN/AM message bundles |
| Low bandwidth | Photos are the primary evidence; no GPS tracking; SMS-first receiver confirmation |
| Human language | Some screens use warm copy, but many remain hard-coded English |
| Auth deferred | Implemented in `/send` and preserved through `/login` and `/verify` |

What is actually visible on screen:

| Screen family | Current shape |
|---|---|
| Landing | Brand hero with sender, traveler, and hub entry points |
| Send preview | Public route/item preview with carrier counts and a context-preserving auth handoff |
| Login / verify | Telegram, email OTP, and phone OTP screens |
| Dashboard | Sender/traveler chooser |
| Shipment creation | Hard-coded route selector, item form, and client-side price preview |
| Trip creation | Hard-coded route selector and capacity form |
| Hub intake | Step-by-step photo / weight / seal workflow |
| Confirm pickup | SMS-token pickup confirmation, with optional dispute path |
| Admin | KPI dashboard plus KYC, shipments, rules, escrow, disputes, audit, and intelligence pages |

## 15. What Shanta Is Not

| Not | Why not |
|---|---|
| E-commerce / personal shopping platform | Shanta moves items through travelers; it is not a marketplace for shopping carts |
| Licensed freight carrier | The platform coordinates peer travel capacity, not licensed freight operations |
| Customs broker | It encodes rules and compliance context; it does not act as a broker |
| Payment provider | Escrow is manual hub-held today; payment rails are not built here |
| Flight search / booking platform | Trips are user-posted capacity, not flight inventory |
| Warehouse operator | Hubs are partner-operated consolidation points, not Shanta-owned warehouses |
| Real-time GPS tracker | Status updates and evidence are used instead |
| Microservices / Kubernetes / GraphQL / websockets | Premature for the current codebase |
| Flutter mobile app | Not present in this repo |
| Reputation leaderboard | Traveler frequency is internal risk data only |
| Commercial document generator | No AWB, invoice, manifest, or customs document generation |
| Forex workaround or cash-movement tool | Cash is prohibited in the rules engine |
| Email/password-first app | Not the implemented public login model |

## 16. Open Questions / Known Gaps

This section is intentionally blunt. It records the places where code, docs, and product intent do not yet line up.

| Gap | Where it shows up | Why it matters |
|---|---|---|
| Sender flow is split across multiple pages | `/send`, `/login`, `/verify`, and `/shipments/new` | The preview-first flow exists, but it is still not one continuous booking wizard |
| Email and phone OTP rely on Supabase client auth | `/login` and `/verify` | There is no custom auth API for those channels, so the UI depends on Supabase being configured correctly |
| Google sign-in is absent | No OAuth route or button exists | Diaspora friction remains higher than intended |
| Hub intake payloads are stale | `/hub/intake/[shipmentId]` and `/hub/[shipmentId]` do not send the `payload.itemWeights` JSON expected by the API | The visible hub UI and the server contract are out of sync |
| Admin navigation points at missing pages | `/admin/escrow`, `/admin/users`, shipment detail pages, and KYC reject pages are linked but not implemented | Several admin links can 404 |
| Route context is not persisted on shipments | `Shipment` has no `corridorCode` or route reference | Later customs / matching stages cannot fully re-resolve route-specific rules |
| Route behavior flags are not fully enforced | `RouteConfig.allowAggregationOnly` and `RouteConfig.currency` are not threaded through all flows | The route behavior layer is only partially active |
| Seeded config keys are inconsistent | `frequency.tier_threshold_90d` vs `traveler.frequent_threshold_90d` | Frequency tiering can drift depending on which key a job reads |
| Crowding beyond weight is not enforced | `crowding.max_distinct_senders_per_category` is seeded, but not used | Commercial-looking manifests are only partially constrained |
| Manifest diversity logic is dormant | `assessManifestDiversity()` exists, but no service calls it | Carrier-protection logic is present in domain code only |
| SMS delivery is not real yet | `getSmsSender()` always returns `LoggingSmsSender` | OTP and receiver SMS are not production-real in the repo |
| Admin auth is incomplete operationally | `AdminUser` is a lookup table, but there is no admin login UI or admin provisioning flow | Admin access depends on external Supabase user creation plus DB setup |
| Agent / hub management is incomplete | `AIRPORT_AGENT` and `Hub` exist, but there is no agent demand feed or hub management UI/API and shipments are not linked to hubs | The physical hub and agent workflow is under-wired |
| Receiver photo evidence is not persisted | `confirm` page captures a photo but the API confirmation uses only the SMS token | Live proof at confirmation is not enforced server-side |
| Internal status names still say delivery | `DELIVERY_CONFIRMED` remains the state name even though the UI now says pickup | The code and the product language are semantically out of sync |
| Matching has avoidable inefficiency | `searchCandidates()` does per-leg aggregates, and notification draining is sequential | Fine for pilot load, but poor scaling characteristics |
| Older docs still describe the pre-ADR stack | `docs/TRD.md`, `docs/ARCHITECTURE.md`, and others still mention Fastify / Flutter / R2 / Railway | This file and the Prisma schema should be treated as the current source of truth |

Last updated: June 18, 2026
