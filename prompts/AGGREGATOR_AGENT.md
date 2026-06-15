# Shanta — Aggregator Agent Context

> Read this before working on any hub/aggregator feature. Always read [CLAUDE.md](../CLAUDE.md) first.
> **Node 3 is the most architecturally important node in Shanta** — the consolidation layer that makes
> the whole model work where pure matching platforms (PiggyBee) failed. This area gets the fullest
> treatment and the highest bar for getting it right. The aggregator operator's interface matters as
> much as the sender's booking screen.

## Role

You implement and reason about the **Aggregator/Hub (Node 3)** operations: hub onboarding, item
intake, content photo capture + inspection, tamper-sealing, consolidation, query-based matching,
traveler dispatch, multi-leg coordination, and (in Phase 1) acting as the **manual escrow custodian**.
Many of these are intentionally **human-run in Phase 1** — the app *coordinates and records*; it does
not need to automate. But the recording is non-negotiable and structural.

## Why this node is the spine (and the biggest risk)

- It is the answer to "a package doesn't move itself" — it absorbs the first/last-mile burden that
  sank traveler-only platforms.
- It is also the **most operationally uncertain** node (Riskiest Assumption 2). One bad incident
  (lost/stolen item, false verification) destroys trust faster than ten clean deliveries build it.
  Therefore: the operator interface must be **guided and prompt-driven**, never a blank "mark as done."

## In scope

- **Hub onboarding (most rigorous KYC):** operator phone + name + national ID + **business-location
  verification** (staff visit or photo evidence) + **in-person onboarding**. Hub lifecycle:
  `PENDING_APPROVAL → ACTIVE → SUSPENDED/CLOSED` (admin-controlled).
- **Guided intake (Sender→Hub handoff):** weigh the item (`actual_weight_kg`); if it differs from
  declared beyond threshold → `WEIGHT_DISCREPANCY` (re-price/re-rules). Capture an intake photo.
  **Explicit cash/currency check prompt** (Constraint 2.4 / 2.5 — Shanta never carries cash).
- **Content verification + sealing (Constraint 2.2):** open, inspect, and photograph contents
  (≥1 photo) → `CONTENTS_VERIFIED`; apply tamper seal with `seal_id` **after** inspection → `SEALED`.
  The app must make completing intake **impossible** without the photo, and sealing impossible before
  verification.
- **Matching (Phase 1 = query, not ML):** run the matching query
  ([DATA_MODEL.md](../docs/DATA_MODEL.md) "Core Queries") — filters capacity/corridor/window, enforces
  the **crowding constraint** (per-category, per-trip) and **prefers lower-frequency travelers**
  (Constraint 2.1). The operator applies judgment on the ranked results.
- **Dispatch (Hub→Traveler handoff):** show contents to the traveler, capture their acknowledgment,
  verify seal intact, transfer custody.
- **Multi-leg coordination (designed now, Phase 2 active):** transit-hub intake (`AT_TRANSIT_HUB`),
  re-matching the next leg, Addis customs-transit handling (Constraint 2.3).
- **Manual escrow custodian (Phase 1):** the hub is the `EscrowRecord.holder_type = HUB`. Record
  receipt; release is admin-triggered on clean confirmation (never by the hub unilaterally).
- **"No match found" handling:** a graceful state, not a dead end — surface the manual
  commercial-freight fallback path (manual ops in Phase 1) and the matching-window timeout (Edge 10).

## Out of scope (with the reason)

- **Automating escrow release** — Phase 1 is admin-triggered; OQ-1 unresolved.
- **Generating commercial/customs documents** — OQ-4; internal records only.
- **Automated/ML matching** — query-based + operator judgment first (no supply data yet).
- **Real-time GPS of the hub or items** — premature; status updates suffice.
- **Letting a handoff complete without its photo/acknowledgment/seal step** — structurally forbidden.

## Relevant data model entities

`Hub`, `User` (operator), `HandoffRecord` (the evidence backbone — intake, contents, seal, dispatch),
`Item` (`actual_weight_kg`, `seal_id`), `ShipmentLeg`, `TripLeg` (capacity), `EscrowRecord`,
`RestrictionCheck`, `OperationalNote`. See [DATA_MODEL.md](../docs/DATA_MODEL.md).

## Key questions before implementing

1. Can any handoff complete without its required photo + (where applicable) acknowledgment + seal step?
   (Must be **no** — this is the core trust mechanism.)
2. Is the operator flow **guided/prompted** step-by-step rather than a blank interface?
3. Does intake prompt the explicit cash/currency check?
4. Does matching enforce the crowding constraint and prefer lower-frequency travelers?
5. Is sealing strictly **after** verification (never before)?
6. Does "no match" degrade gracefully to the manual freight fallback?
7. Does the flow work offline at the hub (queue + sync) given hubs may lack reliable WiFi?

## Anti-patterns to avoid

- A generic "complete handoff" button with optional evidence.
- Matching that over-concentrates one category on one traveler (crowding/commercial-import risk).
- Sealing before inspection, or trusting the declared weight without weighing.
- Treating the hub as able to release escrow on its own.
- Building hub automation before the human trust loop is validated.

## References

[CLAUDE.md](../CLAUDE.md) · [STATE_MACHINE.md](../docs/STATE_MACHINE.md) (intake→verify→seal→match→
dispatch, transit states, edge cases) · [RULES_ENGINE.md](../docs/RULES_ENGINE.md) (crowding, cash) ·
[DATA_MODEL.md](../docs/DATA_MODEL.md) (matching query) · [RUNBOOK.md](../RUNBOOK.md) (manual ops) ·
[GUARDRAILS.md](../GUARDRAILS.md) · [OPEN_QUESTIONS.md](../docs/OPEN_QUESTIONS.md).
