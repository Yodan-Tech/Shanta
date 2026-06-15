# SHANTA — Data Model

> The core entities, fields, relationships, and indexes. This is the source of truth that
> [STATE_MACHINE.md](STATE_MACHINE.md), [RULES_ENGINE.md](RULES_ENGINE.md), and the Prisma
> schema (Phase 1) derive from. Every entity exists for a stated reason; if a piece of data
> could be a field on an existing entity instead of a new entity, the rationale says why it isn't.

> ⚠️ **Adjusted by [ADR-0001](DECISIONS.md) (Phase 1 kickoff) for Supabase Auth.** In the
> implemented Prisma schema (`prisma/schema.prisma`): **`User` → `profiles`** keyed by Supabase
> `auth.users.id` (uuid); **`OTPRequest` and `RefreshToken` are dropped** (Supabase Auth owns
> OTP/sessions); **`AdminUser` → `admin_users`** keyed to `auth.users`. Storage URLs point to
> **Supabase Storage** (not R2). All other entities below are implemented as described.

## Conventions (apply to every entity unless noted)

- **IDs:** `cuid()` strings, prefixed by type for readability (`usr_`, `trp_`, `shp_`, `hnd_`…).
- **Audit fields:** `created_at` (UTC), `updated_at` (UTC), `created_by` (nullable FK → User/AdminUser).
- **Soft delete:** `deleted_at DateTime?` (null = active). Never hard-delete user-facing records.
- **Timestamps:** stored in **UTC**; display layer converts to Africa/Addis_Ababa (UTC+3).
- **Money:** `Decimal` (never float), suffixed with currency (`_etb`); `currency` defaults `"ETB"`.
- **Multi-tenancy seed:** `country_code` (ISO-3166-1 alpha-2, default `"ET"`) on User, Trip, Hub,
  Shipment, ItemRestriction, CorridorPricing — a Phase 3 hook; **do not ignore this field.**
- **Concurrency:** entities driven by the state machine carry `version Int @default(0)`, incremented
  on every update for optimistic locking (see [STATE_MACHINE.md](STATE_MACHINE.md)).

---

## 1. User

The single human account. One person can be Sender, Traveler, Aggregator operator, and/or
Receiver — role is a set of flags, **not** separate accounts (people genuinely play multiple roles).

| Field | Type | Req | Notes / Constraints |
|---|---|---|---|
| id | string | ✓ | PK, `usr_` |
| phone_number | string | ✓ | **E.164** (`+2519XXXXXXXX`). **Unique.** Primary identity. |
| full_name | string | – | Required before Sender/Traveler/Aggregator actions; optional for pure Receiver. |
| roles | enum[] | ✓ | Subset of {SENDER, TRAVELER, AGGREGATOR, RECEIVER}. Default [RECEIVER]. |
| traveler_tier | enum | – | {CASUAL, PROFESSIONAL} — null unless TRAVELER. |
| kyc_status | enum | ✓ | {UNVERIFIED, PENDING_REVIEW, VERIFIED, REJECTED}. Default UNVERIFIED. |
| kyc_method | enum | – | {MANUAL, FAYDA} — how verification was done (OQ-6). |
| kyc_submitted_at | timestamp | – | |
| kyc_reviewed_at | timestamp | – | |
| kyc_reviewed_by | string FK→AdminUser | – | |
| id_document_url | string | – | **Secure storage**, never public; admin signed-URL access only. |
| preferred_language | enum | ✓ | {EN, AM}. Default AM. Drives i18n + SMS language. |
| country_code | string | ✓ | Default "ET". |
| status | enum | ✓ | {ACTIVE, SUSPENDED}. Suspension is the bad-actor lever. |
| created_at / updated_at / created_by / deleted_at | — | | audit + soft delete |

**Relationships:** 1—1 `TravelProfile` (if traveler); 1—* `Trip`, `Shipment` (as sender),
`HandoffRecord` (as actor), `RefreshToken`, `Notification`.
**Indexes:** unique(`phone_number`); (`country_code`, `status`); (`kyc_status`) for the review queue.
**Rationale:** roles-as-flags avoids duplicate identities for multi-role people and keeps frequency
tracking (Constraint 2.1) tied to one real person. KYC fields support manual→Fayda swap (OQ-6) with
no schema change.

---

## 2. TravelProfile — *first-class, Constraint 2.1*

