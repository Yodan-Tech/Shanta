# Shanta — UI Generation Prompt (v0 / dyad / Lovable, etc.)

> Paste the relevant section into your interface generator. **Part 1** is the global system
> context — always include it. **Part 2** is per-screen specs — paste the screen you want.
> **Part 3** is the exact API contract the UI must call. The backend already exists
> (Next.js + Supabase); the generated UI mounts into the same app and calls `/api/v1/*`.
> Keep this in sync with [docs/API.md](../docs/API.md) and
> [docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md).

---

## PART 1 — GLOBAL SYSTEM CONTEXT (always include)

You are building the web UI for **Shanta**, a trusted peer-to-peer travel-delivery platform in
Ethiopia. People send items via travelers who have spare luggage space; physical aggregator hubs
consolidate and verify items. **Web-only, mobile-first** — most users are on low-end Android
phones (Tecno/Itel/Infinix, 1–2GB RAM) over 3G with intermittent connectivity and load-shedding.

**Hard UX rules (non-negotiable — they encode legal/safety constraints):**
1. **No ratings, no leaderboards, no "top traveler" lists, no frequency rewards.** Never display
   how often a traveler travels. (Customs penalises frequent carriers; we spread load across a
   broad pool.)
2. **Content verification is sacred.** At hub intake the operator must take ≥1 photo of contents
   before the item can proceed; the tamper seal is applied *after* verification. A traveler must
   tap an explicit acknowledgment — *"I have inspected the contents and they match the declared
   description"* — before taking custody. Make these steps impossible to skip.
3. **Delivery confirmation photos are live-capture only** (camera, never gallery upload).
4. **Transparent pricing:** always show the full breakdown (carrier, aggregator, platform,
   insurance, tax, total) before a sender commits.
5. **Receivers may have no smartphone** — delivery confirmation must also work via a simple
   SMS-linked web page (a single screen, no login).
6. **Never present Shanta as money transfer or currency exchange.** It moves goods, not cash.

**Tech stack to target:** Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui.
The app already has auth (Supabase phone-OTP) at `/login` and `/verify`, onboarding at
`/onboarding`, and a shell at `/dashboard`. Generate components/screens that match the brand and
call the existing REST API. Use Server Components for reads where possible and Client Components
for interactive forms. Show loading, empty, and error states for every data view.

**Internationalization:** All copy via i18n keys (next-intl), English + Amharic (Ethiopic). Use
the font stack: Inter (Latin) + Noto Sans Ethiopic. Layouts must not break with longer Amharic
strings.

**Brand & design tokens (use exactly):**
- Primary **navy `#11234A`**; accent **amber `#F5BD2E`**; background white `#FFFFFF`, surface
  `#F6F8FB`, border `#E2E8F0`, text `#0F172A`, muted `#64748B`.
- Semantic: success `#1E9E6A`, warning = amber, danger `#D64545`.
- Primary buttons: navy fill, white text. High-emphasis CTAs may be amber fill with navy text.
  **Never use amber for body text on white** (fails contrast).
- Personality: trustworthy, elegant, modern, human, premium. Generous whitespace, restrained
  two-color palette, rounded corners (radius ~10px), crisp type. **Never** cheap, playful, or
  cartoonish. Lean on color/type/whitespace, not heavy imagery (low bandwidth).
- Logo: an "S" mark (two interlocking strokes) with two amber dots; wordmark "Shanta" in navy.

**API conventions (see Part 3):** Base `/api/v1`. Auth via session cookie (same-origin — just
`fetch` with `credentials: "include"`). Success → `{ data }`; error → `{ error: { code,
message, correlation_id, details? } }`. Show `message` to users; log `correlation_id`. Money is
ETB (2 decimals); timestamps ISO-8601 UTC (display in Africa/Addis_Ababa, UTC+3). Send an
`Idempotency-Key` (uuid) header when creating a shipment. State changes need `expectedVersion`;
on `409 CONFLICT`, reload and retry.

---

## PART 2 — SCREENS

