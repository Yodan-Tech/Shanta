# SHANTA — Supplementary Context for Opus 4.8
## Send this as your SECOND message, immediately after pasting the Phase 0 prompt

---

Before you begin producing any file, read this in full. This is additional context
that sharpens your architectural decisions. Nothing here overrides the Phase 0 prompt —
it deepens it. Integrate it into your extended thinking before writing file one.

---

## On the Weight of What You're About to Build

Phase 0 is not documentation for the sake of documentation. It is the load-bearing
structure that every future sprint, every hiring decision, every investor conversation,
and every regulatory interaction will rest on. If the state machine is wrong, fixing
it in Phase 2 costs weeks. If the data model creates the wrong assumptions, migrating
data mid-launch is dangerous. If CLAUDE.md is vague, every future session with you
drifts slightly — and architectural drift compounds.

This is also the phase most likely to be underestimated. It feels like "just writing
docs." It is not. You are making irreversible decisions: what entities exist, what
states exist, what the rules engine can and cannot express, what the tech stack costs
to change. Get these right now. The cost of thinking is zero. The cost of rethinking
mid-Phase 1 is very high.

"Perfect platform" in this context does NOT mean feature-complete. It means:
- The right abstractions that make evolution cheap, not painful
- A data model that doesn't create migration nightmares when the schema needs to grow
- Documentation that makes every future decision obvious, not a re-derivation
- A state machine flexible enough to add hops without restructuring
- A rules engine configurable enough to absorb new regulations without code changes

Over-engineering is also a failure mode. A microservices architecture for Phase 1 is
over-engineering. A custom matching algorithm before you know if travelers will show up
is over-engineering. Every decision you make should pass this test: *does this serve
our ability to learn fast, or does it serve an imagined future scale we haven't earned?*

---

## Ethiopian Market Realities — What "Low Connectivity" Actually Means

Do not treat "low connectivity" as an abstract constraint. Here is what it specifically
means for Shanta's users:

**Device landscape**:
- Android penetration is ~95%+ of smartphone users in Ethiopia
- Common devices: Tecno, Itel, Infinix — typically 1-2GB RAM, 16-32GB storage,
  mid-2010s chipset equivalents. Design for these, not for Pixels or Samsung S-series.
- iOS is present primarily in diaspora (senders abroad) — secondary, not primary
- Many receivers in regional cities are NOT smartphone users at all — feature phones
  or borrowed smartphones only. SMS must be a first-class delivery channel for them,
  not a fallback

**Connectivity reality by actor**:
- Sender abroad (diaspora): likely good connectivity — treat this normally
- Sender domestic (Addis): 4G in Addis, but variable; 3G common in other neighborhoods
- Traveler at airport: deceptively bad connectivity — airports in Ethiopia often have
  overcrowded networks. The content verification photo upload step happens HERE.
  Design for upload failure, retry queue, offline completion
- Aggregator hub operator: fixed location, potentially can have WiFi — but hub may be
  in a market area or informal space with no fixed internet. Don't assume hub WiFi
- Receiver in regional city: often 2G/3G only. SMS is more reliable than push.
  Do not require the receiver to have the app — delivery confirmation should work
  via SMS link or simple USSD if possible

**Power reliability**: Regional Ethiopian cities experience scheduled power cuts
(load shedding). Mobile devices may be low battery. Apps that require long sessions
to complete critical flows (content verification, delivery confirmation) will fail.
Each critical action must be completable in under 60 seconds of active screen time.

**Language**: Ethiopian users read Amharic (Ethiopic script). The Phase 1 MVP should
plan for Amharic UI — not in Phase 0 documentation, but the architecture must not
make localization painful to add. Use i18n-compatible frontend patterns from the start.

---

## Ethiopian Payment Landscape — What This Means for OQ-1

The payment architecture open question (OQ-1) is not abstract. Here are the real options:

**TeleBirr** (Ethio Telecom's mobile money service): Launched 2021, over 40M registered
users as of 2024. Ethiopia's largest mobile money platform. Developer API exists. This
is the most likely integration path for domestic ETB payments if Shanta builds payment
integration. Dominant in all regions, not just Addis.

**CBE Birr** (Commercial Bank of Ethiopia): Major bank's mobile money offering. Very
widely used in Ethiopia, especially for people with CBE accounts (the dominant bank).

**Amole** (Dashen Bank): Popular in Addis, less so regionally.

**The manual escrow alternative** (likely Phase 1 answer): The aggregator physically
holds payment (or receives payment on behalf of the platform) until delivery is confirmed.
This is how informal Ethiopian logistics already works — the aggregator is the trusted
third party. Formalizing this pattern costs zero engineering time in Phase 1 and
validates whether the trust model works before building automated escrow. Flag this
clearly as a legitimate Phase 1 design choice, not a compromise.

**Cross-border payment is a different, harder problem**: For diaspora senders (e.g.,
paying from the US or EU), cross-border settlement into ETB is genuinely complex.
Ethiopia's NBE (National Bank of Ethiopia) has specific regulations on diaspora
remittances. The "Debo" and "Unite.et" programs are government-backed diaspora financial
inclusion initiatives — worth the founder researching as a potential partnership before
building custom cross-border infrastructure. Do not design Phase 1 around solving this.
Phase 2 problem.

**Architectural implication**: The `EscrowRecord` entity should be designed to support
both (a) manual escrow (where the "holder" is a Hub entity, not a payment processor)
and (b) automated payment escrow (where the holder is a payment provider). The schema
should support both modes without a migration.

---

## The Real Riskiest Assumptions — What Phase 1 Is Actually Testing

Phase 1 must be designed to validate or kill these specific assumptions. The architecture
should make it easy to measure these outcomes, not just run the operations.

**Riskiest Assumption 1 — Traveler supply on demand**:
Can we reliably find travelers with spare capacity on a specific corridor (say,
Addis→Bahir Dar) within a timeframe a sender is willing to wait? This is the hardest
matching problem. If the answer is "no" — if supply is too thin and unpredictable —
the business model does not work in its pure form, and the commercial freight fallback
(Section 3 of the business context) becomes critical much sooner than Phase 3.

*Implication for architecture*: The Trip and TripLeg data model must make it trivially
easy to query "how many trips with capacity exist on corridor X in window T?" This is
your core supply metric. Instrument it from day one. Also design the UX so that
"no match found" is a graceful state, not a dead end — the commercial freight fallback
needs to be handleable manually in Phase 1.

**Riskiest Assumption 2 — Aggregator reliability**:
Will hub operators actually show up, run intake professionally, execute content
verification correctly, and maintain sender/receiver trust? The aggregator is the
most important node AND the most operationally uncertain. A single bad aggregator
incident (lost item, stolen item, false verification) destroys trust faster than
10 successful deliveries build it.

*Implication for architecture*: The `HandoffRecord` and hub operation flows must give
the aggregator operator clear, step-by-step prompts — not a blank interface. The app
must make it impossible to "complete" a handoff without the photo and acknowledgment.
These are not UX suggestions; they are structural requirements. The aggregator's
operational interface is as important as the sender's booking interface.

**Riskiest Assumption 3 — Traveler acceptance of liability**:
Will travelers, after viewing contents, actually click "I have seen the contents and
they match the description"? This acknowledgment creates a form of moral and potentially
legal responsibility. Some travelers will refuse. The design must allow refusal to be
a graceful state (item goes back to hub) without breaking the shipment. And the
acknowledgment copy must be accurate about what it means — not inflated into something
that scares travelers off, not understated into something that doesn't create the
due-diligence record needed.

*Implication for architecture*: The state machine must have `TRAVELER_REJECTED` as
a valid transition from `TRAVELER_REVIEWED`. This is not an error state — it's an
expected operational state. Rejected items must re-enter the matching queue.

**Riskiest Assumption 4 — Sender willingness to pay at the price point**:
Informal alternatives (personal networks, WhatsApp groups) are free but unreliable.
Will senders pay $4–10/kg for reliability, speed, and trust? The data to answer this
does not exist yet. Do not architect as if it does.

*Implication for architecture*: Pricing must be a first-class configurable concept
(not hardcoded), so it can be adjusted as the founder learns real willingness-to-pay.
The `Shipment` entity's price fields should reflect the split (carrier, aggregator,
platform, insurance) as separate fields — so each component can be adjusted
independently as unit economics become clearer.