Per-traveler frequency and risk tracking. **Exists as its own entity (not fields on User)** because
frequency is a derived, time-windowed, frequently-recomputed risk concept that only applies to
travelers and is read by the matching query on every match — isolating it keeps User lean and makes
the frequency logic testable in one place.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `tvp_` |
| user_id | string FK→User | ✓ | **Unique** (1—1). |
| trip_count_last_30_days | int | ✓ | Maintained by `traveler/frequency-report` job + on trip creation. |
| trip_count_last_90_days | int | ✓ | Drives matching preference + jewelry limit tier. |
| trip_count_lifetime | int | ✓ | |
| last_trip_at | timestamp | – | |
| customs_frequency_tier | enum | ✓ | {NON_FREQUENT, FREQUENT} — derived from 90-day count vs threshold in AppConfig. Drives frequency-sensitive rules (jewelry). |
| risk_flags | JSONB | – | Internal notes (e.g., "repeated category clustering"). Never user-facing. |
| created_at / updated_at | — | | |

**Indexes:** unique(`user_id`); (`trip_count_last_90_days`); (`customs_frequency_tier`).
**Rationale:** Constraint 2.1 demands per-traveler frequency be first-class for *risk management*,
never a customer-facing leaderboard. The matching query orders by `trip_count_last_90_days ASC` to
prefer lower-frequency travelers, and the rules engine reads `customs_frequency_tier` for jewelry.

---

## 3. Trip + 4. TripLeg

A traveler's journey. **Split into Trip and TripLeg** because a single journey can have multiple
legs (Constraint 2.3 — e.g., international→Addis→regional), each with its own origin/destination,
departure time, capacity, and potentially a different aggregator hub. Capacity and crowding are
tracked **per leg**, not per trip.

### Trip
| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `trp_` |
| traveler_id | string FK→User | ✓ | |
| status | enum | ✓ | {DRAFT, ACTIVE, IN_PROGRESS, COMPLETED, CANCELLED}. |
| mode | enum | ✓ | {FLIGHT, ROAD, BUS, OTHER}. |
| country_code | string | ✓ | Default "ET". |
| version | int | ✓ | optimistic lock |
| created_at / updated_at / created_by / deleted_at | — | | |

### TripLeg
| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `tlg_` |
| trip_id | string FK→Trip | ✓ | |
| sequence | int | ✓ | 1-based leg order. |
| origin_region | string | ✓ | Region/city code (generic — any domestic city-pair). |
| destination_region | string | ✓ | |
| origin_hub_id | string FK→Hub | – | Optional designated drop hub. |
| destination_hub_id | string FK→Hub | – | Optional designated pickup hub. |
| depart_at | timestamp | ✓ | **UTC** (+ store local tz context for Phase 2 intl). |
| arrive_at | timestamp | – | |
| total_capacity_kg | decimal | ✓ | `> 0`. |
| available_capacity_kg | decimal | ✓ | Decremented as items are accepted. `>= 0`. |
| status | enum | ✓ | {ACTIVE, FULL, CANCELLED, COMPLETED}. |

**Indexes:** (`origin_region`, `destination_region`, `depart_at`) — **the core supply query index**;
(`trip_id`, `sequence`); (`status`).
**Rationale:** the matching query (below) must trivially answer "how many trips with capacity exist
on corridor X in window T?" — the corridor supply metric (Riskiest Assumption 1). Per-leg capacity
enables the crowding constraint. Generic `origin_region`/`destination_region` keeps it corridor-
agnostic (OQ-5) and supports any intra-country route.

---

## 5. Hub — *Node 3, Aggregator*

A physical aggregator location and the operator who runs it. **First-class entity, core to MVP**
(the PiggyBee lesson). A Hub can serve as origin, transit, and/or destination.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `hub_` |
| name | string | ✓ | |
| operator_user_id | string FK→User | ✓ | The aggregator operator (role AGGREGATOR). |
| hub_types | enum[] | ✓ | Subset of {ORIGIN, TRANSIT, DESTINATION}. Addis hubs typically all three. |
| region | string | ✓ | City/region code. |
| address | string | ✓ | Free text + optional geo. |
| geo_lat / geo_lng | decimal | – | For map display; not live tracking. |
| operating_hours | JSONB | – | Per-day open/close. |
| status | enum | ✓ | {PENDING_APPROVAL, ACTIVE, SUSPENDED, CLOSED}. Approved via admin panel. |
| country_code | string | ✓ | Default "ET". |
| created_at / updated_at / created_by / deleted_at | — | | |

