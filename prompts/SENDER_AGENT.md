# Shanta — Sender Agent Context

> Read this before working on any sender-facing feature. It is your scoped context — you do **not**
> need the full TRD, just this plus the docs it references. Always read [CLAUDE.md](../CLAUDE.md) first.

## Role

You implement and reason about the **Sender (Node 1)** experience: account/auth, item submission,
rules validation at submission time, price visibility, escrow initiation, and shipment tracking. The
Phase 1 primary sender is **domestic** (Addis → another Ethiopian city); the diaspora sender is a
Phase 2 primary but the design must not exclude them.

## In scope

- Phone + OTP onboarding; sender KYC tier = **phone + full name** (national ID only for high-value,
  threshold via `AppConfig`).
- **Item submission:** category, declared weight, declared value, description (the "what's inside"),
  origin/destination region, receiver name + phone. Idempotency-Key on create.
- **Rules validation AT SUBMISSION** — run the rules engine *before* the sender travels to a hub, so
  prohibited/over-limit items fail fast with a clear reason. (At submission, frequency-sensitive rules
  use the stricter FREQUENT limit; final binding check is at match time.)
- **Price visibility:** show the breakdown (carrier, aggregator, platform, insurance, tax) from
  `CorridorPricing`; store `pricing_snapshot` on the shipment.
- **Escrow initiation:** create `EscrowRecord` (Phase 1 `holder_type = HUB`, manual). Do **not**
  build payment processing.
- **Tracking:** sender sees current status + the evidence chain (intake photo, who has custody, seal
  status), and gets push/SMS updates.

## Out of scope (with the reason)

- **Automated/cross-border payment** — OQ-1 unresolved; manual hub escrow only. ([OQ-1](../docs/OPEN_QUESTIONS.md))
- **Any printable shipping document / customs paperwork** — OQ-4; records stay internal. ([GUARDRAILS](../GUARDRAILS.md))
- **Direct sender↔traveler chat / matching** — recreates the PiggyBee hub-bypass trap.
- **Showing traveler ratings/frequency** to the sender — Constraint 2.1; frequency is internal only.
- **iOS** (Phase 2) and **international corridors** (Phase 2).

## Relevant data model entities

`User`, `Shipment` (+ price fields, `pricing_snapshot`, `idempotency_key`), `Item`, `RestrictionCheck`,
`EscrowRecord`, `CorridorPricing`, `Notification`. See [DATA_MODEL.md](../docs/DATA_MODEL.md).

## Key questions before implementing

1. Does this run the rules engine at submission (not only at hub intake)? If not, why?
2. Is the price computed from `CorridorPricing` and snapshotted on the shipment?
3. Is shipment creation idempotent (Idempotency-Key) to survive mobile retries (Edge 7)?
4. Does any UI here expose traveler frequency/ratings? (It must not — Constraint 2.1.)
5. Does anything here assume OQ-1 (payment) or OQ-4 (documents) is resolved?

## Anti-patterns to avoid

- Validating rules only at hub intake (sender wastes a trip discovering rejection).
- Storing a computed price without its pricing version → historical mis-pricing.
- Letting the sender pick/contact a specific traveler.
- Building a "share my shipment as a PDF/manifest" feature (OQ-4).

## References

[CLAUDE.md](../CLAUDE.md) · [RULES_ENGINE.md](../docs/RULES_ENGINE.md) ·
[STATE_MACHINE.md](../docs/STATE_MACHINE.md) · [PRD.md](../docs/PRD.md) ·
[DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md) · [OPEN_QUESTIONS.md](../docs/OPEN_QUESTIONS.md)
