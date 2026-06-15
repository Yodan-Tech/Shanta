# SHANTA — Rules Engine

> How Shanta decides what may be shipped. Implements Constraint 2.4 (prohibited/capped categories),
> the frequency-sensitive limits of Constraint 2.1 (jewelry), the crowding constraint, and the
> cash-prohibition. **Rules are configurable data (`ItemRestriction` rows), never hardcoded logic** —
> so the official customs regulation (OQ-3) can be encoded without a deploy. Run `/shanta-rules` for
> the live table.

## Design Philosophy

The set of restricted items, their limits, and how they vary by corridor and traveler frequency
**will change** — when the official regulation is obtained (OQ-3), when a new corridor opens, when
authorities update allowances. If those limits were `if (category === 'COFFEE' && kg > 2)` in code,
every change is a code review + deploy + regression risk. Instead:

- Every rule is a row in `ItemRestriction` (schema in [DATA_MODEL.md](DATA_MODEL.md)).
- The engine is a **pure function** of (items, corridor, traveler frequency tier, current rules) →
  result. No business limits live in code; only the *evaluation logic* does.
- Rule changes go through the admin panel + an approval/test flow (below), logged in `AuditLog`.
- The governing document is Ethiopia's *"Instruction to Determine the Conditions to Import Goods for
  Personal Use."* Until obtained/verified (OQ-3), every seeded rule carries
  `source_regulation = "secondary research, unverified"`.

---

## Rule Record Schema (`ItemRestriction`)

| Field | Type | Null | Description |
|---|---|---|---|
| id | string | – | PK. |
| item_category | string | – | Category this rule governs (COFFEE, SPICES, BUTTER, JEWELRY, CASH, ELECTRONICS, PHARMA, PLASTIC_DRUM, …). |
| corridor_code | string | ✓ | **Null = applies to all corridors.** Set = corridor-specific. |
| corridor_override_of | string (FK self) | ✓ | If set, this rule overrides the referenced base rule for its corridor. |
| max_weight_kg | decimal | ✓ | Per-passenger weight cap; null = no weight cap. |
| max_value_etb | decimal | ✓ | Value cap; null = none. |
| frequency_sensitive | boolean | – | True → limit depends on traveler's `customs_frequency_tier` (2.1). |
| max_weight_kg_frequent | decimal | ✓ | Cap applied to FREQUENT travelers (used when frequency_sensitive). |
| requires_declaration | boolean | – | Item must be declared at customs (e.g., laptops). |
| requires_special_permit | boolean | – | Needs a permit (coffee above cap, pharma). |
| prohibited | boolean | – | **True = never allowed** (cash). Hard fail regardless of weight/value. |
| direction | enum | ✓ | ENTRY / EXIT / BOTH. (Coffee 2kg is EXIT-specific.) |
| notes | string | ✓ | Human context. |
| source_regulation | string | – | Provenance + version. |
| effective_from | date | – | When the rule takes effect. |
| effective_until | date | ✓ | Null = open-ended. |
| country_code | string | – | Default "ET". |

**Resolution precedence** for a given (category, corridor, date):
1. Active corridor-specific rule (`corridor_code = X`, within effective window).
2. Else the active base rule (`corridor_code = null`).
3. Else: **no restriction** for that category (allowed, subject to general declaration defaults).

---

## Initial Ruleset (Constraint 2.4 as actual JSON records)

These are real seed records (`prisma/seed.ts` in Phase 1), not illustrations. All
`source_regulation` marked unverified pending OQ-3.

