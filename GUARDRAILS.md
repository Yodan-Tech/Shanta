# SHANTA — Guardrails

> What **not** to build, and why. The "why" is the value of this file — anyone can write a
> list of exclusions; the reasoning is what stops a well-meaning developer from undoing a
> deliberate decision six months from now. Read alongside [CLAUDE.md](CLAUDE.md). When in
> doubt, run the proposal through [prompts/PHASE_VALIDATOR.md](prompts/PHASE_VALIDATOR.md) or
> `/shanta-check`.

---

## Build Principles (Shanta-specific)

1. **Validate the riskiest assumption with the smallest build.** Shanta's riskiest assumptions
   are about *people showing up* (travelers on a corridor, aggregators running intake honestly,
   senders paying), not about code scaling. Spend engineering effort where it buys learning, not
   where it buys imagined throughput. If a design serves scale we haven't earned, it's wrong now.

2. **The aggregator is the product's spine — instrument and protect it first.** Node 3 is both the
   most important node and the most operationally uncertain. Its operator interface (guided intake,
   forced photo+acknowledgment) matters as much as the sender's booking screen. A blank "mark as
   done" button for a hub operator is a guardrail violation.

3. **Trust is built slowly and destroyed instantly.** One lost/stolen/falsely-verified item
   destroys more trust than ten clean deliveries create. Every feature is judged partly on: *does
   this strengthen or weaken the evidence chain that protects trust?* Photo chain + acknowledgment
   + tamper seal are structural, not optional UX.

4. **Design for the worst connectivity in the chain, not the best.** The content-verification photo
   upload happens at an Ethiopian airport on an overcrowded network, possibly on a 1GB-RAM Tecno at
   12% battery. Critical flows queue locally and sync; they never hard-fail. Each critical action is
   completable in under 60 seconds of active screen time.

5. **Shanta is logistics, not finance and not freight.** It is never a forex workaround
   (Constraint 2.5) and never a cash-movement vector (Constraint 2.4). It must not generate
   documents that look like commercial shipping paperwork (Constraint regulatory, OQ-4). When a
   feature drifts toward "money movement" or "commercial freight operator," stop and flag it.

6. **Configurable over hardcoded for anything a regulator or market can change.** Item caps,
   pricing, feature toggles, thresholds — all data, not code. The customs rules *will* change; the
   price *will* change as we learn willingness-to-pay. Hardcoding them buys a migration later.

---

## Anti-Patterns from Prior Platforms — How This Could Happen to Us

| Platform | Failure | How it could happen to Shanta | Our defense |
|---|---|---|---|
| **PiggyBee** (shut 2022) | "A package doesn't move itself" — pure traveler↔sender matching put too much first/last-mile burden on individual travelers vs. reward. | We get seduced by a clean app where senders match directly with travelers and skip the "messy" physical hub to ship faster. | **Aggregator (Node 3) is first-class in the data model and core to the MVP.** Never ship a traveler↔sender-only flow. |
| **Shyp** ($50M raised, shut) | One-size-fits-all "anything to anywhere," expanded geographically before unit economics worked. | We launch Addis↔one city, it kind of works, and we rush to add five corridors and international before the economics are proven. | **Geographic/category expansion is gated behind validated economics** (PHASE_PLAN gates). One corridor until the loop is proven. |
| **Grabr / AirWayBill** (working pattern) | Succeed *because* of escrow (held until both confirm) + first/last-mile integration. | We treat escrow as a "later" feature and let travelers take cash directly, losing the trust mechanism. | **Escrow is in the architecture from day one** — manual hub-held in Phase 1, automated later. `EscrowRecord` supports both. |
| **ShipEasy & diaspora freight** | Sidestep random-traveler matching with commercial freight / personal shopper. | We assume traveler supply will always be there and have no answer when "no match found." | **"No match found" is a graceful state with a manual commercial-freight fallback** designed in (manual ops in Phase 1, not an API). |

---

## Not in Phase 1 (with the why)

Mirrors [CLAUDE.md](CLAUDE.md) "WHAT NOT TO BUILD" — the reasons:

- **Automated / cross-border payment & escrow automation** — OQ-1 unresolved; manual hub escrow
  validates the trust model at zero cost and avoids committing to the wrong licensing path early.
- **ML matching** — we have no data on whether travelers even show up; a model would be fit to
  noise. Query-based matching (see DATA_MODEL "Core Queries") is enough and is measurable.
- **Traveler ratings/leaderboards/frequency rewards** — violates Constraint 2.1 (see Traps below).
- **iOS** — 95%+ Android in market; iOS only matters for diaspora senders, a Phase 2 concern.
- **International corridors** — customs + cross-border payment + Addis transit complexity; gated on
  Phase 1 economic validation (the Shyp lesson).