### 2.1 Sender — Create Shipment (Client Component, role SENDER)
A multi-step but fast form (completable in <60s):
- Step 1: route — `originRegion`, `destinationRegion` (text/autocomplete of Ethiopian cities).
- Step 2: items — repeatable rows: `category` (select; fetch options from `GET /api/v1/rules` and
  show each category's cap/prohibition inline), `description`, `declaredWeightKg`,
  `declaredValueEtb` (optional). Block submit if a chosen category is `prohibited`.
- Step 3: receiver — `receiverName`, `receiverPhone` (E.164, +2519…), `insuranceOptedIn` toggle.
- Step 4: review — call `POST /api/v1/shipments`, then show the returned **price breakdown** and
  the shipment status. Handle `422 RULES_FAILED` by highlighting the offending items from
  `error.details.items`. Generate and send an `Idempotency-Key` header.
Empty/loading/error states required. After success, link to the shipment detail.

### 2.2 Sender — My Shipments (Server Component, role SENDER)
List from `GET /api/v1/shipments`: each row shows route, status (as a colored badge), total
price, created date. Empty state with a "Send something" CTA. Tapping a row → detail.

### 2.3 Sender — Shipment Detail (role SENDER)
`GET /api/v1/shipments/:id`. Show: status timeline (use the shipment lifecycle), items, price
breakdown, receiver, and — when present — the evidence chain (intake photo, seal status, who has
custody). This screen is where the sender's *trust* is built; make the status and evidence clear.

### 2.4 Traveler — My Trips + Publish Trip (role TRAVELER)
- List: `GET /api/v1/trips` — show each trip's legs (origin → destination, depart time,
  available capacity kg).
- Publish: form → `POST /api/v1/trips` with `mode` (FLIGHT/ROAD/BUS/OTHER) and one or more legs
  (`sequence`, `originRegion`, `destinationRegion`, `departAt`, `totalCapacityKg`).
- **Do NOT** show any frequency / travel-count or rating UI.

### 2.5 Traveler — Accept Item (content review + acknowledgment) (role TRAVELER)
When an item is matched to the traveler, show the contents photos and item description, then a
required, clearly-worded acknowledgment checkbox/slider: *"I have inspected the contents and they
match the declared description."* Only after it is checked can they confirm taking custody. Also
offer a graceful **Decline** action (declining is normal, not an error). (Endpoint for this is a
later backend slice; build the screen to POST a transition with the acknowledgment context.)

### 2.6 Aggregator — Hub Console (role AGGREGATOR) — the most important screen
A guided, step-by-step operator interface (never a blank "mark done"):
- **Intake:** weigh the item, capture an intake photo (camera), confirm receipt → advances state.
  Include an explicit **"Check for cash/currency — prohibited"** prompt.
- **Verify contents:** capture ≥1 contents photo (camera); cannot proceed without it.
- **Seal:** enter/scan a tamper-seal id (only enabled after verification).
- **Match traveler:** call `GET /api/v1/matching` with the corridor/window/category/weight; show
  the ranked candidate list (capacity, departure). Operator selects one. **Do not** show traveler
  frequency. Selecting confirms the match.
Each action shows clear success/pending-sync states; design for poor hub connectivity (queue +
retry, "pending sync" chips in amber).

### 2.7 Receiver — Confirm Delivery (NO login; opened from an SMS link)
A single mobile web page reached via an SMS link/code. Show the item summary and a **live-capture
camera** "Confirm receipt" button (no gallery). If the tamper seal looks broken, offer a "Report a
problem" path (opens a dispute) instead of confirming. Minimal, large tap targets, works on 2G.

### 2.8 Admin — Operations (admin only)
Functional, not fancy. Tables for: shipments (status, current state, ids), a manual transition
action (`POST /api/v1/shipments/:id/transition` with `expectedVersion` + reason), KYC review
queue, hub approval, escrow hold/release, rules management. Behind admin auth; never public.

---

## PART 3 — API CONTRACT (wire the UI to these)

Base `/api/v1`. Same-origin `fetch(url, { credentials: "include" })`. Envelope: success
`{ data }`, error `{ error: { code, message, correlation_id, details? } }`.

