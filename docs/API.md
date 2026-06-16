# SHANTA — API Reference (v1)

> The HTTP contract the web UI binds to. Built as Next.js Route Handlers under
> `src/app/api/v1/`, backed by the services in `src/lib/services/` and the pure domain
> core in `src/lib/domain/`. This doc is the source for the UI-generation prompt
> ([prompts/UI_GENERATION_PROMPT.md](../prompts/UI_GENERATION_PROMPT.md)).

## Conventions

- **Base path:** `/api/v1`.
- **Auth:** Supabase Auth session via cookies (`@supabase/ssr`). The web UI is the same
  Next.js app, so the session cookie flows automatically — no bearer header needed. Each
  route resolves the current `profile` (created on first sign-in) and checks role.
- **Envelope:**
  - Success → `{ "data": <payload> }`
  - Error → `{ "error": { "code", "message", "correlation_id", "details"? } }`
- **Error codes → HTTP status:** `BAD_REQUEST` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 ·
  `NOT_FOUND` 404 · `CONFLICT` 409 · `VALIDATION_FAILED`/`UNPROCESSABLE`/`RULES_FAILED` 422 ·
  `INTERNAL` 500.
- **Money:** ETB, two decimals. **Timestamps:** ISO-8601 UTC. **IDs:** UUID.
- **Idempotency:** `POST /shipments` accepts an `Idempotency-Key` header (or body field);
  a repeat returns the original shipment.
- **Concurrency:** state transitions require `expectedVersion`; a mismatch → `409 CONFLICT`
  (reload and retry).

## Roles

A user (`profile`) holds a set of roles: `SENDER`, `TRAVELER`, `AGGREGATOR`, `RECEIVER`.
Admin endpoints require a separate `admin_users` record with an `AdminRole`
(`SUPER_ADMIN`, `OPERATIONS`, `KYC_REVIEWER`, `FINANCE`); `SUPER_ADMIN` satisfies any
role-gated admin endpoint. Receivers are SMS-first and don't need the app.

---

## Endpoints

### `GET /api/v1/health` — liveness (no auth)
→ `200 { "status": "ok"|"degraded", "timestamp", "checks": { "database": "ok"|"error" } }`
(`503` when degraded.)

### `POST /api/v1/shipments` — create a shipment · role: SENDER
Runs the rules engine (Constraint 2.4) and computes price, then advances the shipment
`RULES_VALIDATED → AWAITING_HUB_INTAKE`. **When escrow is available** it also arms a manual hub
escrow (`EscrowRecord` PENDING for the quoted total, `holderType: HUB`) atomically with the
transition (OQ-1). **Escrow is optional** — it can't always be provided; pass `"escrow": false`
(or set the `escrow.enabled` AppConfig to `0`) and the shipment still moves, just with no
money-hold. The returned shipment is in `AWAITING_HUB_INTAKE` at `version: 1` either way.
Headers: `Idempotency-Key: <uuid>` (recommended).
Request:
```json
{
  "receiverName": "Almaz",
  "receiverPhone": "+251911223344",
  "originRegion": "Addis Ababa",
  "destinationRegion": "Hawassa",
  "insuranceOptedIn": false,
  "items": [
    { "category": "CLOTHING", "description": "shirts", "declaredWeightKg": 3, "declaredValueEtb": 2000 }
  ]
}
```
→ `201 { "data": { "shipment": { "id", "status": "AWAITING_HUB_INTAKE", "version": 1, "items": [...], "totalPriceEtb", ... }, "price": { "carrierFeeEtb", "aggregatorFeeEtb", "platformFeeEtb", "insurancePremiumEtb", "taxAmountEtb", "totalPriceEtb", "currency" } } }`
Errors: `422 RULES_FAILED` (a prohibited/over-limit item — `details.items` lists failures);
`422 UNPROCESSABLE` (no corridor pricing); `422 VALIDATION_FAILED`.

### `GET /api/v1/shipments` — list my shipments · role: SENDER
→ `200 { "data": [ { "id", "status", "originRegion", "destinationRegion", "totalPriceEtb", "createdAt" }, ... ] }`

### `GET /api/v1/shipments/:id` — get one of my shipments · role: SENDER
→ `200 { "data": { ...shipment, "items": [...] } }` · `404 NOT_FOUND` if not owned.

### `POST /api/v1/shipments/:id/transition` — manual state transition · ADMIN
For RUNBOOK/manual operations. Safety-critical user transitions get dedicated endpoints later.
Request:
```json
{ "toStatus": "AWAITING_HUB_INTAKE", "expectedVersion": 0, "reason": "manual advance", "context": { "adminReviewed": true } }
```
→ `200 { "data": { ...shipment } }` · `409 CONFLICT` (version) · `409`/`422` (illegal/guarded transition).