- **Pharmaceuticals** — special permits, high legal exposure, no validated demand.
- **Any commercial-shipping document generation** — regulatory risk (OQ-4); keep records internal.
- **Real-time GPS tracking** — premature; push/SMS status is sufficient; privacy + battery cost.
- **Microservices / K8s / GraphQL / websockets / multi-region / full-text search / A/B infra /
  fraud-detection ML** — all serve load or sophistication we don't have; see the WRONG list below.

---

## Traps That Look Like Good Ideas

These will be *proposed by reasonable people*. Each is wrong for a specific Shanta reason.

- **"Add a traveler rating system / leaderboard so senders pick the best couriers."**
  ⇒ Rewards high-frequency individual travelers. Their duty-free allowances *shrink* and customs
  scrutiny *grows* with frequency (Constraint 2.1). It optimizes exactly the thing that breaks the
  model. Frequency is tracked internally for *risk*, and matching *prefers lower-frequency* travelers.

- **"Let travelers and senders chat/coordinate directly to skip the hub and move faster."**
  ⇒ Recreates PiggyBee. Removes the consolidation that prevents customs red flags and the evidence
  chain that protects everyone. The hub is the point.

- **"Let the receiver upload the delivery photo from their gallery — it's more convenient."**
  ⇒ Bypasses live-capture timestamp/GPS, enabling fake delivery confirmation. Delivery confirmation
  photo must be **live capture only** (enforced in app and via metadata at API).

- **"Auto-release escrow as soon as the item is marked delivered."**
  ⇒ Escrow must **not** auto-release on a `DISPUTED` or unconfirmed delivery (e.g., broken seal).
  Release requires receiver confirmation and a clean state. Auto-release is how ghost travelers win.

- **"Match all five spice senders to the one traveler going to that city — efficient!"**
  ⇒ One traveler with 25kg of spices reads as commercial import. The crowding constraint
  (per-traveler, per-category, per-trip) exists precisely to prevent this. See RULES_ENGINE.

- **"Generate a nice printable manifest/waybill the traveler can show at customs."**
  ⇒ Makes the activity look organized/commercial, risking commercial duty classification (OQ-4,
  unresolved). Build nothing external-facing that resembles shipping paperwork.

- **"Skip ID verification for travelers to reduce onboarding friction."**
  ⇒ Travelers bear legal responsibility for contents at customs; ID is the accountability anchor and
  a Sybil-attack defense. Casual-traveler friction is reduced elsewhere, never on identity.

- **"Use email/password auth — it's standard."**
  ⇒ Most Ethiopian users, especially regional receivers, don't actively use email; password reset
  breaks. Phone + OTP is the trained pattern. (Admin is the only email/password surface.)

---

## When a Guardrail Can Be Broken (founder decision + criteria)

| Guardrail | Breakable when… | Who decides |
|---|---|---|
| No automated payment | OQ-1 resolved AND a licensed payment partner is contracted AND Phase 1 escrow trust validated. | Founder + legal/payment partner |
| No international corridor | Phase 1 gates met (PHASE_PLAN) AND customs regulation obtained (OQ-3) AND payment path decided (OQ-1). | Founder |
| No commercial-style documents | An Ethiopian customs practitioner confirms a specific document helps rather than harms (OQ-4). | Founder + customs counsel |
| Manual matching only | Phase 1 produces enough matching data that a simple ranked query is demonstrably insufficient. | Tech lead + founder |
| Single corridor | The first corridor's unit economics are validated against PHASE_PLAN gates. | Founder |
| No ID for casual travelers | **Never** in any phase — this guardrail does not break. | — |
| Verification photo + acknowledgment optional | **Never** — structural requirement (Constraint 2.2). | — |

A guardrail break is logged as a decision in [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) or
an ADR, with the criteria that were met. Breaking one silently is the actual failure mode.

---

## Technical Debt We're Consciously Accepting (Phase 1)

We are choosing these deliberately. Each has a known future cost we accept in exchange for speed
to validation. (Full list in [docs/TRD.md](docs/TRD.md) "Conscious Technical Debt".)

- **Manual escrow & manual matching** — human-run via admin panel. Cost: doesn't scale past a few
  staff; acceptable because Phase 1 volume is low and we're testing the human trust loop anyway.
- **Manual KYC review** of traveler/aggregator IDs by staff. Cost: latency in onboarding; acceptable
  as a one-time step. Data model already supports swapping to Fayda API later with no schema change.
- **No automated customs/Addis-transit handling** — Phase 1 is domestic; the states exist but the
  automation doesn't. Cost: Phase 2 must build the transit flows; the machine is designed for it.
- **Postgres `ILIKE` search, no full-text index.** Cost: slower search at scale; fine for Phase 1.
- **Single region, single Postgres.** Cost: latency for far users, no DR region; acceptable pre-PMF.
- **Idempotency keys stored in Postgres, not Redis.** Cost: minor; avoids running Redis in Phase 1.

Debt is acceptable only when it is **named, reasoned, and revisited at the phase gate.** Undocumented
shortcuts are not "debt" — they are landmines.