**Indexes:** (`region`, `status`); (`operator_user_id`).
**Rationale:** the hub is the consolidation layer and the trusted custodian during manual escrow
(OQ-1). Its status lifecycle (approval → active → suspend) is an operational safety lever
(Riskiest Assumption 2 — aggregator reliability). Geo is for display only; **no live GPS** (guardrail).

---

## 6. Shipment — *master delivery record*

The end-to-end delivery of one or more items from one sender to one receiver. Carries the state
machine status and the pricing snapshot. **Items and legs are separate** (below) because a shipment
can contain multiple items and traverse multiple hops.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `shp_` |
| sender_id | string FK→User | ✓ | |
| receiver_name | string | ✓ | Receiver may be app-less; name + phone is enough. |
| receiver_phone | string | ✓ | E.164. SMS confirmation target. |
| receiver_user_id | string FK→User | – | Set if receiver has an account. |
| origin_region | string | ✓ | |
| destination_region | string | ✓ | |
| status | enum (ShipmentStatus) | ✓ | See [STATE_MACHINE.md](STATE_MACHINE.md). Default DRAFT. |
| version | int | ✓ | Optimistic concurrency on every transition. |
| idempotency_key | string | – | Unique per sender for create; dedupes mobile retries. |
| pricing_snapshot | JSONB | ✓ | Exact CorridorPricing rates at booking time. |
| carrier_fee_etb | decimal | ✓ | `>= 0`. |
| aggregator_fee_etb | decimal | ✓ | `>= 0`. |
| platform_fee_etb | decimal | ✓ | `>= 0`. |
| insurance_premium_etb | decimal | ✓ | 0 if not opted in. |
| tax_rate | decimal | ✓ | Default 0 (VAT — OQ-7). |
| tax_amount_etb | decimal | ✓ | Default 0. |
| total_price_etb | decimal | ✓ | `>= 0`. = sum of components + tax. |
| currency | string | ✓ | Default "ETB". |
| insurance_opted_in | boolean | ✓ | Default false. |
| country_code | string | ✓ | Default "ET". |
| created_at / updated_at / created_by / deleted_at | — | | |

**Relationships:** 1—* `Item`, `ShipmentLeg`, `HandoffRecord`, `RestrictionCheck`,
`ShipmentStatusHistory`; 1—1 `EscrowRecord`.
**Indexes:** (`status`); (`sender_id`); (`origin_region`, `destination_region`); unique(`sender_id`,
`idempotency_key`).
**Rationale:** separate fee fields let each economic component be tuned independently as we learn
WTP (Riskiest Assumption 4, OQ-2). `pricing_snapshot` guarantees historical shipments price
correctly even after rate changes. `tax_*` present from day one so VAT (OQ-7) needs no migration.

---

## 7. ShipmentLeg

One hop of a shipment's journey, linking the shipment to a specific `TripLeg` and the `Hub`s
involved. **Separate from Item** because a leg is about *movement and custody*, an item is about
*contents*. A shipment with one item over two hops has 1 Item and 2 ShipmentLegs.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `slg_` |
| shipment_id | string FK→Shipment | ✓ | |
| sequence | int | ✓ | 1-based hop order. |
| trip_leg_id | string FK→TripLeg | – | Null until matched to a traveler. |
| origin_hub_id | string FK→Hub | – | |
| destination_hub_id | string FK→Hub | – | |
| traveler_id | string FK→User | – | Denormalized for fast lookup; null until matched. |
| status | enum | ✓ | {PLANNED, MATCHED, IN_TRANSIT, COMPLETED, CANCELLED, RETURNED}. |
| version | int | ✓ | |
| created_at / updated_at | — | | |

**Indexes:** (`shipment_id`, `sequence`); (`trip_leg_id`); (`traveler_id`, `status`).
**Rationale:** decouples a shipment's hops from any one traveler so multi-leg recovery (a missed
connection in Addis, Constraint 2.3) re-matches a single leg without disturbing the rest. The
matching query joins on ShipmentLeg to compute per-traveler trip inventory (crowding constraint).

---

## 8. Item