### Hub verification chain (Constraint 2.2) · role: AGGREGATOR
Three `multipart/form-data` endpoints. Each derives its guard context **server-side** from the
uploaded evidence (never a client flag), validates photos by **magic bytes** (non-images → `422`),
stores them in the **private** `handoff-photos` bucket, writes an immutable `HandoffRecord`, and
advances the shipment via the guarded state machine. Order is structurally enforced: verify is
impossible before intake; seal is impossible before verify.

#### `POST /api/v1/shipments/:id/intake`
Form fields: `photo` (≥1 image) + `payload` JSON `{ "itemWeights":[{"itemId","actualWeightKg"}], "cashChecked": true, "geoLat"?, "geoLng"? }`.
Weighs the parcel, requires an explicit **cash check** (2.5), **re-runs the rules engine on actual
weights** (2.4), and advances `AWAITING_HUB_INTAKE → AT_ORIGIN_HUB`. If `|actual−declared| total`
exceeds the `intake.weight_discrepancy_threshold_kg` AppConfig, or the re-check fails → `WEIGHT_DISCREPANCY`.
→ `200 { "data": { "handoff": {...}, "shipment": { "status": "AT_ORIGIN_HUB"|"WEIGHT_DISCREPANCY" }, "weightDiscrepancy": bool, "restriction": {...} } }`
Errors: `422 UNPROCESSABLE` (no photo / cashChecked false / missing weight / illegal state); `422` (non-image upload).

#### `POST /api/v1/shipments/:id/verify`
Form fields: `photo` (≥1 contents image). Advances `AT_ORIGIN_HUB → CONTENTS_VERIFIED`.
→ `200 { "data": { "handoff": {...}, "shipment": { "status": "CONTENTS_VERIFIED" } } }`
Errors: `422` (no photo); `409 CONFLICT` (not in AT_ORIGIN_HUB — illegal transition).

#### `POST /api/v1/shipments/:id/seal`
Form fields: `photo` (≥1 seal image) + `payload` JSON `{ "sealId" }`. Only valid after verification;
stamps the seal id on every item and advances `CONTENTS_VERIFIED → SEALED → AWAITING_MATCH`.
→ `200 { "data": { "handoff": { "sealApplied": true, "sealId" }, "shipment": { "status": "AWAITING_MATCH" } } }`
Errors: `422` (no seal id / no photo); `409 CONFLICT` (sealing before verification — illegal transition).

### Matching assignment + traveler accept/reject (Constraints 2.1 + 2.2)
JSON endpoints. Frequency is used only internally for ranking and is **never returned** to a client.

#### `POST /api/v1/shipments/:id/match` · role: AGGREGATOR
Body `{ "tripLegId" }`. Re-checks **server-side**: leg/trip ACTIVE, traveler ACTIVE + KYC VERIFIED,
capacity ≥ shipment weight, and per-category **crowding** cap. Creates the `ShipmentLeg`, decrements
`TripLeg.availableCapacityKg`, → `MATCHED_TO_TRAVELER` (one transaction).
→ `200 { "data": { "shipment": { "status": "MATCHED_TO_TRAVELER" } } }`
Errors: `422 UNPROCESSABLE` (capacity / crowding / inactive / unverified); `409 CONFLICT` (version).

#### `POST /api/v1/shipments/:id/review` · role: TRAVELER
No body. Records a `HUB_TO_TRAVELER` handoff of the sealed-parcel evidence; → `TRAVELER_REVIEWED`.

#### `POST /api/v1/shipments/:id/accept` · role: TRAVELER
Body `{ "acknowledgmentText", "sealIntact" }`. Records the **verbatim acknowledgment** + intact-seal
check; → `TRAVELER_ACCEPTED → WITH_TRAVELER`, and marks escrow `HELD` **if one exists** (escrow is
optional). → `200 { "data": { "shipment": { "status": "WITH_TRAVELER" }, "escrowHeld": bool } }`
Errors: `400 BAD_REQUEST` (no acknowledgment); `422` (seal not intact / illegal state).

#### `POST /api/v1/shipments/:id/reject` · role: TRAVELER
Body `{ "reason"? }` (a **normal** outcome). Restores `TripLeg` capacity, cancels the `ShipmentLeg`,
re-queues → `AWAITING_MATCH`. → `200 { "data": { "shipment": { "status": "AWAITING_MATCH" } } }`

### Delivery + receiver confirmation (Constraint 2.2 live capture; SMS-first receiver)

#### `POST /api/v1/shipments/:id/out-for-delivery` · role: AGGREGATOR
`AT_DESTINATION_HUB → OUT_FOR_DELIVERY`.

#### `POST /api/v1/shipments/:id/deliver` · role: TRAVELER
Multipart: `photo` (≥1 **LIVE** image — gallery rejected) + `payload` JSON `{ captureMethod, geoLat?, geoLng? }`.
→ `DELIVERED`; issues a **signed, stateless token** and SMSs the receiver a no-login confirm link.
The token is **not** returned in the response (only the receiver gets it).
→ `200 { "data": { "shipment": { "status": "DELIVERED" }, "handoff": {...} } }`
Errors: `422` (gallery / no photo / illegal state).

