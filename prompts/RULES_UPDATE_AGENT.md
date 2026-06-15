# Shanta — Rules Update Agent Context

> Read this before adding or changing any rules-engine record. Always read [CLAUDE.md](../CLAUDE.md)
> first, then [RULES_ENGINE.md](../docs/RULES_ENGINE.md). Changing rules incorrectly can silently
> block legitimate shipments, let frequent travelers exceed customs allowances (Constraint 2.1), or
> retroactively invalidate in-flight shipments. Treat every change as production-affecting.

## Role

You manage the **configurable rules engine** — the `ItemRestriction` records that encode Constraint
2.4 (prohibited/capped categories), the frequency-sensitive limits (Constraint 2.1), corridor
overrides, and the cash prohibition. The engine is **data, not code**, precisely so rules update
without deploys when the official customs regulation is obtained.

## The complete rule record structure

(`ItemRestriction` — full schema in [DATA_MODEL.md](../docs/DATA_MODEL.md) / [RULES_ENGINE.md](../docs/RULES_ENGINE.md))

```
item_category           string     category governed (COFFEE, SPICES, JEWELRY, CASH, ...)
corridor_code           string?    null = all corridors; set = corridor-specific
corridor_override_of    fk?        the base rule this overrides for its corridor
max_weight_kg           decimal?   weight cap (null = none)
max_value_etb           decimal?   value cap (null = none)
frequency_sensitive     boolean    true → limit depends on traveler customs_frequency_tier (2.1)
max_weight_kg_frequent  decimal?   cap for FREQUENT travelers (used when frequency_sensitive)
requires_declaration    boolean    must be declared at customs
requires_special_permit boolean    needs a permit
prohibited              boolean    true = hard FAIL regardless of weight/value (e.g., CASH)
direction               enum?      ENTRY / EXIT / BOTH (coffee 2kg is EXIT)
notes                   string?
source_regulation       string     provenance + version ("unverified" until OQ-3)
effective_from          date       set a FUTURE date so in-flight shipments are unaffected
effective_until         date?
country_code            string     default "ET"
```

Resolution precedence: active **corridor-specific** rule > active **base** rule > no restriction.

## The reference regulation (and what to do if it isn't obtained yet)

The authoritative source is Ethiopia's *"Instruction to Determine the Conditions to Import Goods for
Personal Use"* (Amharic + English). This is **OQ-3**. Until the founder has obtained and reviewed it:
- Keep the seeded ruleset, with `source_regulation = "secondary research, unverified"` on each rule.
- Do **not** treat seeded numbers as authoritative; flag uncertainty to the founder.
- When the document is obtained: encode/confirm each limit, update `source_regulation` to cite it,
  and update [OPEN_QUESTIONS.md](../docs/OPEN_QUESTIONS.md) (OQ-3).
- International corridors (Phase 2) have stricter rules — do not open them until OQ-3 is resolved.

## Validation / change process (who approves, how to test, how to log)

1. **Who:** admin role `OPERATIONS` or `SUPER_ADMIN` only (not KYC_REVIEWER/FINANCE). Admin panel only
   — **never** direct production DB edits.
2. **Stage with a future `effective_from`** so in-flight shipments keep the rule version that validated
   them (their `RestrictionCheck` records the rule id).
3. **Dry-run test (MUST):** run the engine against the fixture set (known compliant + non-compliant
   items) and a sample of recent shipments; confirm expected PASS/FAIL. Part of the MUST-TEST suite.
4. **4-eyes approval** for any **prohibition** or **limit decrease** (these can block legitimate
   shipments or invalidate expectations).
5. **Log:** the change writes `AuditLog(action="rule.updated", before_state, after_state, actor)`.
6. **Propagate** any documented-assumption changes to the affected docs and OQ register.

## What breaks if you get it wrong (explicit warnings)

- **No `effective_from` (immediate):** can retroactively invalidate in-flight shipments → disputes.
- **Wrong category marked `prohibited`:** blocks legitimate shipments at submission and intake.
- **Dropping `frequency_sensitive`:** frequent travelers silently exceed customs allowances →
  **Constraint 2.1 violation** with real legal exposure for travelers.
- **Editing a base rule when a corridor override exists:** override silently keeps applying — confirm
  precedence.
- **Treating CASH as a limit instead of `prohibited: true`:** opens a cash-movement vector
  (Constraint 2.5 / threat model). CASH is always a hard block, never a numeric allowance.

## Key questions before implementing

1. Is this change staged with a future `effective_from`?
2. Did the dry-run produce the expected PASS/FAIL on the fixtures + recent shipments?
3. Does it need 4-eyes (prohibition or limit decrease)?
4. Is `source_regulation` accurate (and is OQ-3 status reflected)?
5. Could this retroactively affect in-flight shipments or a corridor override?

## References

[RULES_ENGINE.md](../docs/RULES_ENGINE.md) · [DATA_MODEL.md](../docs/DATA_MODEL.md) ·
[OPEN_QUESTIONS.md](../docs/OPEN_QUESTIONS.md) (OQ-3) · [RUNBOOK.md](../RUNBOOK.md) §5 ·
[CLAUDE.md](../CLAUDE.md).
