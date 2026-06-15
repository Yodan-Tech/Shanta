# SHANTA — Project Memory

> **Read this file first, every session, before doing any work on Shanta.** It is the
> living memory of the project. If something here is wrong or out of date, fixing this
> file is the highest-priority change you can make — drift from CLAUDE.md is drift from
> the project. Last updated: **Phase 1 kickoff** (see ADR-0001 banner below).

> ⚠️ **Phase 1 stack update — [ADR-0001](docs/DECISIONS.md).** The implementation stack
> changed at Phase 1 kickoff: **Supabase (Postgres + Auth + Storage) + Next.js full-stack,
> web-only + Prisma**, deployed free on Vercel. Supabase Auth (phone OTP) replaces the
> custom OTP/JWT system; the custom `OTPRequest`/`RefreshToken` entities are dropped and
> `User` is now the `profiles` table keyed to Supabase `auth.users`. Supabase Storage
> replaces Cloudflare R2. There is **no Flutter mobile app** — one Next.js web platform
> serves all node interfaces. This supersedes the Fastify/Railway/Flutter/R2 references in
> the "Tech Stack" section and docs below. The **domain model, state machine, rules engine,
> all 5 constraints, escrow design, and phasing are unchanged.**

---

## What Shanta Is

Shanta is a trusted peer-to-peer travel-delivery platform launching in Ethiopia. It
formalizes the large informal economy of goods moved through travelers' personal luggage
(diaspora sending home, people sending abroad, domestic city-to-city sending) into a
marketplace with escrow, identity, and content-verification trust infrastructure. The
core insight that makes it work where pure matching platforms failed: a physical
**aggregator hub** layer consolidates items so no single traveler carries a customs-risky
load. Brand promise: *"Send what matters through people you can trust."* Tagline:
*"Carry More Than Luggage."*

## The Four-Node Model

- **Node 1 — Sender:** has an item to move A→B (diaspora abroad, domestic, or sending abroad).
- **Node 2 — Traveler/Carrier:** has a trip with spare luggage capacity. Two sub-tiers:
  *casual* (a few kg, needs near-zero friction) and *professional courier* (deliberately
  brings extra capacity).
- **Node 3 — Aggregator (MOST ARCHITECTURALLY IMPORTANT):** physical hub that collects from
  many senders, consolidates/repackages, and distributes across travelers/flights. Directly
  answers why traveler↔sender-only platforms (PiggyBee) failed: "a package doesn't move itself."
- **Node 4 — Receiver:** picks up at destination. **Often has no smartphone** — SMS is a
  first-class delivery/confirmation channel, not a fallback.

A single `User` can hold multiple roles (role flags, not separate accounts).

## Current Phase & Focus

**Phase 0 — Foundation (this is documentation, NOT code).** We define the data model,
state machine, rules engine, tech stack, and guardrails before writing a line of application
code. **Phase 1** is a narrow domestic MVP on a single **intra-country (inter-city) corridor**
within Ethiopia, chosen later by market testing (see [OQ-5](docs/OPEN_QUESTIONS.md)). The job
of Phase 1 is to validate or kill five riskiest assumptions (supply, aggregator reliability,
traveler liability acceptance, sender willingness-to-pay, verification friction) — see
[docs/PHASE_PLAN.md](docs/PHASE_PLAN.md). **Phase 2** = international corridors. **Phase 3+** =
pan-African expansion.

> The corridor model is **generic across all domestic Ethiopian city-pairs** (intra-country),
> keyed off hub-pairs/region-pairs — never hardcode one route. International is Phase 2.

## Architecture Decisions Made (with rationale)

- **Monolith, not microservices.** Phase 1 has no scale to justify the operational cost of
  splitting. The architecture is built to be *evolvable*, not pre-scaled.
- **Status-field state machine + immutable history (NOT event sourcing).** A `Shipment.status`
  enum with optimistic-concurrency `version`, backed by `ShipmentStatusHistory` + `AuditLog`
  for the audit trail customs/disputes require. Event sourcing was evaluated and rejected as
  premature complexity for Phase 1 — but the audit-trail requirement it exists to serve is met
  by other means. See [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md).
- **Multi-hop state machine from day one.** Even if Phase 1 uses a subset of states, the
  machine is extensible (Addis customs transit is a mandatory mid-journey touchpoint in Phase 2,
  per Constraint 2.3) — designed to add hops without restructuring.
- **Configurable rules engine as data, not code.** Item caps/prohibitions live in DB rows so
  they update without deploys when the official customs regulation is obtained. See
  [docs/RULES_ENGINE.md](docs/RULES_ENGINE.md).
- **Phone + OTP auth (NOT email/password).** Phone number is identity in Ethiopia; users are
  trained on SMS-OTP by TeleBirr/CBE Birr. Admin auth is fully separate (email + password + TOTP).