#### `POST /api/v1/shipments/:id/delivery-attempted` · role: TRAVELER
`OUT_FOR_DELIVERY → DELIVERY_ATTEMPTED` (retry via out-for-delivery, or escalate).

#### `POST /api/v1/delivery/confirm` — **NO LOGIN** (the SMS token is the authorization)
Body `{ "token", "problem"?: false, "reason"? }`. `problem: true` → `DISPUTED` (**escrow stays HELD**);
otherwise `DELIVERED → DELIVERY_CONFIRMED`.
→ `200 { "data": { "shipment": {...}, "outcome": "DELIVERY_CONFIRMED"|"DISPUTED" } }`
Errors: `401 UNAUTHORIZED` (invalid/expired token); `404`; `409 CONFLICT`.

### `POST /api/v1/admin/escrow/:id/release` — release the hub escrow · ADMIN (FINANCE/SUPER_ADMIN)
`:id` is the **shipment id** (escrow is 1—1 with a shipment). Releases the held logistics fee
**only when the escrow is `HELD` and the shipment is `DELIVERY_CONFIRMED`** (never on a `DISPUTED`
shipment — manual escrow never auto-releases, OQ-1 / Constraint 2.5). Atomically sets the escrow
`RELEASED` and transitions the shipment `DELIVERY_CONFIRMED → ESCROW_RELEASED`.
Request: `{ "expectedVersion": 14 }`
→ `200 { "data": { "escrow": { "status": "RELEASED", "releasedBy", "releasedAt", ... }, "shipment": { "status": "ESCROW_RELEASED", ... } } }`
Errors: `422 UNPROCESSABLE` (escrow not HELD, or shipment not DELIVERY_CONFIRMED); `409 CONFLICT`
(version mismatch); `403 FORBIDDEN` (not FINANCE/SUPER_ADMIN); `404 NOT_FOUND`.

### `POST /api/v1/admin/escrow/:id/refund` — refund a non-settled hub escrow · ADMIN (FINANCE/SUPER_ADMIN)
`:id` is the **shipment id**. Refunds a `PENDING`/`HELD` hold (sender cancellation, return, or a
dispute resolved for the sender); the admin then routes the shipment to `CANCELLED` /
`RETURNED_TO_SENDER` via the transition endpoint.
Request: `{ "reason": "sender cancelled before intake" }` (reason optional)
→ `200 { "data": { "escrow": { "status": "REFUNDED", "refundedAt", ... } } }`
Errors: `422 UNPROCESSABLE` (escrow already settled); `403 FORBIDDEN`; `404 NOT_FOUND`.

### `POST /api/v1/trips` — publish a trip · role: TRAVELER
Request:
```json
{
  "mode": "ROAD",
  "legs": [
    { "sequence": 1, "originRegion": "Addis Ababa", "destinationRegion": "Hawassa",
      "departAt": "2026-07-01T06:00:00Z", "totalCapacityKg": 8 }
  ]
}
```
→ `201 { "data": { "id", "status", "legs": [ { "id", "availableCapacityKg", ... } ] } }`

### `GET /api/v1/trips` — list my trips · role: TRAVELER
→ `200 { "data": [ { "id", "status", "legs": [...] }, ... ] }`

### `GET /api/v1/matching` — find travelers for an item · role: AGGREGATOR
Query: `originRegion, destinationRegion, windowStart, windowEnd, itemCategory, itemWeightKg`.
Returns eligible travelers ranked by Constraint 2.1 (lowest 90-day frequency first), with the
crowding constraint applied.
→ `200 { "data": [ { "tripLegId", "travelerId", "departAt", "availableCapacityKg", "tripCountLast90Days", "categoryWeightAcceptedKg" }, ... ] }`

### `GET /api/v1/rules` — active item-restriction rules · any authenticated user
Lets the UI render categories, caps, frequency-sensitive limits, and prohibitions.
→ `200 { "data": [ { "itemCategory", "maxWeightKg", "frequencySensitive", "maxWeightKgFrequent", "prohibited", "requiresDeclaration", "requiresSpecialPermit", "direction" }, ... ] }`

---

## Not yet implemented (next backend slices)

Notifications outbox + background jobs (Milestone 8); KYC submission/review (Milestone 9); admin
operations panel (Milestone 10). Built and tested: state machine, rules engine, pricing, query
matching, **manual hub escrow** (optional; arm/release/refund), the **hub verification chain**
(intake → verify → seal, private Storage + magic-byte validation + signed URLs), **matching
assignment + traveler accept/reject**, and **delivery + receiver SMS confirmation** (live-capture,
stateless signed token, no-login confirm/dispute, pluggable SMS sender + webhook HMAC verify).