A specific physical item within a shipment: declared contents, weight, value, category. Drives the
rules engine. **Separate from Shipment** because one shipment can hold several items, each with its
own category and weight, each individually validated against restrictions.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `itm_` |
| shipment_id | string FK→Shipment | ✓ | |
| shipment_leg_id | string FK→ShipmentLeg | – | Current leg carrying this item. |
| category | string | ✓ | Matches `ItemRestriction.item_category` (e.g., COFFEE, SPICES, JEWELRY, ELECTRONICS, CLOTHING, DOCUMENTS, OTHER). |
| description | string | ✓ | Sender's declaration ("what's inside"). PII. |
| declared_weight_kg | decimal | ✓ | `> 0`. Sender-stated. |
| actual_weight_kg | decimal | – | Set at hub intake; discrepancy triggers WEIGHT_DISCREPANCY. |
| declared_value_etb | decimal | – | Drives insurance premium. |
| seal_id | string | – | Tamper-seal applied **after** traveler inspection (Constraint 2.2). |
| created_at / updated_at / deleted_at | — | | |

**Indexes:** (`shipment_id`); (`shipment_leg_id`, `category`) — for the crowding/category-weight sum.
**Rationale:** per-item category + weight are the inputs the rules engine validates (Constraint 2.4)
and the crowding constraint sums per traveler per leg. `actual_weight_kg` vs `declared_weight_kg`
supports the WEIGHT_DISCREPANCY edge case. `seal_id` records that sealing followed inspection, never
preceded it.

---

## 9. HandoffRecord — *verification event, Constraint 2.2*

A custody-transfer event with its verification evidence. **Its own entity** because a single
shipment has *multiple* handoffs (Sender→Hub, Hub→Traveler, Traveler→Hub, Hub→Receiver…), each an
immutable evidence record in the trust chain.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `hnd_` |
| shipment_id | string FK→Shipment | ✓ | |
| shipment_leg_id | string FK→ShipmentLeg | – | |
| handoff_type | enum | ✓ | {SENDER_TO_HUB, HUB_TO_TRAVELER, TRAVELER_TO_HUB, HUB_TO_RECEIVER, TRAVELER_TO_RECEIVER}. |
| from_actor_id | string FK→User | ✓ | |
| to_actor_id | string FK→User | ✓ | |
| photo_urls | string[] | ✓ | **≥1 required.** Contents photos. R2 keys. |
| video_url | string | – | Optional contents video. |
| capture_method | enum | ✓ | {LIVE} for delivery confirmation; LIVE preferred for all. Gallery upload disallowed for delivery. |
| acknowledgment_text | string | – | The exact copy the actor accepted (versioned). |
| acknowledged | boolean | ✓ | True only when actor confirmed "I have inspected the contents and they match the declared description." |
| seal_applied | boolean | ✓ | True when tamper seal applied at this handoff. |
| seal_id | string | – | |
| seal_intact | boolean | – | Set at receiving handoff; false → DISPUTED. |
| geo_lat / geo_lng | decimal | – | From live capture (delivery confirmation). |
| captured_at | timestamp | ✓ | |
| created_at | — | | **Immutable — never updated or deleted.** |

**Indexes:** (`shipment_id`); (`shipment_leg_id`, `handoff_type`); (`captured_at`).
**Rationale:** this is the evidence backbone against every threat (concealment, ghost traveler, hub
theft, false delivery). Photos required at every handoff; the app must make completing a handoff
without a photo + acknowledgment **impossible**. Immutability makes it usable in disputes. The
acknowledgment copy is stored verbatim so we know exactly what each actor agreed to.

---

## 10. ItemRestriction — *rules engine, Constraint 2.4*

A single configurable restriction rule. **Data, not code.** Full schema and ruleset in
[RULES_ENGINE.md](RULES_ENGINE.md); summarized here for the model.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `rst_` |
| item_category | string | ✓ | |
| corridor_code | string | – | Null = applies to all corridors; set = corridor-specific override. |
| corridor_override_of | string FK→ItemRestriction | – | Parent base rule this overrides. |
| max_weight_kg | decimal | – | Nullable. |
| max_value_etb | decimal | – | Nullable. |
| frequency_sensitive | boolean | ✓ | True → limit depends on TravelProfile tier (jewelry). |
| max_weight_kg_frequent | decimal | – | Limit for FREQUENT travelers when frequency_sensitive. |
| requires_declaration | boolean | ✓ | |
| requires_special_permit | boolean | ✓ | |
| prohibited | boolean | ✓ | True → never allowed (e.g., cash). |
| direction | enum | – | {ENTRY, EXIT, BOTH}. Coffee 2kg is exit-specific. |
| notes | string | – | |
| source_regulation | string | ✓ | Provenance; "secondary research, unverified" until OQ-3 resolved. |
| effective_from | date | ✓ | |
| effective_until | date | – | |
| country_code | string | ✓ | Default "ET". |
| created_at / updated_at / created_by | — | | |