```json
[
  {
    "id": "rst_coffee_exit",
    "item_category": "COFFEE",
    "corridor_code": null,
    "max_weight_kg": 2.0,
    "frequency_sensitive": false,
    "requires_declaration": true,
    "requires_special_permit": true,
    "prohibited": false,
    "direction": "EXIT",
    "notes": "Coffee max 2kg per passenger on exit; special authorization needed beyond this.",
    "source_regulation": "secondary research, unverified",
    "effective_from": "2026-01-01",
    "effective_until": null,
    "country_code": "ET"
  },
  {
    "id": "rst_spices",
    "item_category": "SPICES",
    "corridor_code": null,
    "max_weight_kg": 5.0,
    "frequency_sensitive": false,
    "requires_declaration": false,
    "requires_special_permit": false,
    "prohibited": false,
    "direction": "BOTH",
    "notes": "Spices max 5kg.",
    "source_regulation": "secondary research, unverified",
    "effective_from": "2026-01-01",
    "country_code": "ET"
  },
  {
    "id": "rst_butter",
    "item_category": "BUTTER",
    "corridor_code": null,
    "max_weight_kg": 5.0,
    "frequency_sensitive": false,
    "requires_declaration": false,
    "prohibited": false,
    "direction": "BOTH",
    "notes": "Butter max 5kg.",
    "source_regulation": "secondary research, unverified",
    "effective_from": "2026-01-01",
    "country_code": "ET"
  },
  {
    "id": "rst_jewelry",
    "item_category": "JEWELRY",
    "corridor_code": null,
    "max_weight_kg": 0.1,
    "frequency_sensitive": true,
    "max_weight_kg_frequent": 0.05,
    "requires_declaration": true,
    "prohibited": false,
    "direction": "BOTH",
    "notes": "Jewelry 100g non-frequent traveler; 50g frequent traveler (Constraint 2.1).",
    "source_regulation": "secondary research, unverified",
    "effective_from": "2026-01-01",
    "country_code": "ET"
  },
  {
    "id": "rst_cash",
    "item_category": "CASH",
    "corridor_code": null,
    "max_weight_kg": null,
    "max_value_etb": null,
    "frequency_sensitive": false,
    "prohibited": true,
    "direction": "BOTH",
    "notes": "Shanta must NEVER function as a cash-movement mechanism, even informally. Hard prohibition.",
    "source_regulation": "Constraint 2.4 / platform policy",
    "effective_from": "2026-01-01",
    "country_code": "ET"
  },
  {
    "id": "rst_electronics_laptop",
    "item_category": "ELECTRONICS",
    "corridor_code": null,
    "max_weight_kg": null,
    "frequency_sensitive": false,
    "requires_declaration": true,
    "prohibited": false,
    "direction": "BOTH",
    "notes": "Laptops/electronics must be declared on entry and exit.",
    "source_regulation": "secondary research, unverified",
    "effective_from": "2026-01-01",
    "country_code": "ET"
  },
  {
    "id": "rst_pharma",
    "item_category": "PHARMA",
    "corridor_code": null,
    "frequency_sensitive": false,
    "requires_special_permit": true,
    "prohibited": true,
    "direction": "BOTH",
    "notes": "Pharmaceuticals require special permits; EXCLUDED from MVP entirely (prohibited in Phase 1).",
    "source_regulation": "secondary research, unverified",
    "effective_from": "2026-01-01",
    "country_code": "ET"
  },
  {
    "id": "rst_plastic_drum",
    "item_category": "PLASTIC_DRUM",
    "corridor_code": "ADDIS_INBOUND",
    "frequency_sensitive": false,
    "prohibited": true,
    "direction": "ENTRY",
    "notes": "Plastic barrels/drums forbidden for personal-effects to Addis. Corridor-specific.",
    "source_regulation": "secondary research, unverified",
    "effective_from": "2026-01-01",
    "country_code": "ET"
  }
]
```

**Cash special note:** the ETB cash-carry legal limits (3,000 ETB; 10,000 ETB to/from neighboring
countries) are deliberately **not** encoded as an allowance. Cash is `prohibited: true` on the
platform — Shanta never carries cash, so there is no "limit," only a hard block.

---

## Validation Flow

**When it runs:** at **submission** (trigger `SUBMISSION` — the sender agent's responsibility; fail
fast before the sender travels to a hub) **and** at **hub intake** (trigger `HUB_INTAKE` — using the
*actual* weighed values, which may differ from declared) and on **re-match** (trigger `RE_MATCH`, for
multi-leg/Phase 2). Every run writes a `RestrictionCheck`.

**Inputs:** the list of `Item`s (category, declared/actual weight, value), the corridor, the
**direction** (entry/exit), and — for the match step — the matched traveler's `customs_frequency_tier`
and the per-traveler trip inventory (for crowding).

**Output:**
```json
{
  "result": "PASS | FAIL | NEEDS_PERMIT | NEEDS_DECLARATION",
  "items": [
    { "item_id": "itm_x", "category": "JEWELRY", "result": "FAIL",
      "failed_rule_id": "rst_jewelry", "limit_applied_kg": 0.05,
      "reason": "Declared 0.08kg jewelry exceeds 0.05kg limit for FREQUENT traveler" }
  ]
}
```

**Algorithm (pseudo):**
```
for each item:
  rule = resolveRule(item.category, corridor, date)   # corridor override > base
  if rule is null: item.result = PASS; continue
  if rule.prohibited: item.result = FAIL (prohibited); continue
  limit = rule.max_weight_kg
  if rule.frequency_sensitive and traveler.tier == FREQUENT:
      limit = rule.max_weight_kg_frequent
  if limit != null and item.weight > limit: item.result = FAIL (over limit); continue
  if rule.max_value_etb != null and item.value > rule.max_value_etb: item.result = FAIL; continue
  if rule.requires_special_permit and not item.has_permit: item.result = NEEDS_PERMIT; continue
  if rule.requires_declaration: item.result = NEEDS_DECLARATION (allowed, flagged)
  else item.result = PASS
overall = FAIL if any FAIL, else NEEDS_PERMIT if any, else NEEDS_DECLARATION if any, else PASS
```

