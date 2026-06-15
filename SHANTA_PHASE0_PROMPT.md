# SHANTA — Phase 0: Foundation Build
## Claude Code Session Prompt · Use with Extended Thinking (max budget)

> **HOW TO USE THIS FILE**
> Paste the entire contents of this file into a fresh Claude Code session with extended
> thinking enabled at maximum budget. Do not split it across sessions. Claude Code will
> reason through all architecture decisions first, then produce every deliverable in order.
> Expected output: 16 files across 4 directories. Estimated session time: 25–45 minutes.

---

## Your Identity for This Session

You are the founding CTO of **Shanta**, a peer-to-peer logistics startup launching in
Ethiopia. Your mandate in this session is to produce the complete Phase 0 foundation:
all architecture documentation, PRD, TRD, CLAUDE.md (the living project memory for
every future Claude Code session), agent prompts, custom slash commands, and guardrails.

**The single most important operating principle, governing every decision you make:**
Build the smallest thing that lets us validate or kill the riskiest open assumption as
fast as possible. Never build "proper" infrastructure before the underlying business
assumption is proven. Every architectural choice should be evaluatable against:
*"does this help us learn something we don't yet know, with minimum wasted engineering
effort?"* If a design choice risks over-building before validation, name it explicitly.

---

## The Business — What Shanta Actually Is

### The Problem
Across Africa — starting with Ethiopia — huge volumes of goods move informally via
travelers' personal luggage: diaspora bringing goods home, people sending items abroad,
branded/specialty goods moved both directions. Today this happens through word-of-mouth,
Telegram/WhatsApp groups, and personal favors. It is unstructured, has no escrow or
trust infrastructure, and does not scale beyond personal networks. Shanta formalizes
this into a trusted marketplace.

### The Four-Node Model

**Node 1 — Sender**
Has an item to move from A to B. Could be diaspora abroad sending to family in Ethiopia,
someone in Ethiopia sending goods abroad, or a domestic sender-to-receiver within Ethiopia.

**Node 2 — Traveler/Carrier**
Has a confirmed trip (flight, domestic transport) with unused luggage capacity. Monetizes
that spare space. Two critical sub-tiers:
- *Casual traveler*: small spare capacity (a few kg), low commitment, needs near-zero
  friction to participate.
- *Dedicated/professional courier*: deliberately brings extra capacity (e.g., an empty
  bag) specifically to carry Shanta cargo — functionally a part-time freight forwarder.

**Node 3 — Aggregator** ← THE MOST ARCHITECTURALLY IMPORTANT NODE
The consolidation layer. Because one traveler cannot carry many units of the same item
(raises both practical capacity issues and customs red flags), the aggregator collects
items from multiple senders heading to similar destinations, consolidates/repackages,
and distributes across multiple travelers and/or flights. This is a physical hub
(drop-off/pickup location) plus a dispatching/consolidation function. This node is the
direct answer to why pure traveler-to-sender matching platforms have historically failed.

**Node 4 — Receiver**
Picks up the item at destination — directly from traveler, from a destination-side
aggregator, or via local last-mile delivery.

### How Money Should Flow (NOT YET FINALIZED — surface as open question)
- Sender pays a total price for the shipment.
- That price splits into: carrier fee (Node 2), aggregator fee (consolidation/handling),
  platform commission, optional insurance premium.
- Payment held in escrow until delivery confirmed (photo/QR scan by receiver).
- **Critical open question**: does Shanta touch cross-border payment flows directly
  (escrow, settlement) or does it integrate with existing payment rails/partners?
  This materially affects both architecture and licensing requirements. Do not assume
  an answer — document both paths and flag for founder decision.

---

## Critical Constraints — NON-NEGOTIABLE Design Inputs

These are not "nice to have" considerations. They are core constraints discovered through
research into Ethiopian customs regulations and prior crowdshipping platform failures.
The architecture must be designed assuming these constraints from Phase 0, even if initial
MVP doesn't fully implement every mitigation.

### Constraint 2.1 — The Frequent Traveler Problem
Ethiopian customs gives **frequent travelers lower duty-free allowances** than
non-frequent travelers (e.g., 50g of jewelry vs. 100g, depending on travel frequency).
- The platform CANNOT be designed around a small pool of "power user" couriers who
  travel constantly — their personal allowances shrink and customs scrutiny grows the
  more they are used.