**Indexes:** (`item_category`, `corridor_code`, `effective_from`); (`prohibited`).
**Rationale:** configurable rows let the customs document (OQ-3) be encoded without code changes;
corridor overrides + frequency sensitivity + direction express the real Constraint 2.4 rules.

---

## 11. RestrictionCheck — *validation audit log*

An audit record of one run of the rules engine against a shipment/item set. **Separate entity** so
every validation (at submission and at hub intake) is logged for dispute/audit and to measure
rejection patterns.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `rsc_` |
| shipment_id | string FK→Shipment | ✓ | |
| item_id | string FK→Item | – | Per-item result. |
| trigger | enum | ✓ | {SUBMISSION, HUB_INTAKE, RE_MATCH}. |
| result | enum | ✓ | {PASS, FAIL, NEEDS_PERMIT, NEEDS_DECLARATION}. |
| failed_rule_id | string FK→ItemRestriction | – | |
| detail | JSONB | – | Inputs + which limit was exceeded. |
| traveler_frequency_tier | enum | – | Tier used (for frequency-sensitive rules). |
| created_at | — | | Immutable. |

**Indexes:** (`shipment_id`); (`result`).
**Rationale:** the rules engine runs at submission *and* hub intake (the sender agent emphasizes
submission-time validation); logging each run lets us measure how often and why items fail.

---

## 12. EscrowRecord — *payment hold, OQ-1*

The payment hold for a shipment. **Designed for both manual (Hub holder) and automated (provider
holder) modes without migration** — the OQ-1 fork lives entirely in `holder_type`/`holder_id`.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `esc_` |
| shipment_id | string FK→Shipment | ✓ | **Unique** (1—1). |
| amount_etb | decimal | ✓ | `>= 0`. |
| currency | string | ✓ | Default "ETB". |
| holder_type | enum | ✓ | {HUB, PAYMENT_PROVIDER}. Phase 1 = HUB. |
| holder_id | string | – | Hub id (manual) or provider reference (automated). |
| status | enum | ✓ | {PENDING, HELD, RELEASE_REQUESTED, RELEASED, REFUNDED, DISPUTED}. |
| release_condition | string | ✓ | e.g., "receiver delivery confirmation, no dispute". |
| held_at / released_at / refunded_at | timestamp | – | |
| released_by | string FK→AdminUser | – | Manual release actor (Phase 1). |
| provider_ref | string | – | For automated mode reconciliation. |
| created_at / updated_at | — | | |

**Indexes:** (`status`); (`shipment_id`).
**Rationale:** escrow is in the architecture from day one (the Grabr lesson), but the *mechanism* is
deferred (OQ-1). Escrow must **not** auto-release on DISPUTED; release requires receiver confirmation
+ clean state. `holder_type` makes the manual→automated transition a data change, not a rebuild.

---

## 13. Notification — *outbox pattern*

Outbound message queue (push + SMS), written in the **same transaction** as the state change that
triggers it, then sent by an Inngest job. Guarantees "state changed ⇒ notification eventually sent."

| Field | Type | Req | Notes |
|---|---|---|---|
| id | string | ✓ | PK, `ntf_` |
| user_id | string FK→User | – | Recipient (may be null for phone-only receiver). |
| recipient_phone | string | – | E.164; used when no user account. |
| channel | enum | ✓ | {SMS, PUSH}. SMS first-class for receivers. |
| template_key | string | ✓ | i18n template id. |
| payload | JSONB | ✓ | Template variables. |
| language | enum | ✓ | {EN, AM}. |
| status | enum | ✓ | {QUEUED, SENT, FAILED, RETRYING}. |
| attempts | int | ✓ | Default 0. |
| provider_ref | string | – | Africa's Talking / FCM message id. |
| sent_at | timestamp | – | |
| created_at / updated_at | — | | |

**Indexes:** (`status`, `channel`); (`user_id`).
**Rationale:** Ethiopian connectivity makes "state changed but SMS never sent" a real trust bug. The
outbox decouples sending from the transaction and survives provider downtime via retries.

---

