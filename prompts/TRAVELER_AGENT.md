# Shanta — Traveler Agent Context

> Read this before working on any traveler-facing feature. Always read [CLAUDE.md](../CLAUDE.md) first.
> This area is where **Constraint 2.1** (frequency) and **Constraint 2.2** (content verification) are
> most load-bearing — treat both as non-negotiable.

## Role

You implement and reason about the **Traveler/Carrier (Node 2)** experience: trip listing, match
review, the content-verification acceptance flow, custody handoffs, and frequency tracking. Two tiers:
**casual** (a few kg, **near-zero friction** or they won't participate) and **professional courier**
(higher capacity, higher KYC). Both must be served without turning travelers into a high-frequency
power-user core.

## In scope

- Phone+OTP onboarding; traveler KYC = **phone + name + national ID** (manual review); professional =
  **+ face match**. No trips until `kyc_status = VERIFIED`.
- **Trip + TripLeg listing:** mode, origin/destination region, depart/arrive, per-leg capacity_kg.
  Per-leg capacity is what matching and the crowding constraint read.
- **Match review + content verification (Constraint 2.2 — fully specified, non-negotiable):**
  - At handoff the traveler is shown the **contents and intake photos**.
  - To take custody, the traveler **must** click the acknowledgment with this exact intent: *"I have
    inspected the contents and they match the declared description."* Store the exact copy on the
    `HandoffRecord` (`acknowledged = true`).
  - The app must make it **structurally impossible** to reach `WITH_TRAVELER` without that
    acknowledgment, and impossible to take an item whose seal isn't intact.
  - **Refusal is normal:** `TRAVELER_REVIEWED → TRAVELER_REJECTED` is an expected state, not an error;
    the item re-enters matching. Make refusal a graceful, one-tap action.
  - Acknowledgment copy must be accurate — not inflated (scares casual travelers off) nor understated
    (fails the due-diligence purpose). Localize (en/am).
- **Frequency tracking (Constraint 2.1 — internal only):** `TravelProfile` 30/90-day/lifetime counts +
  `customs_frequency_tier`. Matching **prefers lower-frequency** travelers; jewelry uses the
  frequency-sensitive cap. **Never** display frequency, scores, badges, or leaderboards to anyone.
- **Delivery confirmation (when traveler delivers directly):** **live-capture photo only** (no
  gallery), with timestamp/geo.

## Out of scope (with the reason)

- **Ratings, leaderboards, badges, frequency rewards, "top courier" lists** — directly violates
  Constraint 2.1 (rewards the small high-frequency pool whose customs allowances shrink). This is the
  single most important anti-pattern in the whole product.
- **Letting a traveler accept unlimited same-category items** — the crowding constraint
  ([RULES_ENGINE.md](../docs/RULES_ENGINE.md)) caps per-category, per-trip cargo (5 spice senders ≠ 1
  traveler).
- **Gallery upload for delivery confirmation** — enables fake delivery; live capture only.
- **Skipping ID verification "to reduce friction"** — travelers bear customs liability; ID is the
  accountability + anti-Sybil anchor (OQ-8). Reduce friction elsewhere (fast onboarding, fast accept).
- **International trips / iOS** — Phase 2.

## Relevant data model entities

`User` (`traveler_tier`, `kyc_*`), `TravelProfile`, `Trip`, `TripLeg`, `ShipmentLeg`, `HandoffRecord`,
`Item`. The matching query (DATA_MODEL "Core Queries") enforces frequency order + crowding.

## Key questions before implementing

1. Can the traveler reach custody without the acknowledgment + an intact seal? (Must be **no**.)
2. Is `TRAVELER_REJECTED` handled gracefully and does it re-queue the item?
3. Does anything surface frequency/ratings to any user? (Must be **no** — Constraint 2.1.)
4. Does matching prefer lower-frequency travelers and enforce the crowding cap?
5. Is delivery confirmation live-capture only with timestamp/geo?
6. Is the casual-traveler path genuinely low-friction (fast onboarding, fast accept)?

## Anti-patterns to avoid

- Any gamification of frequency/volume. Any public reputation surface.
- An acknowledgment that's a buried checkbox (must be a clear, understood action with stored copy).
- Treating rejection as an error/dead-end.
- Matching that ignores `category_weight_accepted` (crowding) or trip-leg capacity.

## References

[CLAUDE.md](../CLAUDE.md) · [STATE_MACHINE.md](../docs/STATE_MACHINE.md) (verification/sealing states,
`TRAVELER_REJECTED`) · [RULES_ENGINE.md](../docs/RULES_ENGINE.md) (frequency + crowding) ·
[GUARDRAILS.md](../GUARDRAILS.md) · [DATA_MODEL.md](../docs/DATA_MODEL.md) ·
[OPEN_QUESTIONS.md](../docs/OPEN_QUESTIONS.md) (OQ-8 Sybil).
