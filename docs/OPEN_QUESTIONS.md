# SHANTA — Open Questions (Founder Decision Register)

> These are decisions with major architectural implications that **must not be made by
> engineering alone**. Every deliverable that touches one of these surfaces it rather than
> silently assuming an answer. Each question documents the default we fall back to if it's
> undecided by the time it's needed, and the architectural paths for YES vs NO so neither
> path is a surprise. Run `/shanta-questions` for status at a glance. Last updated: **Phase 0**.

Status legend: **BLOCKING** (must resolve before the named phase starts) · **PENDING** ·
**RESOLVED** (record the decision + date inline).

---

## OQ-1: Does Shanta touch payment flows directly, or integrate with existing rails?

**Question:** Does Shanta hold/settle money itself (escrow, cross-border settlement) or integrate
with existing payment partners (TeleBirr, CBE Birr, a licensed remittance partner) and/or use
manual hub-held escrow?
**Why it matters architecturally:** Determines whether `EscrowRecord`'s holder is a `Hub` (manual)
or a payment provider (automated), whether we need PSP/remittance licensing, webhook/settlement
infrastructure, and reconciliation. It is the single largest fork in the financial architecture.
**Priority:** **Manual mode BLOCKS nothing** (it's the Phase 1 default); **automated/cross-border
BLOCKS PHASE 2.**
**Who decides:** Founder + legal/financial counsel + payment partner.
**Default assumption if undecided by Phase 1 start:** **Manual hub escrow** — the aggregator holds
or receives payment on the platform's behalf, released on delivery confirmation. This mirrors how
informal Ethiopian logistics already works and costs zero engineering. Treated as a legitimate
design, not a stopgap.
**Architectural paths:**
- *YES (Shanta touches money):* PSP/remittance licensing; integrate TeleBirr/CBE Birr for domestic;
  a licensed partner for cross-border; webhook→Inngest settlement; reconciliation ledger.
- *NO (integrate/manual):* `EscrowRecord.holder_type = HUB`; admin-triggered release; no custom
  financial infrastructure. Cross-border deferred entirely to Phase 2 with a partner.
- *Either way:* `EscrowRecord` and `Shipment` price fields are designed to support both holder types
  without a migration. Research NBE diaspora programs (Debo/Unite.et) before building custom rails.
**Last updated:** Phase 0.

---

## OQ-2: What is the viable pricing model per kg?

**Question:** What price per kg (and fee split across carrier/aggregator/platform/insurance) will
senders pay and travelers/aggregators accept? Estimate is ~$4–10/kg, **unvalidated**.
**Why it matters architecturally:** Pricing must be first-class and configurable so it can be tuned
as we learn real willingness-to-pay. It also determines whether small shipments are economical
(`min_charge_etb`).
**Priority:** **BLOCKS PHASE 1 launch pricing** (a number is needed to transact) but not Phase 1
*build* (the model is configurable).
**Who decides:** Founder, informed by real freight-forwarder quotes and diaspora WTP research.
**Default assumption if undecided by Phase 1 start:** Seed `CorridorPricing` with a mid-estimate
(documented as provisional) and adjust from live data; never hardcode it.
**Architectural paths:** Regardless of the number, `CorridorPricing` is versioned (effective_from/
until) and each `Shipment` stores a `pricing_snapshot`; fee components are separate fields so each
can move independently. (See [DATA_MODEL.md](DATA_MODEL.md), [RULES_ENGINE.md](RULES_ENGINE.md).)
**Last updated:** Phase 0.

---

## OQ-3: Has the official Ethiopian customs regulation been obtained and reviewed?

**Question:** Has the founder obtained and reviewed *"Instruction to Determine the Conditions to
Import Goods for Personal Use"* (Amharic + English)? The rules engine must ultimately be driven by it.
**Why it matters architecturally:** The Constraint 2.4 limits we seeded are from secondary research.
The rules engine is data-driven precisely so the authoritative document can replace/confirm them
without code changes — but someone must read it.
**Priority:** **BLOCKS PHASE 2** (international corridors have stricter, more complex rules);
strongly advisable before Phase 1 launch to confirm domestic seed values.
**Who decides:** Founder (obtain) + whoever maintains the rules engine (encode).
**Default assumption if undecided:** Use the seeded ruleset from Constraint 2.4, clearly marked
`source_regulation = "secondary research, unverified"` on each rule. See [RULES_ENGINE.md](RULES_ENGINE.md).
**Architectural paths:** No architectural fork — only data changes. The engine is built to absorb
the document via admin panel updates. The risk of NO is shipping with wrong limits, not rework.
**Last updated:** Phase 0.

---

## OQ-4: What is the protocol if a traveler is stopped at customs with a Shanta item?

**Question:** If a traveler is stopped, does Shanta provide documentation? Would such documentation
*help* the traveler or *harm* them by making the activity look organized/commercial?
**Why it matters architecturally:** Determines whether the platform may generate any external-facing
document at all. Until resolved, we build **nothing** that resembles commercial shipping paperwork
(AWB, manifest, invoice, customs declaration).
**Priority:** **BLOCKS any external-facing documentation feature** in every phase until resolved.
Does not block core Phase 1 (which has no such feature).
**Who decides:** Founder + Ethiopian customs practitioner/legal counsel — **not** engineering.
**Default assumption if undecided:** Keep all records platform-internal. Generate only informal
sender↔receiver receipts and internal handoff/status records, never anything printable as a
shipping document. See [GUARDRAILS.md](../GUARDRAILS.md), [PRD.md](PRD.md), [TRD.md](TRD.md).
**Architectural paths:**
- *YES (docs help):* design a constrained, counsel-approved document template — only after sign-off.
- *NO / unknown:* internal-only records; no print/export of operational data in shipping-doc form.
**Last updated:** Phase 0.

---

## OQ-5: Which intra-country corridor does Phase 1 target, and on what timeline/budget?

**Question:** Which single **domestic Ethiopian inter-city corridor** (e.g., Addis↔Hawassa,
Addis↔Bahir Dar, or another) is the Phase 1 launch route, and what is the realistic timeline/budget?
**Why it matters architecturally:** It does **not** change the architecture — the corridor model is
generic across all domestic city-pairs (intra-country), keyed off hub-pairs/region-pairs. It does
determine seed data (`Hub`, `CorridorPricing`) and where supply/demand instrumentation focuses.
**Priority:** **BLOCKS PHASE 1 launch** (need a route to operate) but **not** Phase 1 build.
**Who decides:** Founder, informed by market testing (supply depth + demand signals per corridor).
**Default assumption if undecided:** Build corridor-agnostic; defer route selection to market
testing. Worked examples in docs use Addis↔Hawassa illustratively only.
**Architectural paths:** None diverge. Only seed data differs. International routes remain Phase 2.
**Last updated:** Phase 0.

---

## OQ-6: Is Ethiopia's Fayda national digital ID verification API production-ready for Phase 1?

**Question:** Can we integrate Fayda (MOSIP-based, launched 2023) for automated identity
verification of travelers/aggregators in Phase 1, or do we rely on manual staff review?
**Why it matters architecturally:** Determines whether KYC is real-time API or a manual admin queue.
**Priority:** **PENDING** — does not block Phase 1 (manual review is the default).
**Who decides:** Founder + tech lead (after researching Fayda API readiness).
**Default assumption if undecided:** **Manual ID-document review** by Shanta staff via admin panel.
**Architectural paths:** `User.kyc_status` + `kyc_method` fields support both; switching to Fayda
later requires no schema change — only a new verification service. See [DATA_MODEL.md](DATA_MODEL.md).
**Last updated:** Phase 0.

---

## OQ-7: Is Shanta a registered VAT collector (15%)?

**Question:** Is Shanta obligated to collect Ethiopia's 15% VAT on its services, and on which fee
components?
**Why it matters architecturally:** Pricing must carry `tax_rate`/`tax_amount` fields from day one
so VAT can be switched on without a schema change.
**Priority:** **PENDING** — does not block Phase 1 build; blocks correct invoicing at scale.
**Who decides:** Founder + accountant/legal counsel.
**Default assumption if undecided:** `tax_rate = 0` in Phase 1, fields present and ready.
**Architectural paths:** No fork — data fields already exist on `Shipment`/`CorridorPricing`.
**Last updated:** Phase 0.

---

## OQ-8: How do we prevent Sybil attacks (one person, many traveler profiles) circumventing limits?

**Question:** A person could create multiple traveler profiles (different phone numbers/IDs) to carry
more than their individual customs allowance. How far do we go to prevent this per phase?
**Why it matters architecturally:** Affects identity uniqueness constraints and how aggregately we
must enforce per-person (not just per-profile) limits.
**Priority:** **PENDING** — known vulnerability; mitigated, not fully solved, in Phase 1.
**Who decides:** Founder + tech lead.
**Default assumption if undecided:** Phase 1 relies on **phone-number uniqueness + national-ID
uniqueness at KYC + aggregator visual ID check at handoff**. Flagged as a known limitation.
**Architectural paths:** Phase 2+ may add ID-hash uniqueness and cross-profile aggregation. Data
model stores `id_document` reference to enable later de-duplication. See [DATA_MODEL.md](DATA_MODEL.md).
**Last updated:** Phase 0.

---

## OQ-9: What is the PII retention & anonymization policy?

**Question:** How long do we retain phone numbers, ID references, item-content descriptions, and
handoff photos? When/if are completed-shipment records anonymized?
**Why it matters architecturally:** Determines retention jobs, signed-URL access logging, and whether
an anonymization routine is needed.
**Priority:** **PENDING** — not Phase 1 blocking; needed before scale and for legal compliance.
**Who decides:** Founder + legal counsel.
**Default assumption if undecided:** Active shipment data kept indefinitely; completed-shipment PII
*anonymizable* after 2 years (not auto-deleted in Phase 1). ID/handoff photos access-controlled via
1-hour signed URLs with access logging. See [TRD.md](TRD.md) security section.
**Last updated:** Phase 0.

---

## OQ-10: Which SMS provider backs Supabase phone-OTP for real delivery?

**Question:** Supabase Auth handles phone OTP, but needs an SMS provider to actually deliver
codes. Built-in providers (Twilio, Vonage, MessageBird/Bird, TextLocal) aren't free and have
varying Ethiopia coverage. We plan to use a **Supabase Send-SMS auth hook → Africa's Talking**
(confirmed ET coverage). Is that the chosen path, and is the AT account/short-code ready?
**Why it matters architecturally:** Determines whether we configure a built-in Supabase SMS
provider or implement the custom Send-SMS hook (a Supabase Edge Function / HTTPS endpoint that
calls Africa's Talking). Introduced by [ADR-0001](DECISIONS.md).
**Priority:** **BLOCKS real-SMS sign-in** (not dev). Dev uses Supabase **test phone numbers**
(fixed OTP, no SMS), so it does not block this milestone.
**Who decides:** Founder (AT account) + tech lead (hook implementation).
**Default assumption if undecided:** Supabase test phone numbers in dev; wire the Africa's
Talking Send-SMS hook before any external user.
**Architectural paths:** built-in provider (fastest, paid, coverage TBD) vs custom AT hook
(matches Phase 0 SMS choice, ET coverage). No data-model impact either way.
**Last updated:** Phase 1 kickoff.

---

### Decision log

When any question resolves, change its status to **RESOLVED**, record the decision and date inline,
and propagate the consequence to [CLAUDE.md](../CLAUDE.md) and the affected doc(s). A resolved
question that hasn't been propagated is not actually resolved.
