# SHANTA — Product Requirements Document (Phase 1)

> What we are building for the narrow MVP and why, from each actor's perspective. Scope decisions
> here trace to the constraints in [CLAUDE.md](../CLAUDE.md) and the guardrails in
> [GUARDRAILS.md](../GUARDRAILS.md). Brand voice/tone: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Problem Statement

Across Ethiopia and its diaspora, large volumes of goods move informally through travelers' personal
luggage — diaspora bringing items home, people sending goods abroad, and domestic city-to-city
sending. Today this runs on word-of-mouth, Telegram/WhatsApp groups, and personal favors: no escrow,
no identity, no record of who handled what, no recourse when something goes wrong. It doesn't scale
beyond personal networks, and it exposes travelers to real legal risk (unknowingly carrying prohibited
items through customs). Shanta formalizes this into a trusted marketplace with a physical aggregator
layer, content verification, and escrow — **logistics, not a forex or cash-movement workaround**
(Constraint 2.5). Phase 1 proves the core loop on **one domestic intra-country corridor** (OQ-5).

## User Personas

### Sender — Diaspora variant ("Selam, abroad")
Sends gifts/essentials home from the US/EU. Good connectivity, may have iOS (Phase 2). Pays the
premium for *reliability and trust* over free-but-flaky personal networks (Riskiest Assumption 4).
Cares about: proof the item arrived, who carried it, transparent price. *Phase 1 is domestic, so the
diaspora sender is a Phase 2 primary — represented here to keep the architecture honest.*

### Sender — Domestic variant ("Dawit, Addis")
Sends a package to family/business in another Ethiopian city. 4G in Addis, variable elsewhere. Wants
it cheaper/faster than bus-courier, with a record and a confirmation. The **Phase 1 primary sender.**

### Traveler — Casual ("Hana, occasional flyer/driver")
Travels Addis↔[city] a few times a year with a few kg spare. Low commitment; **needs near-zero
friction** or she won't bother. Will only participate if onboarding + acceptance is fast and the
content-verification step doesn't feel accusatory. The pool Shanta must grow broadly (Constraint 2.1).

### Traveler — Professional courier ("Mulugeta, dedicated")
Deliberately brings an empty bag to carry cargo; a part-time freight forwarder. Higher capacity,
higher trust bar (face-match KYC). Useful but **must not become a power-user core** whose customs
allowances shrink and scrutiny grows (Constraint 2.1). No frequency rewards.

### Aggregator operator ("Bethlehem, hub manager")
Runs the physical hub: receives items, weighs, photographs/inspects contents, applies seals,
consolidates, matches/dispatches travelers, hands off. **The spine of the system** (Riskiest
Assumption 2). Needs a guided, step-by-step interface that makes it *impossible* to skip the photo +
acknowledgment. Most rigorous KYC + in-person onboarding.

### Receiver ("Almaz, regional city")
Picks up the item. **May not own a smartphone** (feature phone / borrowed / 2G–3G). Must be able to
confirm delivery **via SMS**, without installing the app. Name + phone is enough; lowest KYC.

## Phase 1 User Journey (happy path, domestic single-leg)

*Illustrative corridor Addis→Hawassa; route is OQ-5, model is corridor-agnostic.*

1. **Sender** opens app → phone+OTP login → enters item (category, weight, value, description),
   origin/destination, receiver name+phone. Sees price breakdown. Submits.
2. **System** runs the rules engine at submission (Constraint 2.4) → validated → price snapshot +
   escrow created (manual, hub-held). Sender is told which hub to drop at and by when.
3. **Sender** drops the item at the origin hub.
4. **Aggregator** receives it: weighs, photographs intake (Sender→Hub handoff), opens + inspects +
   photographs contents (CONTENTS_VERIFIED), applies a tamper seal (SEALED).
5. **Aggregator** runs the matching query → assigns a low-frequency casual traveler with capacity and
   no category crowding (MATCHED_TO_TRAVELER).
6. **Traveler** at handoff reviews the contents/photos, clicks the acknowledgment ("I have inspected
   the contents and they match the declared description"), takes custody (TRAVELER_ACCEPTED → WITH_
   TRAVELER). Escrow → HELD.
7. **Traveler** travels (IN_TRANSIT), hands to receiver with a live delivery photo (DELIVERED).
8. **Receiver** gets an SMS with a confirmation code → confirms (seal intact) → DELIVERY_CONFIRMED.
9. **Shanta staff** release escrow to carrier + aggregator (ESCROW_RELEASED → COMPLETED). Sender and
   receiver both get confirmation. Every step left a photo/record in the trust chain.

## Feature Requirements

### MUST HAVE (Phase 1) — with acceptance criteria

- **Phone + OTP auth** — AC: OTP via SMS; 6-digit, 10-min expiry, single-use; rate-limited 3/hr,
  10/24h; JWT access(15m)+refresh(30d); admin auth fully separate. (See [TRD.md](TRD.md).)
- **Item submission with rules validation at submission** — AC: sender enters category/weight/value/
  description; rules engine runs **before** the sender travels to the hub; prohibited/over-limit items
  are rejected with a clear reason; a `RestrictionCheck` is logged.