- **Architectural implication**: The matching/supply system must be designed to onboard
  and activate a *broad, rotating pool* of casual travelers rather than optimizing for
  retention/frequency of a small Node 2 core.
- Growth/gamification mechanics that reward high-frequency individual travelers must be
  deprioritized or redesigned entirely.
- **Per-traveler usage frequency must be a first-class concept in the data model** —
  for the platform's own risk management, not for customer-facing leaderboards.

### Constraint 2.2 — The Unwitting Mule Problem (Highest-Stakes Failure Mode)
A sender could conceal something illegal/risky inside a legitimate-looking item, and
a traveler could unknowingly carry it, facing serious legal consequences abroad with
no idea why. This is the single worst possible real-world outcome of this platform.

**Mandatory MVP-level mitigations — these are core product features, not later add-ons:**
- Photo/video record of contents at EVERY handoff: Sender→Aggregator AND
  Aggregator→Traveler (and ideally every intermediate hop).
- Traveler must be able to review contents before accepting the item.
- Tamper-evident sealing applied AFTER traveler inspection, not before.
- A traveler-facing acknowledgment flow at handoff: "I have seen the contents and
  they match the description" — creates both a safety mechanism and a due-diligence
  record.
- These must be built into the core item/shipment state machine from the start.
  Retrofitting them later is architecturally much harder than designing for them now.

### Constraint 2.3 — Multi-Leg Shipments and the Addis Transit Touchpoint
For any shipment continuing beyond Addis Ababa to a domestic Ethiopian destination,
**passengers must clear customs and collect baggage at Addis before re-checking for
the domestic leg**. This is a real, mandatory mid-journey touchpoint, not just an
endpoint event.

**Architectural implication**: The shipment/item state machine CANNOT be a simple
"origin → destination" model. It must support multi-hop journeys with distinct states
at each hop, each potentially involving a different Node 2/Node 3 party:

```
with_sender → at_origin_aggregator → with_traveler_leg1 →
customs_clearance_addis → at_addis_aggregator → with_traveler_leg2 →
at_destination_aggregator → delivered
```

Build this flexibility in even if Phase 0/1 only uses a subset of these states.
The state machine must be extensible, not refactorable.

### Constraint 2.4 — Prohibited/Capped Item Categories
These are real numeric limits that must live in a **configurable rules engine, not
hardcoded logic** — they may change and may need to vary by corridor:

| Category | Limit | Notes |
|---|---|---|
| Coffee | 2kg per passenger on exit | Special authorization needed beyond this |
| Spices / Butter | 5kg max each | |
| Jewelry | 50–100g | Depends on traveler's customs-frequency status |
| Cash (ETB) | 3,000 ETB (10,000 ETB to/from neighboring countries) | Shanta must NEVER function as a cash-movement mechanism, even informally |
| Electronics (laptops) | Must be declared entry and exit | |
| Pharmaceuticals | Special permits required | Likely excluded from MVP entirely |
| Plastic barrels/drums | Forbidden for personal-effects to Addis | Affects aggregator packing guidance |

The governing regulation is Ethiopia's *"Instruction to Determine the Conditions to
Import Goods for Personal Use"* (available in Amharic and English). The rules engine
must be designed to be updated from this document without requiring code changes.

### Constraint 2.5 — Currency/Forex Context
Ethiopia floated the birr (July 2024, IMF-backed reform), narrowing the official/parallel
exchange rate gap. This reduces but does not eliminate the informal goods trade motivation.

Shanta must be positioned as a *logistics* platform with transparent pricing in local
currency — NOT as a forex workaround. If/when cross-border payments are built, there
may be an opportunity to integrate with Ethiopia's NBE diaspora banking initiatives
("Debo"/"Unite.et" programs) — flag this for founder research before building custom
payment infrastructure.

---

## Lessons From Prior Platforms — Direct Architectural Implications

**PiggyBee** (10+ years, shut down 2022):
Core lesson: "a package doesn't move itself." Pure traveler-to-sender matching without
a relay/hub layer fails because the first-mile/last-mile burden on individual travelers
is too high relative to their reward.
→ **Node 3 (Aggregator) must be a first-class entity in the data model and core to
the MVP, not a later feature.**

**Shyp** (raised $50M, shut down):
Failed by trying to be one-size-fits-all for "anything to anywhere," expanding
geographically too fast before finding a working unit economics model.
→ **MVP must be scoped to one or two specific corridors/item categories, with
geographic and category expansion deliberately gated behind validated economics.**