```
GET  /api/v1/health                         → { status, checks:{database} }                (no auth)
GET  /api/v1/rules                          → data: Rule[]                                  (auth)
POST /api/v1/shipments        [SENDER]      body: CreateShipment   → 201 { shipment, price }
GET  /api/v1/shipments        [SENDER]      → data: ShipmentSummary[]
GET  /api/v1/shipments/:id    [SENDER]      → data: ShipmentWithItems
POST /api/v1/shipments/:id/transition [ADMIN] body: { toStatus, expectedVersion, reason?, context? }
POST /api/v1/trips            [TRAVELER]    body: CreateTrip       → 201 { trip with legs }
GET  /api/v1/trips            [TRAVELER]    → data: TripWithLegs[]
GET  /api/v1/matching         [AGGREGATOR]  query: originRegion,destinationRegion,windowStart,
                                                   windowEnd,itemCategory,itemWeightKg
                                            → data: TravelerCandidate[]
```

**Types (TypeScript):**
```ts
type ShipmentStatus =
  | "DRAFT" | "SUBMITTED" | "RULES_VALIDATED" | "AWAITING_HUB_INTAKE" | "AT_ORIGIN_HUB"
  | "WEIGHT_DISCREPANCY" | "CONTENTS_VERIFIED" | "SEALED" | "AWAITING_MATCH"
  | "MATCHED_TO_TRAVELER" | "TRAVELER_REVIEWED" | "TRAVELER_ACCEPTED" | "TRAVELER_REJECTED"
  | "WITH_TRAVELER" | "IN_TRANSIT" | "CUSTOMS_CLEARANCE" | "AT_TRANSIT_HUB"
  | "AT_DESTINATION_HUB" | "OUT_FOR_DELIVERY" | "DELIVERY_ATTEMPTED" | "DELIVERED"
  | "DELIVERY_CONFIRMED" | "ESCROW_RELEASED" | "COMPLETED" | "CUSTOMS_FLAGGED"
  | "DISPUTED" | "ON_HOLD" | "DELIVERY_FAILED" | "RETURNED_TO_SENDER" | "CANCELLED";

interface CreateShipment {
  receiverName: string; receiverPhone: string;        // E.164
  originRegion: string; destinationRegion: string;
  insuranceOptedIn: boolean;
  items: { category: string; description: string; declaredWeightKg: number; declaredValueEtb?: number }[];
}
interface PriceBreakdown {
  carrierFeeEtb: number; aggregatorFeeEtb: number; platformFeeEtb: number;
  insurancePremiumEtb: number; taxAmountEtb: number; totalPriceEtb: number; currency: "ETB";
}
interface Rule {
  itemCategory: string; maxWeightKg: number | null; frequencySensitive: boolean;
  maxWeightKgFrequent: number | null; prohibited: boolean;
  requiresDeclaration: boolean; requiresSpecialPermit: boolean; direction: "ENTRY"|"EXIT"|"BOTH";
}
interface CreateTrip {
  mode: "FLIGHT"|"ROAD"|"BUS"|"OTHER";
  legs: { sequence: number; originRegion: string; destinationRegion: string;
          departAt: string; arriveAt?: string; totalCapacityKg: number }[];
}
interface TravelerCandidate {
  tripLegId: string; travelerId: string; departAt: string;
  availableCapacityKg: number; categoryWeightAcceptedKg: number;
  // tripCountLast90Days exists in the payload but MUST NOT be shown in the UI.
}
```

**Error handling pattern:** read `error.code` → `422 RULES_FAILED` (show `details.items`),
`422 VALIDATION_FAILED` (field errors in `details`), `409 CONFLICT` (reload + retry),
`401`/`403` (redirect to login / show no-access), `404`, `500` (generic + log `correlation_id`).

**Status badge colors:** terminal-good (`DELIVERY_CONFIRMED`,`ESCROW_RELEASED`,`COMPLETED`) →
success green; problem (`DISPUTED`,`CUSTOMS_FLAGGED`,`DELIVERY_FAILED`,`RETURNED_TO_SENDER`,
`CANCELLED`) → danger red; in-progress → navy; awaiting/pending → amber.
