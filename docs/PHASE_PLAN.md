# SHANTA — Phase Plan

> The phased roadmap with **measurable gates** between phases. The discipline here is the Shyp
> lesson: do not expand (geography, category, complexity) until the current phase's economics and
> trust loop are validated. Run `/shanta-phase` for the current-state summary. Cross-references:
> [PRD.md](PRD.md) (features/KPIs), [GUARDRAILS.md](../GUARDRAILS.md) (what not to build),
> [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Phase 0 — Foundation (NOW)

**What:** Architecture, documentation, and decisions made before any application code. Define the
data model, state machine, rules engine, tech stack, security/observability standards, brand system,
and guardrails.

**Definition of done:** all 18 Phase-0 documents exist, are internally consistent (cross-references
resolve), satisfy the non-negotiables, and a fresh Claude/engineer reading [CLAUDE.md](../CLAUDE.md)
can make correct decisions for ~80% of common tasks.

**Deliverables checklist:**
- [x] CLAUDE.md · GUARDRAILS.md · RUNBOOK.md
- [x] docs/: OPEN_QUESTIONS, DATA_MODEL, STATE_MACHINE, RULES_ENGINE, ARCHITECTURE, DESIGN_SYSTEM,
      PRD, TRD, PHASE_PLAN
- [x] .claude/commands/README.md (5 slash commands)
- [x] prompts/: SENDER, TRAVELER, AGGREGATOR, RULES_UPDATE, PHASE_VALIDATOR
- [ ] (Phase 1 kickoff) monorepo scaffold, Prisma schema from DATA_MODEL, CI/CD — *Phase 1, not now*

---

## Phase 1 — Narrow MVP (Build and Validate)

**Corridor & category recommendation.** Architecture is **corridor-agnostic across all domestic
intra-country Ethiopian routes** (keyed on hub-pairs/region-pairs). The *launch* corridor is a
market-test decision (**OQ-5**), not an architectural one: pick **one** domestic inter-city route by
testing supply depth + demand signals across candidates (e.g., Addis↔Hawassa, Addis↔Bahir Dar). Start
with **low-risk categories** (clothing, documents, non-perishable gifts; coffee within the 2kg exit
cap is fine domestically). **Exclude** pharma (prohibited) and anything cash-adjacent. International
routes are explicitly Phase 2.

**Feature set:** the PRD MUST-HAVE list — phone+OTP auth, item submission with submission-time rules
validation, **content verification + tamper-sealing** (Constraint 2.2), **traveler frequency tracking**
(Constraint 2.1, internal), aggregator hub operations, trip listing + query-based matching, tracking +
dual-channel notifications, manual hub-held escrow, receiver SMS confirmation without the app, admin
panel, KYC by tier. See [PRD.md](PRD.md).

**Timeline estimate (rough):** ~3–5 months for a small team — roughly: foundation/auth/data layer
(~4–6 wks), shipment + state machine + rules engine (~4–6 wks), aggregator + verification flows +
matching (~4–6 wks), admin panel + escrow + notifications + hardening (~3–4 wks), closed pilot on the
chosen corridor (~2–4 wks). Ranges, not commitments.

**Resource requirements:** 1 backend (Node/TS), 1 Flutter dev, 1 part-time admin/Next.js (can be the
backend dev), founder running ops/aggregator onboarding, 1+ trusted aggregator operator per hub, a
small pilot pool of casual travelers + senders on the corridor.

**DO NOT PROCEED TO PHASE 2 UNTIL (measurable gates):**
1. **Supply:** sustained corridor supply depth ≥ target (PRD KPI) for ≥ 8 consecutive weeks.
2. **Match rate** ≥ 70% of submitted shipments matched within the sender's window.
3. **Completion** ≥ 80% of matched shipments reach `DELIVERY_CONFIRMED`.
4. **Traveler acceptance** ≥ 75% after content review; **verification abandonment** trending down.
5. **Trust:** **zero** unresolved loss/theft/false-verification incidents.
6. **Economics:** unit economics validated against real fees vs. real willingness-to-pay (**OQ-2**),
   with ≥ 30% sender 60-day repeat rate.
7. **Decisions resolved:** **OQ-1** (payment architecture) and **OQ-3** (official customs regulation
   obtained/encoded); **OQ-4** resolved or confirmed-out for any documentation feature.

If a gate isn't met, the answer is iterate or kill the corridor — **not** add scope.

---

## Phase 2 — International Corridor

**Prerequisites:** all Phase 1 gates met; OQ-1 resolved with a licensed payment partner contracted;
OQ-3 customs regulation reviewed and the international ruleset encoded; OQ-4 customs-documentation
protocol resolved with counsel.

**New complexity introduced:** cross-border payment + settlement (TeleBirr/CBE Birr domestic legs +
a licensed cross-border partner; NBE diaspora programs researched — Constraint 2.5); the mandatory
**Addis customs-clearance transit** touchpoint (Constraint 2.3) — activating `CUSTOMS_CLEARANCE` /
`AT_TRANSIT_HUB` and multi-leg re-matching; stricter international rulesets; heightened importance of
frequency tracking (Constraint 2.1) under higher international scrutiny; iOS app for diaspora senders;
Amharic translations shipped.

**Architecture changes required:** API versioning before any breaking change (Phase 1 mobile clients
must keep working); settlement/reconciliation jobs; activate the multi-hop flows already designed in
[STATE_MACHINE.md](STATE_MACHINE.md); Fayda KYC (OQ-6) if production-ready.

**DO NOT PROCEED TO PHASE 3 UNTIL:** at least one international corridor meets the same supply/match/
completion/trust/economics gates as Phase 1; payment settlement is reliable and reconciled;
frequency-tracking risk model validated against real international data; no unresolved
regulatory/customs incidents.

---

## Phase 3+ — Expansion (brief outline)

Pan-African corridor expansion (audit `country_code` scoping + add Postgres row-level security before
the 2nd country — Decision 3); additional item categories as rulesets mature; formalize the
professional/dedicated-courier tier (additive onboarding/capacity/pricing — not a rebuild); evaluate
a hybrid commercial-freight fallback; data-residency review per country before entry.

---

## Cross-Phase Principles (constant across all phases)

- **Smallest build that validates/kills the riskiest assumption** — every phase has explicit gates.
- **Trust is the product** — the photo + acknowledgment + seal evidence chain (Constraint 2.2) is
  never weakened for convenience, in any phase.
- **Constraint 2.1 forever** — broad rotating traveler pool; frequency is internal risk data, never a
  public score or reward. This guardrail does not break.
- **Rules and pricing stay configurable data** — regulations and economics change; code shouldn't have
  to.
- **No commercial-shipping documents** until OQ-4 is resolved — in any phase.
- **CLAUDE.md is authoritative** — when a decision changes, update it first.