**Grabr / AirWayBill** (successful pattern):
Uses escrow (payment held until both parties confirm delivery). AirWayBill integrates
with ride-hailing (Careem) for first/last-mile to a meeting point.
→ **Escrow must be in the payment architecture from the start, even if Phase 1 uses
a simplified/manual escrow process (held by aggregator physically, or a simple
hold-and-release flow) before building full automated payment infrastructure.**

**Africa-diaspora players (ShipEasy, etc.)**:
Mostly sidestep random-traveler matching by using commercial freight/personal-shopper
models.
→ **Design the architecture so "no traveler match found" can fall back to a commercial
freight partner. This fallback can be a manual/operational process in early phases —
not an API integration on day one.**

---

## Phasing Philosophy

**Phase 0 (NOW)**: Architecture, documentation, foundational setup. Define core data
model, rules engine, tech stack, state machine.

**Phase 1**: Narrow MVP, single corridor. Founder's stated direction: likely a domestic
Ethiopian route (e.g., Addis ↔ one regional city) to avoid international customs
complexity while proving the core matching/aggregation/trust loop.

*Validation goals for Phase 1*: Does the matching/aggregation loop actually work in
practice? Will travelers carry items for the proposed fee? Will senders pay for it?
Does the content-verification flow create acceptable friction or too much?

**Phase 2**: International corridor(s). Only after Phase 1 validates the core loop.
Introduces full customs/regulatory complexity, cross-border payments, and the
multi-hop Addis-transit scenario in full.

**Phase 3+**: Pan-African corridor expansion, additional item categories, dedicated-courier
tier formalization, possible hybrid commercial-freight fallback.

---

## Open Questions — Surface These, Don't Decide Alone

These are founder decisions with major architectural implications. Every deliverable you
produce must flag these explicitly rather than silently assuming an answer.

1. Does Shanta touch payment flows directly (escrow, cross-border settlement) or
   integrate with existing rails/partners? Major licensing and architecture implications.

2. What's the viable pricing model per kg? (~$4–10/kg estimated but unvalidated against
   real freight forwarder quotes and diaspora willingness-to-pay.)

3. Has the founder obtained and reviewed the "Instruction to Determine the Conditions
   to Import Goods for Personal Use"? The rules engine must ultimately be driven by
   this document.

4. What's the protocol if a traveler is stopped at customs with a Shanta item? Does
   the platform provide documentation? Could that documentation help or inadvertently
   make the activity look more "organized"/commercial? This needs input from Ethiopian
   customs practice, not engineering assumptions.

5. Which specific domestic corridor is Phase 1 targeting, and what's the realistic
   timeline/budget for that MVP?

---

## Tech Stack Starting Hypotheses

Reason through these with the constraints in mind — don't accept them uncritically.
Justify your final choices explicitly against: low-bandwidth networks, low-end Android
devices, Ethiopia market context, available developer talent, and Phase 1 simplicity bias.

- **Mobile**: Flutter (Dart) — single codebase, Android-first priority with iOS secondary,
  good offline/low-bandwidth support, Dart compiles to native ARM.
  *Alternative*: React Native — larger ecosystem, more widely known, but historically
  worse offline/perf characteristics.

- **Backend**: Node.js + TypeScript — type-safe, large ecosystem, easy to hire across
  Africa tech scene, good async I/O for real-time status updates.
  *Alternative*: Python + FastAPI — clean async, excellent for data-heavy rules engine
  logic, but smaller ecosystem for real-time features.

- **Database**: PostgreSQL — relational model handles state machine integrity well,
  JSONB columns for flexible item attribute storage, battle-tested, hosted options
  are cheap and managed.

- **File storage**: Cloudflare R2 — cheap egress, global CDN for photo retrieval by
  receivers across Ethiopia, S3-compatible API.
  *Alternative*: AWS S3 — more mature ecosystem but higher egress costs.

- **SMS/Notifications**: Africa's Talking — has Ethiopia coverage, developer-friendly,
  ETB billing, supports SMS for low-connectivity receivers.
  Firebase Cloud Messaging for push on Android.

- **Hosting (Phase 1)**: Railway.app or Render — managed, simple, Postgres included,
  cheap, minimal DevOps overhead before validation. Migrate later.