**Riskiest Assumption 5 — Content verification friction**:
The photo verification step adds time and creates awkwardness ("you think I'm a
smuggler?"). Is it fast enough and natural enough that travelers don't abandon the
app at this step? Or does it create so much friction that the supply side dries up?
This must be measured.

*Implication for architecture*: Log the time taken at each step of the content
verification flow. Log abandonment (started but didn't complete). These are
behavioral metrics that should be captured from day one to answer this question in
Phase 1 data rather than intuition.

---

## Architectural Patterns to Evaluate During Your Thinking

These are patterns worth explicitly evaluating for Shanta — not all will be right,
but all deserve consideration before you dismiss them.

**Event Sourcing for the State Machine**:
Instead of a mutable `status` field on a `Shipment` record, consider an append-only
event log: `ShipmentEvent(shipment_id, event_type, actor_id, metadata, timestamp)`.
The current state is always derived from replaying the event log.

Why it might be right for Shanta: (a) you get a complete, immutable audit trail by
design — vital for customs/legal purposes and for investigating disputes; (b) the
multi-hop state machine is naturally expressed as a sequence of events rather than
state mutations; (c) replaying events lets you reconstruct exactly what happened at
any point in a journey; (d) adding new event types (new states) is additive, not
destructive.

Why it might be wrong for Phase 1: (a) more complex to implement than a simple status
field; (b) requires careful thought about what constitutes an "event" vs. a "state";
(c) querying "all shipments currently in state X" requires either a derived view or
careful event log scanning.

Evaluate and decide explicitly. If you reject event sourcing, state why, and confirm
the status-field approach is explicitly designed to support the audit trail requirements
through other means (e.g., a separate `ShipmentStatusHistory` table).

**Outbox Pattern for Notifications**:
When a state transition happens, the notification (SMS/push) should be written to an
outbox table as part of the same database transaction, then a separate process reads
and sends the notification. This guarantees that a notification is never "lost" even
if the notification service is temporarily unavailable — which in an Ethiopian
connectivity context is not a theoretical concern.

This is lightweight enough to implement in Phase 1 and prevents a class of bugs
(state changed but SMS never sent) that would severely damage trust.

**Offline-First Mobile Design**:
The mobile app should assume intermittent connectivity and design accordingly:
- Critical flows (content verification photos, delivery confirmation) should queue
  locally and sync when connected — not fail with an error
- The app should show "pending sync" states clearly rather than ambiguous loading
- Optimistic updates (assume the action succeeded locally, sync in background) for
  non-critical interactions

This is architecturally different from "just handle errors gracefully." It requires
the mobile app's data layer to be built with local-first assumptions from the start.
Retrofit is hard. Consider this explicitly.

**Saga Pattern for Multi-Leg Shipments**:
A shipment spanning multiple legs involves multiple actors (traveler 1, hub 1,
traveler 2, hub 2). If something fails mid-journey (traveler 2 doesn't show up,
hub 2 is closed), the platform needs a compensating action. This is the saga pattern —
a sequence of local transactions with explicit rollback/compensation steps.

You don't need to build a saga orchestrator for Phase 1. But design the data model
and state machine so that compensation is possible: what does "undo" look like for
each transition? Document this in STATE_MACHINE.md even if full automation comes later.

---

## The Complete Threat Model — Bad Actors and Failure Modes

The state machine, data model, and verification flows must be designed assuming these
actors exist. They will.

**Bad Sender — Concealment**:
Sender declares "clothing" but packs something prohibited or illegal. The content
verification flow is the primary mitigation. But consider: what if the prohibited
item is concealed inside declared clothing? The photo verification shows clothing on
top. Design the acknowledgment copy carefully: "I have inspected the contents and
they match the declared description" — not "I have glanced at the outside of the item."
The hub operator's inspection protocol matters as much as the traveler's review.

**Ghost Traveler — Payment Without Delivery**:
Traveler accepts items and payment assignment, but "loses" the item or claims it
was confiscated. Mitigations: (a) escrow not released until delivery confirmed by
receiver; (b) item photo at handoff creates evidence of possession; (c) traveler
identity verified before accepting items. The `HandoffRecord` is evidence in disputes.

**Bad Aggregator — Inventory Theft**:
Hub operator takes items and reports them lost or undelivered. This is the hardest
threat to mitigate technically — the aggregator is a trusted party by design.
Mitigations: (a) sender receives confirmation photo when item arrives at hub; (b)
sender can see item photos from hub intake; (c) item is assigned to a specific
traveler visible to sender; (d) receiver confirms delivery. The chain of photo
evidence makes quiet theft much harder. Document this chain explicitly.

**Photo Spoofing — False Delivery Confirmation**:
Receiver (or someone posing as receiver) submits a fake photo of "delivered" item.
Mitigation consideration: delivery confirmation photo should include a timestamp
overlay, ideally GPS coordinates. The app should not allow uploading a photo from
gallery (bypasses geolocation and timestamp) — delivery confirmation photo must be
taken live in the app.

**Sybil Attack on Traveler Profiles — Limit Circumvention**:
One person creates multiple traveler profiles (different phone numbers, different IDs)
to effectively carry more cargo than their individual limits allow. Mitigation: phone
number uniqueness, national ID verification at some stage. Phase 1 may rely on
aggregator visual verification of traveler ID at handoff. Flag this as a known
vulnerability with explicit mitigations per phase.

**Platform as Cash Movement Vector**:
Someone ships cash (ETB or foreign currency) inside a package, using Shanta's escrow
to provide cover for the cash's movement. This is explicitly prohibited (Constraint 2.4).
The rules engine must include cash as a prohibited item category. The aggregator
intake inspection must specifically call out cash/currency as something to look for.
Document this in the aggregator operational protocol.

**Regulatory Sting Operation**:
Customs or regulatory authorities use Shanta as evidence that an organized commercial
cargo operation exists, attracting commercial duty classification rather than personal-effects
treatment. This is the "documentation protocol" open question (OQ-4) — and it is
genuinely unresolved. The architecture should NOT generate documents that look like
commercial shipping manifests, waybills, or freight documentation. Item records are
for platform operations, not for printing and handing to customs. Flag this constraint
explicitly in the PRD and TRD.

---

## Edge Cases the State Machine MUST Handle

These are not theoretical. They will happen in Phase 1. Each needs an explicit
transition or exception state — not a comment saying "handle this later."

1. **Flight cancellation after traveler accepted items**: Items are `WITH_TRAVELER`,
   traveler's flight is cancelled. What state do items enter? Who is notified?
   How does the item get back to the hub? What happens to escrow?

2. **Traveler misses connecting flight in Addis**: Item was `WITH_TRAVELER` on leg 1,
   cleared customs in Addis, but traveler misses leg 2 flight. Item is now physically
   in Addis with a traveler who is stuck. Multi-leg recovery path needed.

3. **Customs seizure of item**: Item is seized at customs. This is `CUSTOMS_FLAGGED`.
   What is Shanta's protocol? Who is notified? What happens to escrow? This state
   must exist even if Phase 1 is domestic only — design for Phase 2.

4. **Broken tamper seal at delivery**: Receiver reports seal was broken on arrival.
   This is a dispute. The state machine must transition to `DISPUTED` before
   `DELIVERY_CONFIRMED`. Escrow should NOT auto-release on a disputed delivery.

5. **Receiver not available**: Traveler arrives at delivery location but receiver
   is unavailable. Item cannot just sit with the traveler indefinitely. Transition
   to `DELIVERY_ATTEMPTED` → notify receiver → time limit → escalate to hub.

6. **Hub closure / aggregator goes offline**: Items are `AT_ORIGIN_HUB` but the hub
   operator becomes unreachable. Who are the items' custodian now? What's the
   recovery path for the sender?

7. **Duplicate item submission**: Sender submits the same item twice (browser
   re-submission, network retry). The system must be idempotent — especially at the
   `SUBMITTED` state. Use idempotency keys at the API level.

8. **Sender cancels after hub intake**: Sender wants to cancel after the aggregator
   has already taken possession of the item. Who bears the cost of returning the item?
   What's the fee? What state does this trigger?

9. **Weight discrepancy at hub**: Sender declared 1.5kg. Hub intake weighs 2.3kg.
   This affects price, rules compliance (might push over a category limit), and trust.
   The system must handle `WEIGHT_DISCREPANCY` as a real operational state.

10. **Timing out of the matching window**: Sender submitted an item but no traveler
    was matched within the sender's acceptable window. What happens? Auto-cancel?
    Notify sender? Fall back to commercial freight option (manual, Phase 1)?

Each of these needs an explicit state, transition, and documented outcome in
`STATE_MACHINE.md`. Not a paragraph note — actual named states and transitions.

---

## The "Crowding Problem" — Matching Constraint Not in the Business Context

This constraint is implicit in the business model but was not explicitly called out.
Include it in the rules engine and matching logic:

**A traveler cannot carry multiple items of the same category past customs without
raising a red flag.** Five senders all want to send spices to the same destination
on the same flight. Matching all five to the same traveler means one traveler showing
up with 25kg of spices, which customs will classify as commercial import, not personal
effects.

The matching system — even in Phase 1 where matching may be largely manual — must
track what a traveler has already accepted for a trip before matching new items.
A traveler who has already accepted 2kg of spices cannot be matched to another sender
with spices (per the 5kg limit), but also should not be matched to a THIRD spices
sender even at 1kg because three spice packages looks like commercial activity.

The rules engine needs a concept of "per-traveler trip inventory" — not just per-item
validation, but aggregate validation of what a traveler is carrying before a new
match is confirmed.

Design `TripLeg` to track: accepted items by category, total weight accepted, and
remaining capacity. The matching logic queries this before confirming a match.

---

## What "Not Over-Engineering" Means — Specific Boundaries

To calibrate: here is the explicit boundary between "right architecture" and
"over-engineering" for Phase 1.

**RIGHT — do these in Phase 0/1:**
- Configurable rules engine (data-driven, not hardcoded)
- Multi-hop state machine (even if Phase 1 only uses 3 states of the 15 designed)
- Per-traveler frequency tracking on `TravelProfile`
- Outbox pattern for SMS/push notifications
- Event log / status history table for audit trail
- Idempotency keys on API endpoints
- Offline-capable photo upload with local queue
- i18n-ready frontend structure (even if only English in Phase 1)
- Soft deletes + audit fields on all entities

**WRONG — don't build these in Phase 1:**
- Microservices architecture (monolith until you have a reason to split)
- ML-based matching algorithm (manual matching or simple query-based matching first)
- Real-time websocket status updates (push notifications are sufficient)
- Automated escrow release (manual hub-triggered release, or time-delayed simple logic)
- Custom payment processing (integrate TeleBirr or use manual escrow)
- API rate limiting infrastructure (Nginx config is sufficient for Phase 1 traffic)
- Multi-region deployment (single region, Addis-focused)
- GraphQL (REST is sufficient; GraphQL adds complexity for no Phase 1 benefit)
- Kubernetes / container orchestration (Railway/Render handles this)
- Full-text search (Postgres ILIKE is sufficient for Phase 1 item/trip search)
- A/B testing infrastructure (too early)
- Advanced analytics pipeline (start with simple query-based reporting)
- Fraud detection ML models (rule-based fraud flags are sufficient)

The line is: if it makes the architecture **evolvable**, build it now. If it makes the
system **scale for load we don't have**, defer it. The state machine is complex
regardless of scale — design it completely now. The payment processing is simple for
Phase 1 volume — keep it simple now.

---

## On the Regulatory Sensitivity of Documentation

The platform exists in a legal gray zone. Formalizing what informal networks do creates
both value (trust, escrow, accountability) and risk (looking like a commercial freight
operation subject to customs regulations designed for commercial importers/exporters).

**Concrete implications for what you document and build:**

The platform should NOT generate documents that look like:
- Airway bills (AWB)
- Bills of lading
- Commercial invoices
- Customs declarations
- Freight manifests

The platform SHOULD generate:
- Sender-to-receiver receipts (informal, like a personal transaction record)
- Handoff confirmation records (internal platform use, not designed for customs display)
- Status update logs (operational tracking)

When writing the PRD's "out of scope" section and TRD's "what we're not building,"
include explicit language about document generation. The system should not be able
to print a document that a customs officer would classify as a commercial shipping
document. This is a product design constraint with regulatory significance.

This connects directly to OQ-4 (customs documentation protocol). Until the founder
has spoken with an Ethiopian customs practitioner about this specific question, build
nothing that generates external-facing shipping documentation. Keep all records
platform-internal. Flag this constraint in both PRD and GUARDRAILS.md.

---

## Developer Talent Context

The people who will build Shanta's Phase 1 codebase are likely based in Ethiopia
or the broader East African region. This has practical implications:

**Strong pools in the Ethiopian developer community:**
- JavaScript/Node.js (large community, well-resourced bootcamp ecosystem)
- Python (growing, particularly in Addis)
- React (web) and React Native (mobile) — both well-represented
- Flutter is growing rapidly, particularly among younger Ethiopian developers

**Less common:**
- Go, Rust, Elixir — smaller talent pools, harder to hire for
- Native Android/iOS — exists but smaller than cross-platform community

**Implication**: The tech stack should lean toward Node.js + TypeScript (backend) and
Flutter or React Native (mobile) — not because these are abstractly "best" but because
they represent the largest hireable talent pool in the target market. If the founder
can only hire from the Addis developer community, exotic tech choices create a bus-factor
risk from day one.

Justify your tech stack choice against this constraint explicitly. If you choose
something less common in the Ethiopian market, acknowledge the hiring risk and what
mitigates it.

---

## Final Instructions for This Session

You now have:
- The complete Phase 0 prompt (business context, constraints, deliverables, specs)
- This supplementary context (market realities, threat model, edge cases, patterns)

Together, this is the complete context set for Phase 0. Before you write a single file:

1. Integrate all of the supplementary context above into your extended thinking
2. Resolve any tensions between the two documents explicitly in your thinking
3. Make every architectural decision with a stated rationale — not "we chose X"
   but "we chose X because Y, and we rejected Z because W"
4. When you write CLAUDE.md, it must reflect the full depth of this context, not just
   the Phase 0 prompt. A developer reading CLAUDE.md should understand the threat model,
   the payment landscape, the connectivity constraints, and the edge cases — summarized,
   not absent.

The quality of Phase 0 is determined by the quality of the decisions made here, in
this thinking session, before a single line of application code is written. This is
the highest-leverage hour in Shanta's entire development history. Use it completely.

Begin your extended thinking now. Do not write file one until your thinking is done.
# SHANTA — Final Engineering Context for Opus 4.8
## Third and final document. Send this AFTER the Phase 0 prompt and supplementary context.

---

This is the closing document. The Phase 0 prompt gave you the business model and
deliverables. The supplementary context gave you market realities, threat models,
and edge cases. This document gives you what neither covered: the finalized tech stack
with no remaining ambiguity, the development standards that govern all code written
for this project, the missing data model entities, the architectural decisions that
were left open and must now be closed, and the engineering best practices by phase.

Together, three documents. Read as one. Begin only when all three are integrated.

The standard is not "good enough to ship." The standard is: a senior engineer joins
the team in Phase 2, reads the documentation produced in Phase 0, and can make correct
implementation decisions without asking a single clarifying question about intent,
constraints, or architecture. That is the bar.

---

## Critical Missing Architectural Decisions — Close These Now

These were not covered in either previous document. Each one must be decided and
documented in the relevant Phase 0 file before writing a line of application code.

### Decision 1 — Authentication Strategy (CRITICAL)

**Do NOT use email + password.** Here is why this is wrong for Shanta's context:
- The majority of Ethiopian users, particularly receivers in regional cities, do not
  actively use email. Many have email addresses they never check.
  "Forgot password" flows require email access — which breaks the experience.
- WhatsApp and mobile money apps (TeleBirr, CBE Birr) have trained Ethiopian users
  on OTP-via-SMS flows. This is the expected pattern.
- Phone number IS the user's identity in this context. It's how people find each other,
  verify each other, and communicate.

**The correct authentication architecture for Shanta:**

```
Primary flow: Phone Number + OTP (SMS via Africa's Talking)
1. User enters phone number (E.164 format: +2519XXXXXXXX)
2. Platform generates a 6-digit OTP, stores hashed OTP + expiry (10 min) in DB
3. Platform sends OTP via Africa's Talking SMS API
4. User enters OTP in app
5. Platform verifies OTP hash, issues JWT access token (15 min) + refresh token (30 days)
6. Refresh token stored in DB (hashed), used to issue new access tokens silently
7. On logout: refresh token revoked in DB

OTP rate limiting (MANDATORY — unprotected OTP = money burning + abuse vector):
- Max 3 OTP requests per phone number per hour
- Max 10 OTP requests per phone number per 24 hours
- Exponential backoff messaging to user on repeated failure
- OTP requests must be tracked in DB (OTPRequest entity — see data model section)
```

For diaspora senders abroad (international phone numbers): same flow, international
SMS via Africa's Talking (they support international delivery). Do not add email auth
as a "convenience" for international users in Phase 1 — it creates two auth systems.

For aggregator operators and Shanta admin: separate admin authentication system with
email + password + TOTP (2FA). Admin panel has different trust requirements. Keep
admin auth entirely separate from the user-facing auth system.

Document this decision in TRD.md, DATA_MODEL.md (OTPRequest entity), and CLAUDE.md.

### Decision 2 — KYC / Identity Verification (By Actor Tier)

Not all actors need the same verification level. Define this explicitly:

```
Receiver (Node 4): Phone number only. No additional verification. Lowest risk — they
receive items, not carry them. Name + phone is sufficient for delivery confirmation.

Sender (Node 1): Phone number + full name. Optional: national ID for high-value
shipments (> a threshold TBD by founder). The item declaration is the primary
accountability mechanism.

Traveler-Casual (Node 2): Phone number + full name + photo of national ID (uploaded
to secure storage, reviewed by Shanta staff before first trip). National ID is required
because travelers bear legal responsibility for contents at customs. Manual review is
acceptable in Phase 1 — this is an onboarding step, not a real-time check.

Traveler-Professional (Node 2 dedicated): Same as casual, plus: face match to ID photo
(manual staff review), background on intended routes/frequency.

Aggregator Operator (Node 3): Phone number + full name + national ID + business
location verification (staff visits hub or reviews photo evidence of location) +
in-person onboarding by Shanta. Aggregators are the most trusted party in the system;
their onboarding must be the most rigorous.
```

Ethiopia has the Fayda national digital ID system (MOSIP-based, launched 2023).
Research whether Fayda's verification API is production-ready for Phase 1 integration.
If not, fall back to manual ID document review by Shanta staff. Build the data model
to store verification status and verification method — so switching from manual review
to API-based verification in Phase 2 requires no schema change.

Add to `User`:
- `kyc_status` (enum: UNVERIFIED, PENDING_REVIEW, VERIFIED, REJECTED)
- `kyc_submitted_at` (timestamp)
- `kyc_reviewed_at` (timestamp)
- `kyc_reviewed_by` (FK → AdminUser)
- `id_document_url` (secure storage URL — NOT publicly accessible)

### Decision 3 — Multi-Tenancy Architecture Seed (Phase 3 Decision Made in Phase 0)

Pan-African expansion (Phase 3) means multiple countries, potentially with different
data residency requirements, different regulatory rules, different currencies. The
multi-tenancy decision made in Phase 0 determines how expensive Phase 3 is.

**Option A — Single schema with `country_code` on relevant tables** (recommended for Phase 0):
Simple, costs nothing now, allows querying across countries for analytics, works for
Phase 1 and Phase 2. For Phase 3, add row-level security policies in Postgres per
country. Not perfect but good enough for a startup that hasn't proven the first corridor.

**Option B — Schema-per-country in Postgres** (premature):
Complete data isolation, natural compliance, but: every new country requires schema
migration, cross-country analytics require federated queries, significantly more
complex deployment. Do not do this in Phase 0.

**Decision**: Add `country_code` (ISO 3166-1 alpha-2: "ET" for Ethiopia) to:
- `User`, `Trip`, `Hub`, `Shipment`, `ItemRestriction`, `Hub`
This seeds the multi-tenancy model without the complexity of schema separation.
Default all Phase 1 records to `country_code = "ET"`. Document this explicitly in
DATA_MODEL.md as "Phase 3 multi-tenancy hook — do not ignore this field."

### Decision 4 — The Admin Panel (Missing Entirely from Previous Documents)

Shanta staff need a web-based interface to operate the platform. Without this,
every operational action requires direct database access — which is dangerous and
does not scale even to two staff members. This is not a Phase 2 feature. It is
a Phase 1 requirement for the platform to be operable.

**Phase 1 admin panel must support:**
- Aggregator/Hub approval, activation, suspension
- KYC review queue (view submitted ID documents, approve/reject)
- Shipment overview (status, current state, actor IDs)
- Dispute management (view evidence chain, trigger state transitions)
- Manual escrow release/hold
- Rules engine management (view, add, update rules without code changes)
- User account management (suspend, verify, view activity)
- OTP log (for debugging auth issues)

**Tech recommendation**: Build the admin panel as a separate application within the
monorepo. Use **Next.js App Router** with **Shadcn/ui** components and connect to the
same backend API with admin-scoped JWT tokens. Do not build a separate backend for
admin — use the same API with role-based route guards. Keep it simple.

Admin panel does NOT need to be beautiful. It needs to be functional and secure.
No public URL should expose admin routes. Protect behind VPN or IP allowlist in Phase 1.

Add `AdminUser` entity to data model (separate from User, separate auth system).
Add `AuditLog` entity — every admin action is logged (who, what, when, which record).

### Decision 5 — Pricing Architecture

The pricing model was described as "$4-10/kg, unvalidated." The platform needs a
first-class pricing structure even if the numbers change. Define this now so the
data model and calculation logic are designed correctly.

**Price components per shipment:**
```
total_price = base_carrier_fee + aggregator_fee + platform_commission + insurance_premium

base_carrier_fee:    weight_kg × corridor_rate_per_kg × traveler_take_rate
aggregator_fee:      flat_per_shipment OR weight_kg × aggregator_rate_per_kg
platform_commission: percentage of (base_carrier_fee + aggregator_fee)
insurance_premium:   optional, percentage of declared_item_value (0 if not opted in)

All prices stored in the currency of the corridor (ETB for domestic Phase 1).
```

Create a `CorridorPricing` entity:
- `corridor_id` (origin_hub_id + destination_hub_id or corridor code)
- `rate_per_kg_etb` (decimal, configurable)
- `min_charge_etb` (decimal — prevent very small shipments from being uneconomical)
- `aggregator_flat_fee_etb` (decimal)
- `platform_commission_rate` (decimal, percentage)
- `insurance_rate` (decimal, percentage of item value)
- `effective_from` (date)
- `effective_until` (nullable date)

Prices must be versioned (effective_from/until) so historical shipments can be
recalculated correctly. Never store a computed price without also storing the
pricing rule version that produced it. Add `pricing_snapshot` (JSON) to `Shipment`
to capture the exact rates at time of booking — rates may change mid-journey.

**Note on VAT**: Ethiopia applies 15% VAT. The tax obligation depends on whether Shanta
is registered as a VAT collector. Flag for founder/legal review — but design the
pricing model to have a `tax_rate` and `tax_amount` field from day one so VAT can be
added without schema changes.

---

## Finalized Tech Stack — No Remaining Ambiguity

Every choice below is final. Document these in TRD.md with the stated rationale.
Do not reopen these decisions in Phase 0 — they are resolved here.

### Backend

```
Language:     TypeScript (strict mode — see standards section)
Runtime:      Node.js 20 LTS
Framework:    Fastify (not Express)
  Rationale:  2-3x faster than Express, TypeScript-first, built-in schema validation
              via JSON Schema, serialization plugin for type-safe responses, well-maintained.
              Express is widely known but its lack of built-in validation and slower
              performance make it wrong for a new project in 2025.
ORM:          Prisma
  Rationale:  Auto-generates type-safe TypeScript client from schema definition,
              built-in migration system (prisma migrate), widely known in the Ethiopian
              developer community, excellent documentation, JSONB support for flexible
              item attributes and pricing snapshots.
Validation:   Zod (all API input validation — not just TypeScript types, runtime validation)
  Rationale:  Runtime schema validation catches what TypeScript cannot (user input).
              Every Fastify route must have a Zod schema for body/params/query.
              Prisma types + Zod validation = type safety from DB to API surface.
Auth:         Phone OTP + JWT (see Decision 1 above)
  Libraries:  jsonwebtoken, bcryptjs (for hashing OTPs and refresh tokens)
Jobs:         Inngest (serverless background jobs)
  Rationale:  Zero infrastructure (no Redis/Celery to manage), TypeScript-native,
              retries/backoff built in, Railway-compatible, excellent local dev
              experience (inngest dev server), generous free tier for Phase 1.
  Use for:    SMS notification sending, push notification sending, escrow timeout
              checks, photo compression triggers, weekly frequency-check reports,
              webhook processing
Logging:      Pino (structured JSON logging)
  Rationale:  Fastest Node.js logger, built into Fastify natively, JSON output
              parseable by Railway's log aggregation and any future log service.
  Pattern:    Every request gets a correlation ID (UUID). All log lines for a request
              include this correlation ID. Errors include stack trace + context.
Errors:       Sentry (error tracking from day one)
  Rationale:  Free tier is generous. Unhandled exceptions in production become
              Sentry issues, not silent failures. Required from Phase 1 — do not add
              "later."
Email:        Resend (transactional email for admin notifications, not user-facing)
  Rationale:  Simple API, reliable delivery, affordable. Admin panel alerts, KYC
              review notifications to staff, dispute escalation emails.
Testing:      Vitest (unit + integration tests)
  Rationale:  Faster than Jest, native TypeScript support, compatible with Node 20.
```

### Mobile

```
Framework:    Flutter (Dart)
  Rationale:  (Final decision, replacing React Native recommendation from prompt)
              - Renders to native canvas — does NOT use platform UI components.
                On Tecno/Itel/Infinix devices (1-2GB RAM), Flutter's rendering
                pipeline is measurably faster than React Native's bridge architecture.
              - Drift (Flutter local SQLite ORM) provides excellent offline-first
                local database — critical for Constraint 2.3 (multi-leg, spotty
                connectivity at each handoff point).
              - camera package for Flutter has better low-level control for the
                content verification capture flow (flash control, resolution,
                live capture requirement for delivery confirmation).
              - Single codebase: Android (primary) + iOS (secondary, Phase 2)
                + potential web admin lite view in Phase 3.
              - Growing rapidly in East African developer community.
  State:      Riverpod (for state management — not Provider, not Bloc, not GetX)
  Local DB:   Drift (SQLite ORM for offline state)
  HTTP:       Dio (with interceptors for JWT refresh + retry logic)
  Camera:     camera package (direct capture, no gallery upload for verification)
  Storage:    flutter_secure_storage (for JWT tokens — not SharedPreferences)
  i18n:       flutter_localizations + arb files (English + Amharic from day one)
              Structure the strings file from Phase 1 even if Amharic translation
              comes in Phase 2 — retrofitting i18n is expensive.
```

### Infrastructure

```
Database:         PostgreSQL 16 (managed via Railway or Render)
File storage:     Cloudflare R2 (S3-compatible, zero egress cost)
Image CDN:        Cloudflare Images (auto-compression for handoff photos)
  Config:         Max upload size: 5MB. Compress to WebP at 75% quality before storage.
                  All handoff photos stored at full resolution AND 480p thumbnail.
                  Thumbnails served via CDN. Full resolution only accessible via
                  signed URL with expiry (for dispute review).
SMS:              Africa's Talking (Ethiopia coverage confirmed)
Push:             Firebase Cloud Messaging (Android primary)
DDoS/Proxy:       Cloudflare Free tier in front of API (mandatory from Phase 1)
  Rationale:      Rate limiting at Cloudflare layer for OTP abuse, DDOS protection,
                  SSL termination, free for Phase 1 traffic levels.
Hosting:          Railway (backend API + Inngest + background services)
  Why Railway:    Managed Postgres, automatic deploys from Git, environment variables
                  managed in UI, simple enough for Phase 1, supports monorepo deploys.
  Alternatives:   Render is comparable. Avoid AWS/GCP/Azure — too much DevOps
                  overhead for a startup that hasn't proven the business.
Admin panel:      Deploy to Vercel (Next.js — Vercel is the natural host)
Environments:     Three: local, staging, production
  Staging:        Exact mirror of production, deploy on every merge to main
  Production:     Manual trigger only, from a tagged release
CI/CD:            GitHub Actions (see standards section)
Monitoring:       Railway metrics (CPU/memory/response time) + Sentry + Pino logs
Backups:          Railway automated daily Postgres backups (enable on day one,
                  verify restore process in first week — do not assume, test it)
```

### Monorepo Structure

```
shanta/
├── apps/
│   ├── api/                    ← Fastify + TypeScript backend
│   │   ├── src/
│   │   │   ├── modules/        ← Feature modules (auth, shipments, trips, hubs, rules)
│   │   │   │   └── [module]/
│   │   │   │       ├── [module].routes.ts
│   │   │   │       ├── [module].service.ts
│   │   │   │       ├── [module].schema.ts   ← Zod schemas
│   │   │   │       └── [module].test.ts
│   │   │   ├── lib/            ← Shared utilities (db, logger, storage, sms)
│   │   │   ├── jobs/           ← Inngest job definitions
│   │   │   ├── middleware/     ← Auth, error handler, request ID
│   │   │   └── index.ts        ← App entry point
│   │   ├── prisma/
│   │   │   ├── schema.prisma   ← Single source of truth for data model
│   │   │   ├── migrations/     ← Auto-generated by prisma migrate
│   │   │   └── seed.ts         ← Seed data for dev/staging
│   │   ├── .env.example        ← Template for environment variables (committed)
│   │   └── package.json
│   ├── mobile/                 ← Flutter application
│   │   ├── lib/
│   │   │   ├── features/       ← Feature modules mirroring API modules
│   │   │   │   └── [feature]/
│   │   │   │       ├── data/   ← API calls + local DB
│   │   │   │       ├── domain/ ← Business logic, state
│   │   │   │       └── ui/     ← Screens, widgets
│   │   │   ├── core/           ← Router, theme, i18n, network, storage
│   │   │   └── main.dart
│   │   ├── l10n/               ← Localization files
│   │   │   ├── app_en.arb
│   │   │   └── app_am.arb      ← Amharic (keys present, translations Phase 2)
│   │   └── pubspec.yaml
│   └── admin/                  ← Next.js admin panel
│       ├── app/                ← Next.js App Router
│       ├── components/         ← Shadcn/ui components
│       └── package.json
├── packages/
│   └── types/                  ← Shared TypeScript types (API contracts)
│       ├── src/
│       │   ├── shipment.ts     ← Shipment types shared across apps
│       │   ├── user.ts
│       │   └── index.ts
│       └── package.json
├── docs/                       ← Phase 0 documentation (produced in this session)
├── prompts/                    ← Agent prompts (produced in this session)
├── .claude/                    ← Claude commands (produced in this session)
├── .github/
│   └── workflows/
│       ├── ci.yml              ← On PR: lint + type check + test
│       └── deploy.yml          ← On merge to main: deploy staging. On tag: deploy prod
├── CLAUDE.md                   ← Project memory
├── GUARDRAILS.md               ← What not to build
├── RUNBOOK.md                  ← Manual operations handbook (see below)
├── .env.example                ← Root-level example (points to app-level ones)
├── turbo.json                  ← Turborepo config for monorepo task orchestration
└── package.json                ← Root package.json (workspaces)
```

The `packages/types` package is critical. API response types defined once in TypeScript,
consumed by both the Fastify backend (for response serialization) and the admin panel
(for data fetching). Prevents frontend/backend type drift, which is the most common
source of silent bugs in vibe-coded projects.

For the Flutter mobile app, generate Dart models from the same type definitions using
a JSON schema generation step. This means one source of truth for API shapes.

---

## Development Standards — Non-Negotiable for All Code

Document these in CLAUDE.md under "How to Work on Shanta" and in TRD.md.

### TypeScript Configuration

```json
// tsconfig.json — ALL projects
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

`strict: true` is not optional. `noUncheckedIndexedAccess` catches array access bugs.
`exactOptionalPropertyTypes` prevents the `| undefined` silent bugs that plague
loosely-typed APIs. Every TypeScript file must compile with zero errors and zero
`any` usages (ESLint rule: `@typescript-eslint/no-explicit-any: error`).

### Code Quality Toolchain

```
ESLint:       @typescript-eslint + unicorn + import plugins
              Rule to highlight: no-floating-promises (unhandled async = silent bug)
Prettier:     Single config at monorepo root, enforced in CI
Commits:      Conventional Commits (feat:, fix:, docs:, chore:)
              Enforced via commitlint + husky pre-commit hook
Branches:     Trunk-based development (main is always deployable)
              Feature branches: [type]/[short-description]  e.g. feat/content-verification
PRs:          Required for all merges to main. Minimum: 1 reviewer for logic changes.
              Automated checks must pass (CI green) before merge is allowed.
```

### Git Workflow for a Small Team

```
main          → always deployable, auto-deploys to staging
feat/*        → feature branches, short-lived (< 1 week)
fix/*         → bug fixes
release/vX.Y  → tagged releases → manual deploy to production

NO long-lived feature branches. NO git flow. Trunk-based development.
Small, frequent commits. Deploy to staging daily.
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# On every PR:
jobs:
  quality:
    - turbo run lint         # ESLint all workspaces
    - turbo run typecheck    # tsc --noEmit all workspaces
    - turbo run test         # Vitest all workspaces
    - prisma migrate dry-run # Validate migration won't fail

# On merge to main:
jobs:
  deploy-staging:
    - Run quality checks
    - prisma migrate deploy (staging DB)
    - Deploy API to Railway (staging)
    - Deploy admin to Vercel (staging)

# On git tag (vX.Y.Z):
jobs:
  deploy-production:
    - Manual approval gate (required)
    - prisma migrate deploy (production DB) — runs BEFORE app deploy
    - Deploy API to Railway (production)
    - Deploy admin to Vercel (production)
    - Tag Sentry release
```

Database migrations run BEFORE the application deploy, not after. This prevents the
"new code running against old schema" window that causes production errors.

### Environment Variables

Every application has a `.env.example` committed to the repository with ALL required
variables listed (no values, just keys and descriptions). A new developer clones the
repo, copies `.env.example` to `.env.local`, fills in values from the team password
manager, and has a working local environment. No undocumented secrets.

Minimum required environment variables to document:
```
# Database
DATABASE_URL

# Auth
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRY=900          # 15 minutes in seconds
JWT_REFRESH_EXPIRY=2592000     # 30 days in seconds

# Africa's Talking
AT_API_KEY
AT_USERNAME
AT_SHORTCODE                    # SMS sender ID

# Firebase
FCM_SERVER_KEY

# Cloudflare
CF_R2_ACCOUNT_ID
CF_R2_ACCESS_KEY_ID
CF_R2_SECRET_ACCESS_KEY
CF_R2_BUCKET_NAME
CF_IMAGES_ACCOUNT_ID
CF_IMAGES_API_TOKEN

# Inngest
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY

# Sentry
SENTRY_DSN

# Admin
ADMIN_ALLOWED_IPS              # Comma-separated IP allowlist for admin panel

# App
NODE_ENV                       # development | staging | production
APP_URL                        # Base URL of this environment
COUNTRY_CODE=ET                # Default country for Phase 1
```

### Testing Requirements — What MUST Have Tests

Not everything needs tests in Phase 1. This is the explicit priority list:

```
MUST TEST (state machine transitions):
  - Every valid transition produces the correct new state
  - Every invalid transition is rejected with the correct error
  - Compensation/rollback transitions work correctly
  - Concurrent state transitions are handled safely (optimistic locking test)

MUST TEST (rules engine):
  - Every initial ruleset entry validates correctly against compliant item
  - Every initial ruleset entry rejects correctly against non-compliant item
  - Corridor-specific rule overrides base rule correctly
  - Frequency-sensitive rules (jewelry) apply correct limit based on TravelProfile
  - Rules can be updated without breaking existing validated shipments

MUST TEST (authentication):
  - OTP rate limiting enforces the 3/hour, 10/24h limits
  - Expired OTP is rejected
  - Used OTP cannot be reused
  - Revoked refresh token cannot issue new access token
  - Admin auth is completely separate from user auth

MUST TEST (escrow):
  - Escrow is not released on DISPUTED state
  - Escrow release requires correct actor (receiver confirmation)
  - Escrow calculation matches pricing snapshot stored at booking time

SHOULD TEST (API contracts):
  - Key endpoints return correct shape (integration tests with test DB)
  - Auth middleware rejects unauthenticated requests
  - Role-based guards reject unauthorized roles

DO NOT TEST in Phase 1 (defer):
  - UI/E2E tests (too expensive, too brittle, not enough users yet)
  - Load tests (no load yet)
  - Visual regression tests
```

Target: 80% coverage of the MUST TEST areas. 0% coverage of the DO NOT TEST areas.
Write tests for what breaks if wrong, not for what's obvious.

---

## Security Non-Negotiables

These are not suggestions. Every item below must be implemented before the first
external user touches the system. Security retrofitting is dangerous and expensive.

```
Input validation:   Every API endpoint has a Zod schema. Body, params, query.
                    No unvalidated user input ever reaches the database layer.
                    Fastify's schema validation at the route level + Zod at service level.

SQL injection:      Prisma parameterizes all queries. No raw SQL with string interpolation.
                    If raw SQL is ever needed: use prisma.$queryRaw with Prisma.sql tags only.

File uploads:       Validate file type (magic bytes, not extension). Max size: 5MB.
                    Never serve uploaded files from the API server directly.
                    All files go to Cloudflare R2, served via signed URLs with expiry.
                    Delivery confirmation photos: live capture only, no gallery upload.
                    Enforce this at the Flutter app level AND API level (timestamp metadata).

JWT security:       Access tokens: 15 minutes. Refresh tokens: 30 days, stored hashed in DB.
                    Rotate signing secrets quarterly. Support secret rotation without
                    invalidating all sessions (key versioning in JWT header).
                    Blacklist compromised refresh tokens immediately.

OTP security:       Hash OTPs with bcrypt before storing. Store only the hash.
                    Enforce rate limits at both application level AND Cloudflare level.
                    OTPs expire in 10 minutes. Single use — mark as used immediately.

CORS:               Whitelist explicit origins only. Never wildcard (*) in production.
                    Origins: [app mobile deep link scheme, admin panel domain]

Security headers:   Use @fastify/helmet. Default Helmet config is sufficient for Phase 1.
                    CSP, HSTS, X-Content-Type-Options, X-Frame-Options all enabled.

Admin panel:        Accessible only from allowlisted IPs (ADMIN_ALLOWED_IPS env var).
                    All admin actions logged to AuditLog. No admin action without a log entry.
                    Admin tokens have shorter expiry: 8 hours, no refresh (re-login required).

Webhook security:   All incoming webhooks (Africa's Talking, TeleBirr, Inngest) must have
                    signature verified before processing.
                    Africa's Talking uses HMAC-SHA256. Verify before parsing payload.
                    Log all webhook receipts to WebhookLog (see data model section).

PII handling:       Phone numbers, national ID references, item contents descriptions
                    are PII. Define retention policy: active shipment data kept indefinitely,
                    completed shipment PII anonymizable after 2 years (flag for legal).
                    ID document photos: accessible only to admin via signed URL.
                    Handoff photos: accessible to involved parties only via signed URL.
                    Signed URLs expire in 1 hour. Regenerate on request, log each access.

Secrets:            No secrets in code or git history. Use Railway environment variables
                    for all secrets. Rotate all secrets before first production deploy.
                    Never log secrets, tokens, or OTPs (even truncated).
```

---

## Observability — From Day One, Not Day One Hundred

A system you cannot observe is a system you cannot fix. Ethiopia's connectivity makes
debugging production issues harder — you need good instrumentation before problems
occur, not after.

### Structured Logging Pattern

Every log line must be structured JSON with:
```json
{
  "level": "info",
  "time": "2025-01-15T10:30:00.000Z",
  "correlation_id": "uuid-v4",
  "user_id": "usr_xxx",          // if authenticated
  "route": "POST /api/v1/shipments",
  "duration_ms": 245,
  "message": "Shipment created",
  "shipment_id": "shp_xxx",      // domain context
  "err": null                    // or error object on error
}
```

Correlation ID assigned at request entry (middleware), propagated through all service
calls, included in every log line for that request. When a bug is reported, the
correlation ID is how you find every log line for that request in production.

### What to Monitor (Minimum Phase 1 Dashboard)

```
System health:
  - API error rate (5xx responses) — alert if > 1% over 5 minutes
  - API p95 response time — alert if > 2000ms over 5 minutes
  - Database connection pool utilization
  - Railway service health

Business metrics (query from DB daily):
  - New shipments created per day / per corridor
  - State machine progression rates (what percentage reach DELIVERED)
  - Abandonment by state (where do shipments get stuck?)
  - Content verification completion rate vs abandonment rate (Assumption 5 validation)
  - Traveler acceptance rate (accepts vs rejects after content review)
  - Average time from SUBMITTED to DELIVERED (end-to-end journey time)
  - Supply depth: average available traveler capacity per corridor per week

Operational alerts:
  - Shipment stuck in same state > 48 hours → alert Shanta staff
  - OTP rate limit threshold hit → alert (possible abuse)
  - Failed webhook delivery (Africa's Talking, TeleBirr) → alert
  - Inngest job failure rate > 5% → alert
  - Escrow records in HELD state > 7 days without resolution → alert
```

Instrument business metrics from day one. These are the answers to "is Phase 1 working?"
You cannot validate the riskiest assumptions without data on them.

### Health Check Endpoint

```
GET /health
Response: {
  "status": "ok" | "degraded" | "down",
  "timestamp": "ISO-8601",
  "checks": {
    "database": "ok" | "error",
    "inngest": "ok" | "error",
    "storage": "ok" | "error"
  }
}
```

Railway uses this for health monitoring. Cloudflare can use this for origin checks.
This endpoint requires NO authentication and must respond in < 100ms.

---

## Missing Data Model Entities

These were not in the previous documents. Add them to DATA_MODEL.md.

```
OTPRequest
  - id (UUID)
  - phone_number (string, E.164 format)
  - otp_hash (string — bcrypt hash of the OTP)
  - expires_at (timestamp)
  - used_at (nullable timestamp — null if not yet used)
  - created_at
  Purpose: Rate limiting OTP requests, preventing OTP reuse.

RefreshToken
  - id (UUID)
  - user_id (FK → User)
  - token_hash (string — bcrypt hash of the refresh token)
  - expires_at (timestamp)
  - revoked_at (nullable timestamp)
  - created_at
  - last_used_at (timestamp)
  Purpose: Revocable sessions, multi-device login.

AdminUser
  - id (UUID)
  - email (string, unique)
  - password_hash (string)
  - totp_secret (string — 2FA required for admin)
  - role (enum: SUPER_ADMIN, OPERATIONS, KYC_REVIEWER, FINANCE)
  - active (boolean)
  - last_login_at (nullable timestamp)
  - created_at
  Purpose: Separate admin authentication system.

AuditLog
  - id (UUID)
  - actor_type (enum: USER, ADMIN, SYSTEM)
  - actor_id (string — user_id or admin_user_id or "system")
  - action (string — e.g. "shipment.state.transition", "hub.created", "rule.updated")
  - entity_type (string — e.g. "Shipment", "Hub", "ItemRestriction")
  - entity_id (string)
  - before_state (JSONB nullable)
  - after_state (JSONB nullable)
  - metadata (JSONB nullable — extra context)
  - ip_address (string nullable)
  - created_at
  Purpose: Complete audit trail. Immutable — never update or delete.
  Note: Write to AuditLog for ALL admin actions and ALL state machine transitions.

WebhookLog
  - id (UUID)
  - provider (enum: AFRICA_TALKING, TELE_BIRR, INNGEST)
  - event_type (string)
  - payload (JSONB)
  - signature_valid (boolean)
  - processed_at (nullable timestamp)
  - processing_error (nullable string)
  - created_at
  Purpose: Debug webhook delivery issues. Idempotency: check for duplicate event_id.

AppConfig
  - key (string, unique — e.g. "feature_flag.content_video_enabled")
  - value (JSONB)
  - description (string)
  - updated_at
  - updated_by (FK → AdminUser)
  Purpose: Runtime configuration without deploys. Feature flags, operational toggles.
  Examples: {"enabled": false} for feature flags, {"value": 5000} for thresholds.

OperationalNote
  - id (UUID)
  - entity_type (string)
  - entity_id (string)
  - note (text)
  - created_by (FK → AdminUser)
  - created_at
  Purpose: Shanta staff notes on disputes, unusual shipments, flagged users.
           Separate from AuditLog (which is automated). This is human judgment.

CorridorPricing
  - id (UUID)
  - origin_region (string)
  - destination_region (string)
  - rate_per_kg_etb (decimal)
  - min_charge_etb (decimal)
  - aggregator_flat_fee_etb (decimal)
  - platform_commission_rate (decimal)
  - insurance_rate (decimal)
  - effective_from (date)
  - effective_until (nullable date)
  - country_code (string — Phase 3 multi-tenancy hook)
  - created_at
  Purpose: Configurable pricing by corridor and time period.

(Update Shipment to add):
  - pricing_snapshot (JSONB) ← Capture CorridorPricing at time of booking
  - carrier_fee_etb (decimal)
  - aggregator_fee_etb (decimal)
  - platform_fee_etb (decimal)
  - insurance_premium_etb (decimal)
  - tax_amount_etb (decimal)
  - total_price_etb (decimal)
  - currency (string, default "ETB")
```

---

## Data Integrity Patterns — Built Into Every Entity

These patterns prevent entire classes of bugs. Apply them by default.

**Optimistic concurrency control on state transitions:**
Every state transition must check that the current state in the database matches the
expected state before updating. If not — concurrent transition by another actor — the
transition must fail with a 409 Conflict response.

```prisma
// In Prisma schema
model Shipment {
  id            String   @id @default(cuid())
  status        ShipmentStatus
  version       Int      @default(0)   // Increment on every update
  ...
}

// In state transition service
await prisma.shipment.updateMany({
  where: {
    id: shipmentId,
    status: expectedCurrentStatus,
    version: expectedVersion        // Fails if another update happened concurrently
  },
  data: {
    status: newStatus,
    version: { increment: 1 }
  }
})
// If updateMany returns count: 0 → 409 Conflict
```

This prevents the scenario where two actors (e.g., traveler and aggregator) both trigger
a state transition simultaneously and the shipment ends up in an inconsistent state.

**Soft deletes everywhere:**
```prisma
deleted_at    DateTime?   // null = active, non-null = soft deleted
```
Never hard-delete user-facing records. Foreign key relationships remain intact.
Admin panel shows deleted records with a "deleted" indicator.

**Audit fields on every entity:**
```prisma
created_at    DateTime  @default(now())
updated_at    DateTime  @updatedAt
created_by    String?   // FK → User or AdminUser ID
```

**Database constraints, not just application validation:**
Every constraint that matters must be enforced at the database level, not just in
application code. Application validation is the first line of defense. Database
constraints are the last, unbypassable line.
```
- Unique constraints: phone_number, email
- Check constraints: weight_kg > 0, total_price_etb >= 0
- Not-null on required fields
- Foreign key constraints with appropriate cascade behavior
```

**Idempotency keys on mutations:**
```
POST /api/v1/shipments
Header: Idempotency-Key: [client-generated UUID]
```
If the same Idempotency-Key is received twice within 24 hours, return the original
response without re-executing. Store Idempotency-Key → response in a Redis cache
(or Postgres table for Phase 1). This prevents duplicate shipment creation from
mobile network retries — one of the most common mobile app bugs.

**Timezone standardization:**
All timestamps stored in UTC in the database. Display layer converts to Ethiopia time
(Africa/Addis_Ababa, UTC+3) using the user's device timezone. Never store local time
in the database. Trip departure times stored in UTC with explicit timezone context.
For international Phase 2 corridors, store both the local departure time timezone
and the UTC equivalent.

---

## Missing Architectural Patterns — Document in ARCHITECTURE.md

### Webhook Handling Architecture

Africa's Talking and TeleBirr will POST webhooks to the platform on SMS delivery
status and payment events. The correct handling pattern:

```
1. Webhook hits POST /webhooks/africa-talking or /webhooks/telebirr
2. Verify signature (HMAC) immediately — reject if invalid, return 200 anyway
   (prevent retry flood from rejected 400s)
3. Write raw payload to WebhookLog table (async, non-blocking)
4. Publish an Inngest event immediately — return 200 to provider
5. Inngest job processes the webhook asynchronously with retry/backoff
6. Never process business logic synchronously in the webhook handler
```

This pattern ensures: providers don't time out waiting for processing, failed
processing is retried automatically, duplicate webhooks are idempotent (check
WebhookLog for duplicate event IDs before processing).

### Background Job Architecture (Inngest)

Define these jobs in `apps/api/src/jobs/`:

```
notification/send-sms          → Send queued SMS via Africa's Talking
notification/send-push         → Send push notification via FCM
notification/retry-failed      → Retry notifications that failed on first attempt

shipment/check-stuck           → Daily: find shipments stuck > 48h, alert staff
shipment/escrow-timeout-check  → Daily: find escrows held > 7 days, alert finance

traveler/frequency-report      → Weekly: generate per-traveler trip frequency report
                                  for customs risk management (Constraint 2.1)

verification/process-photo     → On upload: compress + generate thumbnail + store
                                  Return signed URL to caller

kyc/notify-reviewer            → On KYC submission: notify KYC_REVIEWER admin
```

Every job must be: idempotent (safe to run twice), logged (start, success, failure),
monitored (Inngest dashboard shows job health).

### The Matching Query (Core Supply/Demand API)

Even manual matching in Phase 1 needs a proper query interface. This is not an
algorithm — it's a database query that the aggregator operator uses to find available
travelers for a shipment. Design it now.

```sql
-- "Find available travelers for this shipment"
-- Inputs: origin, destination, depart_window_start, depart_window_end,
--         item_weight_kg, item_category

SELECT
  t.id,
  t.origin,
  t.destination,
  t.depart_at,
  t.available_capacity_kg,
  u.full_name,
  tp.trip_count_last_90_days,  -- Constraint 2.1 visibility
  -- Per-category cargo already accepted on this trip
  COALESCE(SUM(CASE WHEN i.category = :item_category
               THEN i.weight_kg ELSE 0 END), 0) AS category_weight_already_accepted
FROM trips t
JOIN users u ON t.traveler_id = u.id
JOIN travel_profiles tp ON tp.user_id = u.id
LEFT JOIN shipment_legs sl ON sl.trip_id = t.id
    AND sl.status NOT IN ('CANCELLED', 'RETURNED')
LEFT JOIN items i ON i.shipment_leg_id = sl.id
WHERE t.origin = :origin
  AND t.destination = :destination
  AND t.depart_at BETWEEN :window_start AND :window_end
  AND t.available_capacity_kg >= :item_weight_kg
  AND t.status = 'ACTIVE'
GROUP BY t.id, u.id, tp.id
HAVING
  -- Crowding constraint: don't exceed category limit per traveler per trip
  COALESCE(SUM(CASE WHEN i.category = :item_category
               THEN i.weight_kg ELSE 0 END), 0)
  + :item_weight_kg <= :category_limit
ORDER BY tp.trip_count_last_90_days ASC,  -- Prefer lower-frequency travelers (2.1)
         t.depart_at ASC
```

This query enforces Constraint 2.1 (prefer lower-frequency travelers) and the crowding
constraint (per-category limit per traveler per trip) at the query level. Document this
query in DATA_MODEL.md under "Core Queries" — not just the schema.

---

## RUNBOOK.md — The Manual Operations Handbook

This file does not appear in the Phase 0 prompt but is required for Phase 1 to be
operable. Create it in the root. It documents every manual process that complements
the app in Phase 1. When something goes wrong at 11pm, the on-call person needs this.

**Minimum sections for RUNBOOK.md:**

```
1. How to manually release an escrow (payment held, dispute resolved)
2. How to manually trigger a state transition (shipment stuck, app failure)
3. How to suspend a traveler/aggregator immediately (bad actor)
4. How to process a KYC review (step-by-step for KYC_REVIEWER admin)
5. How to update a rule in the rules engine via admin panel
6. How to replay a failed webhook (WebhookLog → reprocess)
7. How to restore the database from backup (with test instructions)
8. What to do when Africa's Talking is down (SMS fallback procedures)
9. How to handle a customs seizure report (escalation path, state to set)
10. What to do when a traveler reports item tampering (dispute initiation)
11. How to generate a corridor supply report (matching the Phase 1 KPIs)
12. On-call escalation contacts (founder, tech lead, aggregator operators)
```

RUNBOOK.md is a living document. Every incident in Phase 1 should result in either
updating an existing runbook entry or adding a new one.

---

## Phase-Specific Engineering Best Practices

### Phase 0 (NOW) — Foundation

- Every document produced must be version-controlled (git) from day one.
  Commit each document as it's completed with a descriptive commit message.
- CLAUDE.md must be updated whenever an architectural decision changes.
  It is the authoritative source — drift from it is drift from the project.
- Every entity in the data model must have at least one sentence of rationale
  for why it exists as a separate entity vs. a field on an existing entity.
- The state machine must be validated against all ten edge cases from the
  supplementary context document before being finalized.
- The rules engine schema must be validated by encoding all Constraint 2.4 rules
  as actual example JSON records — not "example JSON records would look like this"
  but actual records.

### Phase 1 (MVP) — Build and Validate

- Feature branches must be short-lived (< 5 days). If a feature takes longer,
  it should be broken into smaller, independently deployable pieces.
- Every PR must include: what this changes, what the test coverage is, and
  which Phase 1 validation assumption this serves (reference Riskiest Assumption 1-5).
- Deployment to staging is automatic (every merge to main). Review staging before
  deploying to production.
- Database migrations must be backwards-compatible. The "expand-contract" pattern:
  add new columns as nullable first (expand), deploy, backfill data, then add
  constraints (contract) in a separate migration. This allows zero-downtime deploys.
- Seed data must always be runnable in a clean environment. If a developer runs
  `prisma db seed`, they get a complete working dataset: one aggregator hub, three
  senders, five travelers with trips, three active shipments in different states.
- Every production incident gets a 5-line post-mortem in RUNBOOK.md:
  what happened, why, how it was fixed, how to prevent it.

### Phase 2 — International Corridors

- Before writing a single line of Phase 2 code, run the Phase Validator prompt
  against every planned Phase 2 feature to confirm Phase 1 gates were met.
- Introduce API versioning at the route level before Phase 2 changes break
  any Phase 1 API contracts. Mobile clients still running Phase 1 app versions
  must continue to function during the Phase 2 transition period.
- The rules engine must be reviewed against the official Ethiopian customs
  regulation document (OQ-3) before Phase 2 includes any international corridors.
  International corridors have different and more complex regulatory requirements
  than domestic routes.
- The payment architecture decision (OQ-1) MUST be resolved before Phase 2.
  Cross-border payments require a payment partner with the appropriate licensing.
  Do not build Phase 2 without this decision being made and documented.
- TravelProfile frequency tracking becomes more important in Phase 2 (international
  customs scrutiny is higher). Ensure the frequency calculation has been validated
  against real Phase 1 data before Phase 2 traveler onboarding.

### Phase 3+ — Expansion

- Multi-tenancy (country_code columns, see Decision 3) must be audited before
  adding a second country. Ensure every query that should be country-scoped IS
  country-scoped. Add Postgres row-level security at this point.
- The professional/dedicated courier tier (Node 2 sub-tier) formalization requires
  a separate onboarding flow, capacity declaration mechanism, and potentially different
  pricing rules. Design this as additive to the existing Traveler model, not a rebuild.
- Data residency requirements vary by African country. Before expanding to a country
  with local data residency requirements, evaluate whether single-region Postgres is
  compliant or whether data sharding by country_code is needed.

---

## Final Synthesis — What This Three-Document Set Produces

The Phase 0 Claude Code session, guided by three complete context documents, must
produce 16 files that collectively answer every question a developer, operator, or
investor might ask about Shanta's technical foundation.

If someone asks "how does a shipment move through the system?" → STATE_MACHINE.md.
If someone asks "what are we allowed to ship?" → RULES_ENGINE.md.
If someone asks "how are we built?" → ARCHITECTURE.md + TRD.md.
If someone asks "what should we build next?" → PHASE_PLAN.md.
If someone asks "what should we NOT build?" → GUARDRAILS.md.
If someone asks "what decisions still need to be made?" → OPEN_QUESTIONS.md.
If something breaks in production at midnight → RUNBOOK.md.
If Claude Code starts a new session on Shanta → CLAUDE.md.

When these 16 files exist and are complete, Phase 0 is done.
When Phase 0 is done, the riskiest thing about Phase 1 is the business, not the code.
That is the goal.