- **Content verification & tamper-sealing** *(non-negotiable, Constraint 2.2)* — AC:
  - Hub intake records ≥1 contents photo; status cannot reach `CONTENTS_VERIFIED` without it.
  - Tamper seal is applied **after** verification; `SEALED` cannot precede `CONTENTS_VERIFIED`.
  - At handoff, the traveler is shown the contents and **must** click the acknowledgment
    ("I have inspected the contents and they match the declared description") to take custody; the
    exact copy is stored on the `HandoffRecord`. Refusal (`TRAVELER_REJECTED`) is a graceful state
    that re-queues the item.
  - Delivery confirmation photo is **live capture only** (no gallery), with timestamp/geo.
- **Traveler frequency tracking** *(internal, Constraint 2.1; not user-facing)* — AC: `TravelProfile`
  maintains 30/90-day/lifetime trip counts and a frequency tier; matching prefers lower-frequency
  travelers; jewelry limit applies the frequency-sensitive cap; **no leaderboard/score is shown.**
- **Aggregator hub operations** — AC: guided intake → verify → seal → match → dispatch flow; the app
  blocks completion of any handoff without its required photo + acknowledgment; explicit cash-check
  prompt at intake.
- **Trip listing + query-based matching** — AC: travelers list trips with per-leg capacity; operators
  find matches via the matching query (capacity + corridor + window + crowding + frequency order).
- **Shipment tracking + status notifications** — AC: each actor sees current state; transitions emit
  outbox notifications (push for app users, **SMS for receivers**) in the recipient's language.
- **Manual escrow (hub-held) + manual release** — AC: `EscrowRecord` created at validation; HELD on
  custody; **never auto-releases on DISPUTED**; released by admin on clean confirmation.
- **Receiver SMS confirmation without the app** — AC: receiver confirms delivery via SMS code/link;
  no smartphone or install required.
- **Admin panel (operability)** — AC: KYC review queue, hub approval/suspend, shipment overview,
  dispute handling, manual escrow release/hold, rules management, user suspend, OTP/audit logs.
- **KYC by actor tier** — AC: receiver phone-only; sender phone+name; traveler +national ID (manual
  review); professional +face match; aggregator +location+in-person; `kyc_status`/`kyc_method` stored.

### NICE TO HAVE (Phase 1) — and why it's not MUST

- **Content *video* (not just photos)** — photos satisfy Constraint 2.2; video is a connectivity
  cost at the airport. Gated behind `AppConfig` flag; enable if bandwidth allows.
- **In-app price estimator before login** — useful for conversion, but not required to transact.
- **Saved addresses / receivers** — convenience; manual entry works for Phase 1 volume.
- **Insurance opt-in** — fields exist; offering it depends on a partner/policy decision; default off.

### EXPLICITLY OUT OF SCOPE (Phase 1) — with reason

- **Automated/cross-border payment** — OQ-1 unresolved; manual escrow validates trust at zero cost.
- **ML matching** — no supply data yet; query-based matching is sufficient and measurable.
- **Ratings / leaderboards / frequency rewards** — violates Constraint 2.1 (the central anti-pattern).
- **iOS app** — 95%+ Android market; iOS is a Phase 2 diaspora concern.
- **International corridors / Addis customs transit automation** — Phase 2 (states designed, not built).
- **Pharmaceuticals** — special permits, legal exposure; `prohibited` in the ruleset.
- **Any commercial-shipping document (AWB, manifest, invoice, customs declaration)** — OQ-4
  regulatory risk; **records stay internal**; the system must not be able to print such a document.
- **Real-time GPS tracking** — premature; push/SMS status suffices; privacy + battery cost.

## Success Metrics (Phase 1 validation KPIs)

| Metric | Target | How measured | Why this metric |
|---|---|---|---|
| Corridor supply depth | ≥ N active trips w/ capacity per week on the corridor | supply query (DATA_MODEL) | Riskiest Assumption 1 — do travelers show up? |
| Match rate | ≥ 70% of submitted shipments matched within sender's window | shipments matched / submitted | Is the loop viable, or do we need freight fallback? |
| End-to-end completion rate | ≥ 80% of matched shipments reach `DELIVERY_CONFIRMED` | state machine progression | Does the operation actually deliver? |
| Content-verification completion vs abandonment | ≥ 90% complete; abandonment trending down | per-step timing/abandonment logs | Riskiest Assumption 5 — is verification too much friction? |
| Traveler acceptance rate | ≥ 75% accept after content review | `TRAVELER_ACCEPTED` / reviewed | Riskiest Assumption 3 — will travelers accept liability? |
| Sender repeat rate | ≥ 30% of senders send again within 60 days | sender cohort | Riskiest Assumption 4 — is the value worth paying for? |
| Trust incidents | 0 loss/theft/false-verification incidents | disputes + operational notes | A single incident can end the corridor (Assumption 2). |

## Phase 1 Validation Gates (before Phase 2 work begins)

Phase 2 (international) does **not** start until: supply depth, match rate, completion rate, and
acceptance targets are met on the corridor for a sustained period; zero unresolved trust incidents;
unit economics validated (real fees vs. real WTP, OQ-2); and OQ-1 (payment) + OQ-3 (customs document)
are resolved. Full gate list in [PHASE_PLAN.md](PHASE_PLAN.md).

## Open Questions Affecting the PRD

OQ-1 (payment mechanism — escrow UX), OQ-2 (pricing shown to senders), OQ-4 (no customs documents —
constrains what we display/print), OQ-5 (which corridor seeds the launch), OQ-6 (KYC manual vs Fayda),
OQ-7 (VAT line on price breakdown). See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