- **Auth**: JWT with refresh tokens — simple, no vendor lock-in, works offline for
  short periods.

Evaluate these hypotheses. If you disagree with a recommendation, state why and what
you're substituting.

---

## Project File Structure

Create all files in this exact structure:

```
shanta/
├── CLAUDE.md                          ← Project memory — every session starts here
├── GUARDRAILS.md                      ← What not to build and why
├── docs/
│   ├── PRD.md                         ← Product Requirements Document
│   ├── TRD.md                         ← Technical Requirements Document
│   ├── ARCHITECTURE.md                ← System architecture overview
│   ├── DATA_MODEL.md                  ← Core data model: entities, fields, relationships
│   ├── STATE_MACHINE.md               ← Shipment lifecycle state machine
│   ├── RULES_ENGINE.md                ← Configurable item restrictions design
│   ├── OPEN_QUESTIONS.md              ← Founder decision register
│   └── PHASE_PLAN.md                  ← Phased plan with validation gates
├── prompts/
│   ├── SENDER_AGENT.md
│   ├── TRAVELER_AGENT.md
│   ├── AGGREGATOR_AGENT.md
│   ├── RULES_UPDATE_AGENT.md
│   └── PHASE_VALIDATOR.md
└── .claude/
    └── commands/
        └── README.md
```

---

## Thinking Protocol — USE YOUR FULL THINKING BUDGET BEFORE WRITING FILE ONE

Before creating any file, use your extended thinking budget to work through ALL of the
following. Do not start writing until this reasoning is complete.

### Think through in order:

**1. Complete Data Model**
Map every entity Shanta needs: name, key fields, relationships to other entities, why
this entity exists as distinct from others. Ask: what data do we need to (a) run the
state machine, (b) enforce the rules engine, (c) track traveler frequency for Constraint
2.1, (d) store handoff verification records for Constraint 2.2, (e) support multi-leg
shipments for Constraint 2.3?

Core entities to define (minimum):
- `User` — with role flags (a single person can be Sender, Traveler, Aggregator, Receiver)
- `TravelProfile` — per-user frequency tracking (Constraint 2.1 first-class concept)
- `Trip` — traveler's journey listing
- `TripLeg` — individual legs (origin, destination, depart_at, available_capacity_kg)
- `Hub` — aggregator location (address, operator, hours, type: origin/transit/destination)
- `Shipment` — the master delivery record
- `ShipmentLeg` — one hop in a multi-leg journey (links Shipment to TripLeg + Hub)
- `Item` — specific item within a shipment (declared contents, weight, value, category)
- `HandoffRecord` — verification event at every handoff (photos, acknowledgment,
  tamper-seal record, actor IDs, timestamp)
- `ItemRestriction` — rules engine: configurable caps and prohibitions
- `RestrictionCheck` — audit log of each validation run against the rules engine
- `EscrowRecord` — payment hold (amount, currency, conditions for release, status)
- `Notification` — status updates queue, SMS flag, delivery status

**2. Complete State Machine**
Enumerate every state a Shipment/Item passes through. For every state, define:
(a) which actor "owns" this state, (b) what triggers the transition INTO this state,
(c) what verification/recording is required ON this transition, (d) what the valid
NEXT states are. Include failure/exception states.

Minimum states to work through:
`DRAFT → SUBMITTED → RULES_VALIDATED → AWAITING_HUB_INTAKE →
AT_ORIGIN_HUB → CONTENTS_VERIFIED → SEALED → MATCHED_TO_TRAVELER →
TRAVELER_REVIEWED → TRAVELER_ACCEPTED → WITH_TRAVELER → IN_TRANSIT →
CUSTOMS_CLEARANCE [optional] → AT_TRANSIT_HUB [optional] →
AT_DESTINATION_HUB → OUT_FOR_DELIVERY → DELIVERED → DELIVERY_CONFIRMED →
ESCROW_RELEASED → COMPLETED`

Plus exception states: `DISPUTED`, `RETURNED_TO_SENDER`, `CANCELLED`, `ON_HOLD`,
`CUSTOMS_FLAGGED`

Trace two complete example flows through these states:
- Flow A: Simple domestic Addis→Hawassa shipment
- Flow B: Complex diaspora item arriving at Addis and continuing to Mekelle (multi-hop
  with Addis customs clearance as a mandatory intermediate step)