At **submission**, traveler tier is unknown, so frequency-sensitive rules validate against the
**stricter** (FREQUENT) limit to avoid promising a sender something a frequent traveler can't carry;
the final binding check is at match time with the actual traveler's tier.

---

## Frequency-Sensitive Rules (Constraint 2.1 — explicit algorithm)

Jewelry is the canonical case (100g non-frequent vs 50g frequent). The tier comes from
`TravelProfile.customs_frequency_tier`, derived from `trip_count_last_90_days` vs a threshold stored
in `AppConfig` (e.g., `frequency.tier_threshold_90d = 4`), so the cutoff is tunable without a deploy.

```
tier = (travel_profile.trip_count_last_90_days >= AppConfig.frequency.tier_threshold_90d)
       ? FREQUENT : NON_FREQUENT
limit = rule.frequency_sensitive
        ? (tier == FREQUENT ? rule.max_weight_kg_frequent : rule.max_weight_kg)
        : rule.max_weight_kg
```

This is why the matching query (DATA_MODEL "Core Queries") also **orders by lowest 90-day frequency
first** — both to spread load across a rotating pool and to give frequency-sensitive items the most
headroom. Never expose tier or frequency to other users.

---

## Crowding Constraint (the implicit matching rule)

Even if each individual item is within its category cap, a single traveler carrying **multiple
packages of the same category** looks commercial to customs. The matching query enforces, per
traveler per trip leg:

```
SUM(weight of already-accepted items in category C on this leg) + new_item.weight  <=  category_limit
```

Operationally, also avoid matching a *third* distinct sender of the same category to one traveler
even under the weight cap (three spice packages reads as commercial). Phase 1: the operator sees
`category_weight_accepted` in the matching result and applies judgment; an `AppConfig` flag
(`crowding.max_distinct_senders_per_category = 2`) can harden this later.

---

## Corridor Override Design

A base rule (`corridor_code = null`) applies everywhere. A corridor rule (`corridor_code = "X"`,
`corridor_override_of = base.id`) replaces it for that corridor. Example: `PLASTIC_DRUM` is allowed
generally but `prohibited` for `ADDIS_INBOUND`. Resolution always prefers the most specific active
rule (corridor) over the base. This keeps Constraint 2.3/2.4 corridor-specific limits expressible
without forking the engine, and supports the generic intra-country corridor model (OQ-5).

---

## Rule Update Process (who, how, test, log)

1. **Who:** an admin with role `OPERATIONS` or `SUPER_ADMIN` (KYC_REVIEWER/FINANCE cannot). All edits
   via the admin panel — never direct DB edits in production.
2. **Draft with future `effective_from`:** new/changed rules can be staged with a future date so they
   don't affect in-flight shipments. Existing validated shipments keep the rule version that validated
   them (their `RestrictionCheck` records the rule id).
3. **Test before live:** run the rules engine in *dry-run* against a fixture set of known
   compliant/non-compliant items (and against a sample of recent shipments) and confirm expected
   PASS/FAIL. This is part of the MUST-TEST suite (TRD).
4. **Approve:** a second admin confirms (4-eyes for prohibitions and limit decreases).
5. **Log:** the change writes `AuditLog(action="rule.updated", before_state, after_state, actor)`.
6. **Propagate:** if a change affects documented assumptions, update [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)
   (esp. OQ-3) and note the regulation source.

**What breaks if done wrong:** lowering a limit without `effective_from` could retroactively invalidate
in-flight shipments; marking the wrong category `prohibited` blocks legitimate shipments at submission;
removing a `frequency_sensitive` flag silently lets frequent travelers exceed customs allowances
(Constraint 2.1 violation). See [prompts/RULES_UPDATE_AGENT.md](../prompts/RULES_UPDATE_AGENT.md).

---

## Prohibited Use Case: Cash Movement (explicit enforcement)

- `CASH` is `prohibited: true` — a hard FAIL at submission and at hub intake, regardless of value.
- The **hub intake protocol** (aggregator agent) explicitly instructs operators to look for currency
  (ETB or foreign) concealed in items; discovery → reject the item, `RestrictionCheck(FAIL)`,
  `OperationalNote`, and possible user suspension.
- The acknowledgment copy and item declaration both reinforce that money/currency may not be shipped.
- This protects against Shanta being used as a cash-movement vector (threat model) or a forex
  workaround (Constraint 2.5).
