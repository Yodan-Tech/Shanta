# Shanta — Custom Slash Commands

Five commands for working on Shanta. Each can be run as a Claude Code slash command (drop the prompt
into a `.md` file in this directory named for the command) or pasted manually. They all assume the
session has read [CLAUDE.md](../../CLAUDE.md) first. They exist to keep every contributor — technical
or not — anchored to the constraints, phase scope, and guardrails.

---

## `/shanta-check [feature description]`

**Purpose:** Evaluate a proposed feature against current phase scope, all 5 constraints, and the
guardrails — before anyone builds it.
**Usage:** `/shanta-check add a traveler rating system so senders pick the best couriers`
**Output format:** a verdict line — **PROCEED** / **REDESIGN** / **DEFER TO PHASE [N]** / **NEEDS
FOUNDER DECISION** — followed by a per-criterion table (phase scope; Constraint 2.1/2.2/2.3/2.4/2.5;
relevant open question; guardrail/anti-pattern match) each marked ✅/⚠️/❌ with one line of reasoning,
then a short recommendation.

**Prompt to run:**
```
You are evaluating a proposed Shanta feature. Read CLAUDE.md, GUARDRAILS.md, PHASE_PLAN.md, and
OPEN_QUESTIONS.md as your context. The feature is:

"<FEATURE DESCRIPTION>"

Evaluate it against, and report a ✅/⚠️/❌ + one line for each:
1. Current phase scope (is this Phase 1, or should it defer? cite PHASE_PLAN).
2. Constraint 2.1 (frequent-traveler): does it incentivize a small high-frequency pool or expose
   frequency as a public score/reward? (If yes → ❌.)
3. Constraint 2.2 (unwitting mule): does it weaken or strengthen the photo+acknowledgment+seal chain?
4. Constraint 2.3 (Addis transit / multi-hop): does it assume single-hop and break multi-leg?
5. Constraint 2.4 (item caps): does it touch the rules engine? Is it kept configurable, not hardcoded?
6. Constraint 2.5 (forex/cash): does it drift toward money-movement or forex workaround?
7. Open questions: does it assume an unresolved OQ (esp. OQ-1 payment, OQ-4 customs docs)?
8. Guardrails/anti-patterns: does it match any "trap that looks like a good idea"?

Then output ONE verdict: PROCEED / REDESIGN (say how) / DEFER TO PHASE N (say why) / NEEDS FOUNDER
DECISION (say which OQ). Be specific to Shanta, not generic.
```

---

## `/shanta-state`

**Purpose:** Print the current shipment state machine as a readable table with transitions.
**Usage:** `/shanta-state`
**Output format:** the state list (state · owner · meaning) and the transition table (from → to ·
trigger · actor · verification · recorded), including exception states.

**Prompt to run:**
```
Read docs/STATE_MACHINE.md. Print: (1) the full list of states with owning actor and one-line
meaning (including exception states), and (2) the transition table as From → To | Trigger | Actor |
Verification | Recorded. Note explicitly which states are Phase 2 only (CUSTOMS_CLEARANCE,
AT_TRANSIT_HUB). Do not invent transitions not in the doc; if asked about one not listed, say it is
invalid and why.
```

---

## `/shanta-rules`

**Purpose:** Print the current rules-engine configuration as a readable table.
**Usage:** `/shanta-rules`
**Output format:** a table of `ItemRestriction` records (category · corridor · max weight · frequency-
sensitive limits · prohibited · permit/declaration · direction · source) plus the crowding-constraint
note and the cash prohibition.

**Prompt to run:**
```
Read docs/RULES_ENGINE.md. Print the initial ruleset as a table: item_category | corridor | max_weight
| frequent-limit (if frequency_sensitive) | prohibited | requires_permit | requires_declaration |
direction | source_regulation. After the table, state (a) the crowding constraint in one sentence and
(b) that CASH is a hard prohibition (never a limit). Flag that all source_regulation values are
"unverified" until OQ-3 is resolved.
```

---

## `/shanta-questions`

**Purpose:** Print all open questions with current status.
**Usage:** `/shanta-questions`
**Output format:** a table — OQ-ID · title · status (RESOLVED/PENDING/BLOCKING) · who decides ·
default assumption — sorted with BLOCKING first.

**Prompt to run:**
```
Read docs/OPEN_QUESTIONS.md. Print every OQ as a table: ID | title | status (BLOCKING/PENDING/
RESOLVED) | priority (which phase it blocks) | who decides | default-if-undecided. Sort BLOCKING
first. If any are RESOLVED, show the decision. Do not editorialize beyond the doc.
```

---

## `/shanta-phase`

**Purpose:** Print the current phase, what's in scope, the next validation gate, and what's explicitly
out of scope right now.
**Usage:** `/shanta-phase`
**Output format:** current phase + focus; in-scope feature list; the next gate's measurable conditions;
the "not now / out of scope" list with one-line reasons.

**Prompt to run:**
```
Read CLAUDE.md and docs/PHASE_PLAN.md (and docs/PRD.md for the feature lists). Print: (1) the current
phase and its focus, (2) what is IN scope now (the Phase 1 MUST-HAVE list), (3) the next validation
gate as the measurable "DO NOT PROCEED UNTIL" conditions, and (4) what is explicitly OUT of scope now,
each with its one-line reason. Keep it scannable.
```