**3. Tech Stack Decision**
Evaluate the starting hypotheses against each constraint explicitly. For each choice,
state: chosen technology, why, what was rejected, why rejected. Pay particular attention
to: (a) offline-first requirements given Ethiopia connectivity, (b) low-end Android
support, (c) the SMS fallback requirement for receivers with limited smartphones,
(d) developer talent availability in Ethiopian/East African market.

**4. Rules Engine Design**
Design the data structure for a single rule record. It must support: item_category,
corridor (null = applies to all), max_weight_kg (nullable), max_value_usd (nullable),
requires_declaration (boolean), prohibited (boolean), requires_special_permit (boolean),
notes, source_regulation, effective_date, corridor_override_of (nullable FK to parent rule).

Design the validation flow: when does the rules engine run? What inputs does it receive?
What does it output? How does it interact with TravelProfile for Constraint 2.1 (jewelry
limits that vary by traveler frequency)?

**5. MVP Scope Boundary**
List everything that feels important but is NOT in Phase 1. For each item, state:
(a) what it is, (b) why it's excluded from Phase 1 (not ready to build / not yet
validated / premature infrastructure), (c) what has to be true before it enters scope.

**6. Conflict Detection**
Identify any conflicts between the constraints, business model, or phasing philosophy.
Surface these as open questions or design tensions in the relevant documents.

Only after completing all of the above: begin writing files in the order specified below.

---

## Execution Order

Create files strictly in this order (later files depend on earlier ones):

```
1.  CLAUDE.md
2.  GUARDRAILS.md
3.  docs/OPEN_QUESTIONS.md
4.  docs/DATA_MODEL.md
5.  docs/STATE_MACHINE.md
6.  docs/RULES_ENGINE.md
7.  docs/ARCHITECTURE.md
8.  docs/PRD.md
9.  docs/TRD.md
10. docs/PHASE_PLAN.md
11. .claude/commands/README.md
12. prompts/SENDER_AGENT.md
13. prompts/TRAVELER_AGENT.md
14. prompts/AGGREGATOR_AGENT.md
15. prompts/RULES_UPDATE_AGENT.md
16. prompts/PHASE_VALIDATOR.md
```

---

## Deliverable Specifications

### 1. `CLAUDE.md` (Root) — THE MOST IMPORTANT FILE

Every future Claude Code session working on Shanta reads ONLY this file to orient
itself before doing any work. It is the project's living memory.

**Quality test**: If a new Claude Code session reads only CLAUDE.md, can it make
correct architectural decisions without looking at any other file for 80% of common
development tasks? If yes: good. If no: add what's missing.

**Target length**: Under 400 lines (concise enough to be read at the start of every
session, complete enough to be genuinely useful).

**Required structure** (use these exact headings):
```
# SHANTA — Project Memory
## What Shanta Is (3–4 sentences max)
## The Four-Node Model (brief)
## Current Phase & Focus
## Architecture Decisions Made (with rationale, not just choices)
## Critical Constraints Summary (all 5, with the key implication for each)
## Tech Stack (final decisions from TRD)
## File Map (every doc with one-sentence description)
## WHAT NOT TO BUILD IN PHASE 1 (minimum 8 specific items with reasons)
## Open Questions Blocking Progress (link to OPEN_QUESTIONS.md)
## How to Work on Shanta (operating principles for this codebase)
## Before You Write Any Code (checklist: 5 questions to ask first)
```

The "WHAT NOT TO BUILD IN PHASE 1" section is mandatory and must include at minimum:
- Full automated payment processing / escrow automation
- Complex ML-based matching algorithm
- High-frequency traveler rewards or leaderboards (Constraint 2.1 — cite it)
- iOS app (Android-first; iOS in Phase 2)
- International corridor support
- Pharmaceutical item category
- Customs documentation export (legal/policy open question not yet resolved)
- Real-time GPS tracking during transit

### 2. `GUARDRAILS.md`

**Required sections:**
- **Build Principles** (5+ concrete, Shanta-specific principles — not generic)
- **Anti-Patterns from Prior Platforms** — map Shyp/PiggyBee/Shyp failure modes to
  specific Shanta risks with "How this could happen to us" framing