- **Manual hub escrow is a legitimate Phase 1 design, not a compromise.** The aggregator is the
  trusted third party that already plays this role informally. `EscrowRecord` supports both a
  Hub holder (manual) and a payment-provider holder (automated) without migration. OQ-1 open.
- **Outbox pattern for notifications; idempotency keys on mutations; soft deletes + audit fields
  everywhere; UTC storage; webhook→Inngest async processing.** These prevent whole classes of
  bugs that destroy trust (lost SMS, duplicate shipments, concurrent transition corruption).
- **Country_code seed for multi-tenancy** (default "ET") on key tables — a Phase 3 hook that
  costs nothing now. Do not ignore this field.

## Critical Constraints Summary (all 5)

1. **Frequent-Traveler Problem (2.1):** Ethiopian customs gives frequent travelers *lower*
   duty-free allowances. ⇒ Design for a **broad, rotating pool of casual travelers**, never a
   small power-user core. Per-traveler frequency is a **first-class data concept** (`TravelProfile`)
   used in matching (prefer lower-frequency travelers) — for risk management, never a leaderboard.
2. **Unwitting-Mule Problem (2.2 — highest stakes):** a sender could hide something illegal in a
   legit-looking item; a traveler could carry it unknowingly. ⇒ Photo/video at **every handoff**,
   traveler reviews contents **before** accepting, tamper-seal applied **after** inspection, and a
   traveler acknowledgment ("I have inspected the contents and they match the declared description").
   These are **named states** in the machine, not notes.
3. **Addis Transit Touchpoint (2.3):** shipments continuing past Addis to a domestic destination
   must clear customs and re-check baggage at Addis. ⇒ Multi-hop state machine with distinct states
   per hop, each potentially a different traveler/hub. (Relevant in Phase 2; designed now.)
4. **Prohibited/Capped Categories (2.4):** real numeric limits (coffee 2kg, spices/butter 5kg,
   jewelry 50–100g by frequency, cash forbidden as a movement vector, etc.) ⇒ live in the
   **configurable rules engine**, never hardcoded; varies by corridor via overrides.
5. **Forex Context (2.5):** birr floated (2024). Shanta is a **logistics** platform with
   transparent ETB pricing — **never a forex workaround**. Cross-border payment is a Phase 2
   problem; research NBE diaspora programs (Debo/Unite.et) before building custom rails.

## Tech Stack (final — see [docs/TRD.md](docs/TRD.md))

- **Backend:** TypeScript (strict) · Node 20 LTS · **Fastify** · **Prisma** (Postgres 16) ·
  **Zod** validation · **Inngest** jobs · **Pino** logs · **Sentry** errors · **Vitest** tests.
- **Mobile:** **Flutter** (Dart) · **Riverpod** · **Drift** (offline SQLite) · **Dio** ·
  `camera` (live capture) · `flutter_secure_storage` · i18n en+am from day one.
- **Admin:** **Next.js** App Router · **Shadcn/ui**, same API with admin-scoped JWT, IP-allowlisted.
- **Infra:** Cloudflare **R2** + **Images** (handoff photos) · **Africa's Talking** SMS · **FCM**
  push · Cloudflare in front (OTP rate limit, DDoS, TLS) · **Railway** (API) · **Vercel** (admin).
- **Monorepo:** Turborepo. `packages/types` is the single source of truth for API contracts
  (prevents frontend/backend type drift). Flutter Dart models generated from the same schemas.
- **Why these:** justified against low-bandwidth, low-end Android (Tecno/Itel/Infinix, 1–2GB RAM),
  SMS-first receivers, and the Addis/East-Africa developer talent pool — not generic best practice.

## File Map

- [CLAUDE.md](CLAUDE.md) — this file: project memory, read first every session.
- [GUARDRAILS.md](GUARDRAILS.md) — what NOT to build and why; traps that look like good ideas.
- [RUNBOOK.md](RUNBOOK.md) — manual operations handbook for when something breaks at 11pm.
- [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) — founder decision register (OQ-1..N).
- [docs/DECISIONS.md](docs/DECISIONS.md) — ADRs (ADR-0001 = the Supabase + Next.js stack change).
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — entities, fields, relationships, indexes, core queries.
- [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md) — shipment lifecycle, transitions, edge cases.
- [docs/RULES_ENGINE.md](docs/RULES_ENGINE.md) — configurable item-restriction design + ruleset.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture, offline/SMS, webhooks, infra.
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — brand identity, color/type tokens, UI principles.
- [docs/PRD.md](docs/PRD.md) — product requirements, personas, journeys, KPIs, validation gates.
- [docs/TRD.md](docs/TRD.md) — technical requirements, API spec, security, testing, deployment.
- [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md) — phased plan with measurable "do not proceed" gates.
- [.claude/commands/README.md](.claude/commands/README.md) — 5 Shanta slash commands.
- [prompts/](prompts/) — per-role agent context docs (SENDER, TRAVELER, AGGREGATOR, RULES_UPDATE,
  PHASE_VALIDATOR). Read the relevant one before working in that area.

