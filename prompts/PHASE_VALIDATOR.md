# Shanta — Phase Validator

> A decision-support prompt for sense-checking any feature idea or technical proposal against
> everything Shanta has decided. **Designed to be usable by a non-technical founder** as well as by
> Claude Code. It is the human-readable companion to the `/shanta-check` command. Always grounded in
> [CLAUDE.md](../CLAUDE.md), [GUARDRAILS.md](../GUARDRAILS.md), [PHASE_PLAN.md](../docs/PHASE_PLAN.md),
> and [OPEN_QUESTIONS.md](../docs/OPEN_QUESTIONS.md).

## Role

Given any proposed feature or technical decision, produce a **structured verdict** with specific
reasoning for each criterion — so we never build something that quietly violates a constraint, jumps a
phase, or assumes an unresolved decision. The point is to make the right call *obvious before code is
written*, not to be a gate that says "no" by default.

## How to use it

Paste the proposal in place of `<PROPOSAL>` below and answer each criterion honestly. If you're the
founder sense-checking an idea, you don't need to know the code — just read the criteria and the
plain-language reasoning. The output ends in one of four verdicts.

## The evaluation prompt

```
You are the Shanta Phase Validator. Read CLAUDE.md, GUARDRAILS.md, PHASE_PLAN.md, PRD.md, and
OPEN_QUESTIONS.md. Evaluate this proposal:

"<PROPOSAL>"

Walk through each criterion. For each, give a ✅ (fine) / ⚠️ (caution, needs change) / ❌ (blocks),
plus one or two plain sentences of reasoning specific to Shanta:

A. PHASE FIT — Is this in the current phase's scope (PHASE_PLAN)? If it belongs to Phase 2/3, say so
   and which gate must be met first.
B. CONSTRAINT 2.1 (frequent traveler) — Does it reward/encourage a small high-frequency traveler
   pool, or expose frequency/ratings to users? (Either → ❌.)
C. CONSTRAINT 2.2 (unwitting mule) — Does it preserve the photo + acknowledgment + tamper-seal
   evidence chain? Does it weaken any verification step?
D. CONSTRAINT 2.3 (Addis transit / multi-hop) — Does it assume a single origin→destination hop and
   break the multi-leg model?
E. CONSTRAINT 2.4 (item caps) — Does it touch what can be shipped? Are limits kept as configurable
   rules-engine data, not hardcoded?
F. CONSTRAINT 2.5 (forex/cash) — Does it drift toward money movement, cash carriage, or a forex
   workaround?
G. OPEN QUESTIONS — Does it assume an unresolved OQ is decided? Flag the OQ (especially OQ-1 payment,
   OQ-3 customs regulation, OQ-4 customs documents).
H. PRIOR-PLATFORM LESSONS — Does it repeat a known failure? (PiggyBee: bypassing the hub. Shyp:
   expanding before unit economics. Grabr: removing escrow.)
I. GUARDRAILS / TRAPS — Does it match a "trap that looks like a good idea" in GUARDRAILS.md?
J. RISK/LEARNING VALUE — Does it help validate or kill one of the 5 riskiest assumptions, or is it
   premature scale/sophistication?

Then output exactly ONE verdict with a one-paragraph justification:
- PROCEED — in scope, no constraint/guardrail conflict, serves learning.
- REDESIGN — keep the goal but change the approach; state the specific change.
- DEFER TO PHASE [N] — right idea, wrong time; state the gate that must be met first.
- NEEDS FOUNDER DECISION — depends on an unresolved open question; name the OQ and who decides.

Be concrete and Shanta-specific. Never approve something that violates Constraint 2.1 or 2.2 — those
do not bend.
```

## Worked example (for calibration)

**Proposal:** "Add a 'Top Travelers' leaderboard and bonus payouts for the most active carriers."
- A. Phase fit ⚠️ (gamification isn't a Phase 1 need). B. Constraint 2.1 ❌ — rewards high-frequency
  carriers whose customs allowances shrink and scrutiny grows; this optimizes the exact thing that
  breaks the model. H. PiggyBee/Shyp n/a; but this is the canonical Shanta anti-pattern. I. Matches
  "traveler rating/leaderboard" trap directly.
- **Verdict: REDESIGN** → if the goal is reliable supply, grow a **broad rotating pool** of casual
  travelers; keep frequency internal for risk; never expose scores or reward volume.

## References

[CLAUDE.md](../CLAUDE.md) · [GUARDRAILS.md](../GUARDRAILS.md) · [PHASE_PLAN.md](../docs/PHASE_PLAN.md) ·
[PRD.md](../docs/PRD.md) · [OPEN_QUESTIONS.md](../docs/OPEN_QUESTIONS.md) ·
command form: [/shanta-check](../.claude/commands/README.md).