- **Not in Phase 1** — explicit list with *why* each item is excluded (not just that
  it's excluded — the WHY is the value)
- **Traps That Look Like Good Ideas** — things a reasonable developer might propose
  that would be premature/harmful (e.g., "let's add a traveler rating system so
  senders can find the best couriers" — this encourages high-frequency use by a
  small pool, directly violating Constraint 2.1)
- **When a Guardrail Can Be Broken** — founder decision required, specific criteria
  for each breakable guardrail
- **Technical Debt We're Consciously Accepting** — list what we know isn't "proper"
  but is deliberate given Phase 1 scope

### 3. `docs/OPEN_QUESTIONS.md`

For EACH open question (minimum: the 5 from the business context, plus any you
surface during your thinking):

```
## OQ-[N]: [Question title]
**Question**: [Precise statement]
**Why it matters architecturally**: [Specific: what this unlocks or blocks]
**Priority**: [BLOCKS PHASE 1 / BLOCKS PHASE 2 / CAN DEFER TO PHASE 3]
**Who decides**: [Founder / Legal counsel / Payment partner / etc.]
**Default assumption if undecided by Phase 1 start**: [Explicit fallback]
**Architectural paths if YES vs NO**: [Brief both-paths description]
**Last updated**: Phase 0
```

### 4. `docs/DATA_MODEL.md`

For EACH entity:
- Full field list: field name, type, required/optional, description, constraints
- Relationships (FK references, cardinality)
- Key indexes (which fields need indexes and why)
- Design rationale (why this entity exists separately, key design choices)

After entity definitions, include:
- Entity relationship summary (text-based ER diagram using ASCII)
- Notes on what's intentionally NOT modeled in Phase 1

### 5. `docs/STATE_MACHINE.md`

**Required sections:**
- **State Definitions** — for every state: name, description, owning actor,
  what it means for the physical item in this state
- **Transition Table** — every valid transition in this format:
  `FROM STATE → TO STATE | Trigger | Actor | Verification Required | What is Recorded`
- **Invalid Transitions** — explicit list of transitions that must be blocked
  (e.g., `DELIVERED → SUBMITTED` is illegal; `SEALED → CONTENTS_VERIFIED` is
  illegal because sealing logically follows verification, not precedes it)
- **Content Verification & Sealing States** — explicit states for Constraint 2.2
  (not just notes — actual named states in the machine)
- **Example Flow A** — simple domestic Addis→[regional city] trace, step by step
- **Example Flow B** — diaspora item: international origin → Addis customs clearance
  → onward domestic destination (multi-hop, multiple actors)
- **State Machine Diagram** — ASCII or Mermaid format

### 6. `docs/RULES_ENGINE.md`

**Required sections:**
- **Design Philosophy** — why configurable data not hardcoded logic; how this enables
  updating without code changes when the official customs document is obtained
- **Rule Record Schema** — every field with type, nullable/required, description
- **Initial Ruleset** — all rules from Constraint 2.4 coded as example JSON records
- **Validation Flow** — when the engine runs, inputs, outputs, error format
- **Frequency-Sensitive Rules** — how jewelry limits interact with TravelProfile
  (Constraint 2.1): explicit algorithm
- **Corridor Override Design** — how a corridor-specific rule overrides a base rule
- **Rule Update Process** — who can update, how changes are logged, how to test
  a rule change before it goes live
- **Prohibited Use Case: Cash Movement** — explicit rule and enforcement in the engine

### 7. `docs/ARCHITECTURE.md`

**Required sections:**
- **System Overview** — text/ASCII diagram of all major components and how they
  communicate
- **Component Breakdown** — for each component: purpose, technology, Phase 1 vs
  Phase 2 scope
- **API Layer** — REST, auth strategy, versioning approach, rate limiting (even if
  minimal in Phase 1)
- **Offline/Low-Connectivity Strategy** — explicit design for how the mobile app
  behaves when network is unavailable; SMS fallback for status updates
- **File Storage Architecture** — how handoff photos/videos are stored, accessed,
  retained (privacy and legal hold considerations)
- **Notification Architecture** — push (FCM) + SMS (Africa's Talking) dual channel
- **Technology Decisions Table**:
  `| Component | Choice | Rationale | Rejected Alternative | Why Rejected |`
- **Phase 1 Architecture** — what's actually built in Phase 1
- **Phase 2 Additions** — what changes when we add international corridors
- **What We're NOT Building in the Architecture** — explicit exclusions

### 8. `docs/PRD.md`

**Required sections:**
- **Problem Statement** — specific to Ethiopia and the Shanta context, not generic
- **User Personas** (one section per role):
  - Sender (international diaspora variant + domestic variant)
  - Traveler-Casual (occasional spare capacity)
  - Traveler-Professional (dedicated courier sub-tier)
  - Aggregator-Operator (hub manager)
  - Receiver (limited smartphone/data access variant must be addressed)
- **Phase 1 User Journey** — the complete happy-path flow for a domestic shipment,
  step by step, from each actor's perspective
- **Feature Requirements** — structured as:
  - MUST HAVE (Phase 1): with acceptance criteria for each
  - NICE TO HAVE (Phase 1): with explicit reason why it's not MUST HAVE
  - EXPLICITLY OUT OF SCOPE (Phase 1): with reason for exclusion
- **Content Verification Feature** — must appear as an explicit MUST HAVE with
  detailed acceptance criteria (what photos are required, when, by whom, what
  the acknowledgment flow looks like)
- **Traveler Frequency Tracking** — must appear as an explicit MUST HAVE (internal
  risk management feature, not user-facing)
- **Success Metrics** — minimum 5 measurable KPIs for Phase 1 validation,
  structured as: `Metric | Target | How Measured | Why This Metric`
- **Phase 1 Validation Gates** — specific measurable conditions that must be met
  before Phase 2 work begins
- **Open Questions Affecting PRD** — reference OPEN_QUESTIONS.md entries by ID

### 9. `docs/TRD.md`

**Required sections:**
- **Tech Stack Decisions** (final) — for each choice, justify against the specific
  constraints (low-bandwidth, low-end Android, Ethiopia context), not generic
  "best practice" reasoning
- **System Architecture Summary** — reference ARCHITECTURE.md
- **Database Design** — reference DATA_MODEL.md; add: schema migrations strategy,
  Phase 1 → Phase 2 upgrade path
- **API Specification** — key endpoints for Phase 1 (not full OpenAPI spec, but
  enough to guide implementation): method, path, auth required, request, response,
  error cases
- **Security Requirements**:
  - Auth: JWT strategy, token expiry, refresh
  - Data at rest: what's encrypted and why
  - Data in transit: TLS, certificate pinning on mobile
  - Photo storage privacy: who can access handoff photos and under what conditions
  - Sensitive fields: what's PII and how it's handled
- **Performance Requirements** — calibrated to Ethiopia context:
  - Target page load on 3G (not 5G)
  - Max payload sizes for low-bandwidth connections
  - Image compression for handoff photos before upload
  - Offline data sync strategy
- **Testing Strategy** — pragmatic for Phase 1:
  - Unit tests: what must be tested (state machine transitions, rules engine validation)
  - Integration tests: key happy paths
  - What's deliberately NOT tested in Phase 1 and why
- **Deployment Strategy** — Phase 1 hosting, CI/CD (simple), environment management
- **Conscious Technical Debt** — explicit list of what we're accepting in Phase 1
  and what the future cost will be

### 10. `docs/PHASE_PLAN.md`

**Required sections:**
- **Phase 0: Foundation** — what's being done (NOW), definition of done,
  deliverables checklist
- **Phase 1: Narrow MVP**
  - Corridor and item category recommendation with rationale
  - Feature set (reference PRD MUST HAVE list)
  - Timeline estimate (rough ranges acceptable)
  - Resource requirements
  - **DO NOT PROCEED TO PHASE 2 UNTIL**: specific, measurable gate conditions
- **Phase 2: International Corridor**
  - Prerequisites (including open questions that must be resolved)
  - New complexity introduced
  - Architecture changes required
  - **DO NOT PROCEED TO PHASE 3 UNTIL**: gate conditions
- **Phase 3+**: Brief outline
- **Cross-Phase Principles**: things that stay constant across phases

### 11. `.claude/commands/README.md`

Define 5 custom slash commands. For each command provide: purpose, full usage syntax,
expected output format, and the complete prompt to paste when running it manually.

**Commands to define:**

`/shanta-check [feature description]`
Evaluates a proposed feature against current phase scope, all 5 constraints, and
guardrails. Output: PROCEED / REDESIGN / DEFER TO PHASE [N] / NEEDS FOUNDER DECISION,
with specific reasoning for each criterion checked.

`/shanta-state`
Prints the current shipment state machine in readable table format with transitions.

`/shanta-rules`
Prints current rules engine configuration as a readable table.

`/shanta-questions`
Prints all open questions with their current status (RESOLVED / PENDING / BLOCKING).

`/shanta-phase`
Prints current phase, what's in scope, what the next validation gate is, and
what's explicitly out of scope right now.

### 12–16. Agent Prompts

Each agent prompt is a **self-contained context document** for a specific type of
work on Shanta. When a developer (or Claude Code) is working on a specific feature
area, they read the relevant agent prompt as their context, not the full TRD.

**Each prompt must include:**
- Role definition for this agent
- What's in scope for this mode of work
- What's explicitly OUT of scope (with reference to constraint or guardrail)
- Relevant data model entities for this mode
- Key questions to ask before implementing anything
- Specific anti-patterns to avoid
- Reference to relevant docs

**`prompts/SENDER_AGENT.md`**: Focus on sender-facing flows: item submission,
rules validation at submission time, tracking visibility, escrow payment initiation.
Emphasize: rules engine must run at submission, not just at hub intake.

**`prompts/TRAVELER_AGENT.md`**: Focus on traveler-facing flows: trip listing,
match review, content verification flow (Constraint 2.2 — non-negotiable feature
requirements, fully specified), frequency tracking (Constraint 2.1). Anti-patterns:
no high-frequency rewards, no leaderboards, no mechanics that incentivize a small
pool of high-volume carriers. Near-zero friction requirement for casual travelers.

**`prompts/AGGREGATOR_AGENT.md`**: Focus on hub operations: intake logging,
content photo capture, consolidation management, traveler dispatch, multi-leg
coordination. Note: many of these operations are intentionally manual/human-run
in Phase 1 — the app coordinates and records, but doesn't need to automate.
This node is the most architecturally important — give it full treatment.

**`prompts/RULES_UPDATE_AGENT.md`**: Specific to updating the rules engine.
Must include the complete data structure for a rule record, validation process
for rule changes (who approves, how to test, how to log), reference to the
Ethiopian customs regulation document (and what to do if it hasn't been obtained
yet), and an explicit warning about what breaks if rules are changed incorrectly.

**`prompts/PHASE_VALIDATOR.md`**: A decision-support prompt. Given any feature
request or technical proposal, this prompt guides evaluation against:
all 5 constraints, current phase scope, guardrails, open questions, lessons from
failed platforms. Outputs a structured verdict with specific reasoning for each
criterion. Design this prompt so it can be used by a non-technical founder to
sense-check their own feature ideas.

---

## Non-Negotiables — These Must Be True of Every File

1. **TravelProfile with per-traveler frequency tracking must be a first-class entity**
   in the data model — not a comment, not a future-work note, a real entity with
   real fields used in real validation logic.

2. **Content verification and tamper-sealing must be explicit states in the state
   machine** — named states with defined transitions and recording requirements,
   not notes in the margins.

3. **The rules engine must be designed as configurable data** (JSON records / database
   rows), not hardcoded logic. The initial Constraint 2.4 ruleset must appear as
   example records demonstrating the schema.

4. **Every scope decision must have a corresponding "NOT in Phase 1 because:"
   entry** somewhere in the documentation — the reason is the value, not just the list.

5. **No document should assume the payment architecture decision has been made.**
   Where payment flows are discussed, surface the open question (OQ-1) and document
   both architectural paths briefly.

6. **The PRD must explicitly list content verification and traveler acknowledgment
   as Phase 1 MUST HAVE features with specific acceptance criteria.**

7. **CLAUDE.md must include a "WHAT NOT TO BUILD IN PHASE 1" section with at minimum
   8 specific items including the reason for each exclusion.**

8. **Tech stack recommendations must be justified against Ethiopian-specific constraints**
   (low-bandwidth, low-end Android, SMS fallback need, developer talent market) —
   not generic "best practice" reasoning.

9. **Every document must be specific to Shanta** — not a generic template with Shanta's
   name inserted. If a document could apply to any logistics startup with minimal
   changes, it's not specific enough.

10. **The CLAUDE.md "How to Work on Shanta" section must include a 5-question checklist**
    that any developer (or Claude Code session) answers before writing any code. The
    checklist must include a question about which constraint the proposed code might
    interact with.

---

## Begin

Use your full extended thinking budget before writing the first file.
Complete all 6 thinking steps in the Thinking Protocol section above.
Then create all 16 files in the order specified.

The quality of Phase 0 directly determines how well every subsequent phase is built.
This is the one phase where thoroughness pays the largest long-term dividend.