## WHAT NOT TO BUILD IN PHASE 1

1. **Automated payment processing / escrow automation.** Use manual hub escrow first — it
   validates the trust model at zero engineering cost. OQ-1 (payment architecture) is unresolved;
   building automation now risks the wrong licensing path.
2. **ML-based matching algorithm.** We don't yet know if travelers show up at all. Use the
   query-based matching SQL in [docs/DATA_MODEL.md](docs/DATA_MODEL.md). Manual matching is fine.
3. **High-frequency traveler rewards / leaderboards / ratings-for-ranking.** Directly violates
   **Constraint 2.1** — it incentivizes a small power-user pool whose customs allowances shrink
   and scrutiny grows. This is a trap that looks like a good idea.
4. **iOS app.** Android-first (95%+ of Ethiopian smartphones). iOS in Phase 2 for diaspora senders.
5. **International corridor support.** Customs, cross-border payment, and Addis-transit complexity
   are Phase 2 — gated behind Phase 1 economic validation (the Shyp failure: expanding too fast).
6. **Pharmaceutical item category.** Requires special permits; legal exposure too high. Excluded.
7. **Customs documentation export / any commercial-shipping-style document** (AWB, bill of lading,
   manifest, commercial invoice). Regulatory open question (OQ-4) unresolved; such documents could
   make the activity look organized/commercial and attract commercial duty. Keep records internal.
8. **Real-time GPS tracking during transit.** Status updates via push/SMS are sufficient; live GPS
   is premature infrastructure and a privacy/battery cost with no validated demand.
9. **Microservices, Kubernetes, GraphQL, websockets, multi-region, full-text search, A/B infra,
   fraud-detection ML.** All premature for Phase 1 load — see [GUARDRAILS.md](GUARDRAILS.md).

Rule: **every "not now" has a reason** — the reason is the value. If you can't state why something
is excluded, you don't understand the exclusion well enough to make it.

## Open Questions Blocking Progress

See [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md). The ones that **block Phase 1 start** or
shape Phase 1 design: OQ-1 (payment: manual vs automated), OQ-2 (pricing/kg), OQ-3 (has the
official customs regulation been obtained?), OQ-5 (which corridor). OQ-4 (customs-stop protocol)
blocks any external-facing documentation feature. Never silently assume an answer — document both
paths and flag for the founder.

## How to Work on Shanta (operating principles)

- **Smallest thing that validates or kills the riskiest assumption.** Every choice is judged by:
  *does this help us learn something we don't yet know, with minimum wasted effort?* Name it
  explicitly when a design risks over-building before validation.
- **Evolvable now, scaled later.** Build the things that make change cheap (rules-as-data, complete
  state machine, frequency tracking, outbox, idempotency, i18n structure, soft deletes). Defer the
  things that only serve load we haven't earned.
- **Trust is the product.** A single bad aggregator/loss incident destroys trust faster than ten
  good deliveries build it. The verification chain (photos + acknowledgment + seal) is structural,
  not UX polish — the app must make it *impossible* to complete a handoff without it.
- **Design for Ethiopian reality:** spotty airport connectivity (the verification upload happens
  there — queue offline, retry), load-shedding (each critical action completable in <60s screen
  time), SMS-only receivers, low-end devices.
- **Strict TypeScript, zero `any`, Zod on every endpoint, tests on what breaks** (state transitions,
  rules engine, auth/OTP, escrow). See [docs/TRD.md](docs/TRD.md) for the testing priority list.
- **Update this file** whenever an architectural decision changes. CLAUDE.md is authoritative.

## Before You Write Any Code (5-question checklist)

1. **Which phase is this in, and is it in scope now?** If it's Phase 2/3 work, stop — write it down
   in [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md) instead of building it.
2. **Which of the 5 constraints does this code touch?** (Frequency 2.1 / Mule 2.2 / Addis transit
   2.3 / Item caps 2.4 / Forex 2.5.) If it touches 2.1 or 2.2, re-read that constraint before coding.
3. **Does this assume a resolved open question?** Check [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md).
   If yes and it's unresolved, design for both paths or stop and flag the founder.
4. **What riskiest assumption does this serve, and what does it let us measure?** If it doesn't help
   validate Phase 1 or isn't required to operate, it's probably premature.
5. **Am I building evolvable foundation or premature scale?** Check this against
   [GUARDRAILS.md](GUARDRAILS.md) "WRONG — don't build in Phase 1" before committing.