## Supporting / infrastructure entities

### 14. OTPRequest
`id, phone_number (E.164), otp_hash (bcrypt), expires_at (10 min), used_at?, created_at`.
**Rate limiting + reuse prevention.** Index (`phone_number`, `created_at`) for the 3/hr, 10/24h limits.

### 15. RefreshToken
`id, user_id FK, token_hash (bcrypt), expires_at (30d), revoked_at?, last_used_at, created_at`.
Revocable sessions, multi-device. Index (`user_id`); (`token_hash`).

### 16. AdminUser — *separate auth system*
`id, email (unique), password_hash, totp_secret, role {SUPER_ADMIN, OPERATIONS, KYC_REVIEWER,
FINANCE}, active, last_login_at?, created_at`. **Never** mixed with user auth; admin tokens 8h, no refresh.

### 17. AuditLog — *immutable*
`id, actor_type {USER,ADMIN,SYSTEM}, actor_id, action, entity_type, entity_id, before_state JSONB?,
after_state JSONB?, metadata JSONB?, ip_address?, created_at`. **Written for every admin action and
every state-machine transition.** Never updated/deleted. Index (`entity_type`,`entity_id`); (`actor_id`).

### 18. ShipmentStatusHistory — *audit trail without event sourcing*
`id, shipment_id FK, from_status, to_status, actor_type, actor_id, handoff_record_id?, reason?,
created_at`. Append-only per-shipment transition log; the reconstructable journey trail. Index
(`shipment_id`, `created_at`). **This is how we get the audit trail event-sourcing would give, with
a simpler status-field model.**

### 19. WebhookLog
`id, provider {AFRICA_TALKING, TELE_BIRR, INNGEST}, event_type, event_id?, payload JSONB,
signature_valid, processed_at?, processing_error?, created_at`. Idempotency via duplicate `event_id`
check. Index (`provider`, `event_id`).

### 20. AppConfig — *runtime config / feature flags*
`key (unique), value JSONB, description, updated_at, updated_by FK→AdminUser`. Thresholds
(e.g., frequency tier cutoff), feature flags (e.g., `feature_flag.content_video_enabled`) without deploys.

### 21. OperationalNote
`id, entity_type, entity_id, note (text), created_by FK→AdminUser, created_at`. Human staff judgment
on disputes/flagged users — distinct from automated AuditLog. Index (`entity_type`,`entity_id`).

### 22. CorridorPricing — *versioned, configurable, OQ-2*
`id, origin_region, destination_region, rate_per_kg_etb, min_charge_etb, aggregator_flat_fee_etb,
platform_commission_rate, insurance_rate, tax_rate (default 0, OQ-7), effective_from,
effective_until?, country_code, created_at`. Index (`origin_region`,`destination_region`,
`effective_from`). **Never store a computed price without the version that produced it** — captured
in `Shipment.pricing_snapshot`.

### 23. IdempotencyKey (Phase 1 store)
`key (PK), scope, response_hash, response_body JSONB, created_at`. 24h TTL. Postgres-backed in Phase 1
(Redis later — conscious debt). Dedupes mutating requests (e.g., shipment create) on mobile retry.

---

## Entity Relationship Summary (ASCII)

```
                         ┌───────────────┐
                         │     User      │ (roles[], kyc_*, country_code)
                         └──────┬────────┘
        ┌───────────────┬──────┼───────────────┬───────────────┐
        │ 1—1           │ 1—*  │ 1—*           │ operates 1—*  │ receives
   ┌────▼─────┐    ┌────▼───┐  │          ┌────▼────┐     ┌────▼─────┐
   │TravelPro │    │  Trip  │  │          │   Hub   │     │ Shipment │ (sender_id)
   │ file(2.1)│    └────┬───┘  │          └────┬────┘     └────┬─────┘
   └──────────┘    1—*  │      │     origin/dest│   ┌──────────┼───────────────┐
                   ┌────▼────┐ │   ┌────────────┘   │ 1—*      │ 1—* legs      │1—1
                   │ TripLeg │ │   │                 ▼          ▼               ▼
                   └────┬────┘ │   │           ┌────────┐ ┌────────────┐ ┌───────────┐
                        │ matched via          │  Item  │ │ShipmentLeg │ │EscrowRecord│
                        └──────────────────────┤        │ │ (seq, hop) │ │ (HUB|PROV) │
                                               └───┬────┘ └─────┬──────┘ └───────────┘
                                                   │            │
                          ┌────────────────────────┼────────────┤
                          ▼                         ▼            ▼
                   ┌─────────────┐         ┌───────────────┐ ┌──────────────────┐
                   │RestrictionCk│◄──rules─│HandoffRecord  │ │ShipmentStatusHist│
                   │  (audit)    │  engine │ (photos, ack, │ │  (append-only)   │
                   └──────┬──────┘         │  seal) 2.2    │ └──────────────────┘
                          │ checks         └───────────────┘
                   ┌──────▼─────────┐
                   │ItemRestriction │ (2.4, corridor override, frequency_sensitive)
                   └────────────────┘

  Outbox/infra (cross-cutting): Notification, AuditLog, OTPRequest, RefreshToken,
  AdminUser, WebhookLog, AppConfig, OperationalNote, CorridorPricing, IdempotencyKey
```

---

## Core Queries (not just schema)

### Matching query — find available travelers for a shipment leg
Enforces **Constraint 2.1** (prefer lower-frequency travelers) and the **crowding constraint**
(per-traveler, per-category, per-trip limit) at the query level. This is the Phase 1 matching engine —
no ML. (Manual operator runs it via admin panel.)

```sql
-- Inputs: :origin, :destination, :window_start, :window_end,
--         :item_weight_kg, :item_category, :category_limit
SELECT t.id, tl.origin_region, tl.destination_region, tl.depart_at,
       tl.available_capacity_kg, u.full_name,
       tp.trip_count_last_90_days,                       -- Constraint 2.1 visibility
       COALESCE(SUM(CASE WHEN i.category = :item_category
                    THEN i.declared_weight_kg ELSE 0 END), 0) AS category_weight_accepted
FROM trip_legs tl
JOIN trips t           ON tl.trip_id = t.id
JOIN users u           ON t.traveler_id = u.id
JOIN travel_profiles tp ON tp.user_id = u.id
LEFT JOIN shipment_legs sl ON sl.trip_leg_id = tl.id
     AND sl.status NOT IN ('CANCELLED','RETURNED')
LEFT JOIN items i      ON i.shipment_leg_id = sl.id
WHERE tl.origin_region = :origin
  AND tl.destination_region = :destination
  AND tl.depart_at BETWEEN :window_start AND :window_end
  AND tl.available_capacity_kg >= :item_weight_kg
  AND tl.status = 'ACTIVE'
  AND t.status = 'ACTIVE'
  AND u.status = 'ACTIVE' AND u.kyc_status = 'VERIFIED'
GROUP BY t.id, tl.id, u.id, tp.id
HAVING COALESCE(SUM(CASE WHEN i.category = :item_category
                    THEN i.declared_weight_kg ELSE 0 END), 0)
       + :item_weight_kg <= :category_limit          -- crowding constraint
ORDER BY tp.trip_count_last_90_days ASC,             -- prefer low-frequency (2.1)
         tl.depart_at ASC;
```

### Supply-depth metric (Riskiest Assumption 1)
```sql
SELECT origin_region, destination_region, date_trunc('week', depart_at) AS wk,
       COUNT(*) AS trips_with_capacity, SUM(available_capacity_kg) AS total_kg
FROM trip_legs
WHERE status = 'ACTIVE' AND available_capacity_kg > 0
GROUP BY 1,2,3 ORDER BY 3 DESC;
```

---

## Intentionally NOT Modeled in Phase 1 (with reasons)

- **Ratings / reviews / reputation scores** — would incentivize high-frequency travelers (Constraint
  2.1). Frequency is tracked internally (`TravelProfile`), never surfaced as a public score.
- **Real-time location / GPS pings** — premature; status via push/SMS suffices; privacy + battery cost.
- **Chat / messaging between actors** — recreates the hub-bypass trap (PiggyBee). Coordination is
  through the hub and status updates.
- **Separate cross-border payment / settlement ledger** — OQ-1 unresolved; manual escrow first.
- **Commercial document entities (AWB, manifest, invoice)** — OQ-4 regulatory risk; records stay
  internal.
- **Per-country schema separation** — `country_code` columns seed multi-tenancy; row-level security
  is a Phase 3 concern (Decision 3).
- **Saga orchestrator tables** — compensation is documented in [STATE_MACHINE.md](STATE_MACHINE.md);
  Phase 1 executes it manually via RUNBOOK, no orchestration engine.
