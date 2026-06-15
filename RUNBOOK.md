# SHANTA — Operations Runbook

> The manual-operations handbook for the human processes that complement the app in Phase 1. When
> something goes wrong at 11pm, this is what the on-call person reads. **Living document:** every
> incident results in updating an existing entry or adding a new one (+ a 5-line post-mortem). Most
> actions happen through the **admin panel**; never touch the production database directly except as
> an explicit last resort under §7. Concepts referenced: [STATE_MACHINE.md](docs/STATE_MACHINE.md),
> [DATA_MODEL.md](docs/DATA_MODEL.md), [RULES_ENGINE.md](docs/RULES_ENGINE.md).

## On-call principles
- Every manual action that changes a record must leave a trail: use admin-panel actions (they write
  `AuditLog`) and add an `OperationalNote` explaining *why*.
- Prefer the **least destructive** action that resolves the issue. Reversible > irreversible.
- If money or trust is at stake (escrow, disputes, seizures), slow down and follow the steps exactly.

---

## 1. Manually release an escrow (payment held, delivery confirmed)
**When:** delivery confirmed clean.
1. Confirm shipment status is `DELIVERY_CONFIRMED` and `EscrowRecord.status = HELD`; verify the
   `release_condition` is satisfied (receiver confirmed, seal intact, no open dispute). **Never
   release on an open `DISPUTED` shipment** — the endpoint enforces this and will reject it.
2. Confirm the payee split (carrier + aggregator fees) against `pricing_snapshot`. The escrow
   `amountEtb` equals the quoted `totalPriceEtb`.
3. `POST /api/v1/admin/escrow/<shipmentId>/release` with `{ "expectedVersion": <current shipment
   version> }` (role: **FINANCE** or **SUPER_ADMIN**). The admin panel (Milestone 10) wraps this.
4. In one transaction the system sets `EscrowRecord.status = RELEASED` (`releasedBy`, `releasedAt`)
   and transitions the shipment `DELIVERY_CONFIRMED → ESCROW_RELEASED`, writing `AuditLog`.
   Then advance `ESCROW_RELEASED → COMPLETED` (§2 manual transition, actor SYSTEM) to finalize.
   Add an `OperationalNote` if any judgment was involved.

**Refund instead (sender cancellation / return / dispute resolved for the sender):**
`POST /api/v1/admin/escrow/<shipmentId>/refund` with optional `{ "reason": "..." }` (FINANCE/
SUPER_ADMIN) sets `EscrowRecord.status = REFUNDED`; then route the shipment to `CANCELLED` or
`RETURNED_TO_SENDER` via §2. **Note (M4 limitation):** releasing an escrow on a `DISPUTED`
shipment resolved in the *carrier's* favour is done via a manual `DISPUTED → ESCROW_RELEASED`
transition (§2, admin-reviewed); a dedicated dispute-release endpoint arrives with the admin panel.

## 2. Manually trigger a state transition (shipment stuck / app failure)
**When:** an actor couldn't advance the shipment via the app (crash, connectivity).
1. Confirm the **physical reality** first (call the actor) — never transition ahead of the item.
2. Admin panel → Shipment → **Transition**. The tool enforces legal transitions
   ([STATE_MACHINE.md](docs/STATE_MACHINE.md)) and optimistic `version`.
3. If a handoff is required for that transition (photo/acknowledgment), capture/attach the evidence or
   record why it's missing in an `OperationalNote`.
4. Verify `ShipmentStatusHistory` + `AuditLog` recorded the change.

## 3. Suspend a traveler / aggregator immediately (bad actor)
**When:** credible report of theft, tampering, fraud, or cash-movement attempt.
1. Admin panel → User/Hub → **Suspend** (`status = SUSPENDED` / Hub `SUSPENDED`).
2. For a hub: identify all shipments currently `AT_ORIGIN_HUB`/`AT_DESTINATION_HUB`/`AT_TRANSIT_HUB`
   there → set `ON_HOLD` and arrange custody recovery (§6).
3. For a traveler holding items (`WITH_TRAVELER`/`IN_TRANSIT`): contact them, arrange return to nearest
   hub; un-match affected legs (compensation, [STATE_MACHINE.md](docs/STATE_MACHINE.md)); escrow stays
   HELD pending resolution.
4. File `OperationalNote` with evidence; notify the founder. Escalate to authorities only per founder/
   legal guidance.

## 4. Process a KYC review (KYC_REVIEWER)
1. Admin panel → KYC queue → open a `PENDING_REVIEW` user.
2. View the ID document via the **signed URL** (access is logged). Check name match; for professional
   travelers, perform the face-match against the ID photo.
3. **Approve** → `kyc_status = VERIFIED`, `kyc_method = MANUAL`, set `kyc_reviewed_by/at`. **Reject** →
   `REJECTED` with a reason (the user is notified to resubmit).
4. Never approve an aggregator without completing in-person/location verification first.

## 5. Update a rule in the rules engine (admin panel)
**When:** customs regulation obtained/changed (OQ-3), or a corridor needs a specific limit.
1. Admin panel → Rules → add/edit an `ItemRestriction`. Set a **future `effective_from`** so
   in-flight shipments are unaffected.
2. **Dry-run** against the fixture set (compliant + non-compliant items) and a sample of recent
   shipments; confirm expected PASS/FAIL.
3. Get a second admin to approve (4-eyes for prohibitions and limit *decreases*).
4. Save → `AuditLog(action="rule.updated")`. Update `source_regulation`. If it resolves part of OQ-3,
   update [OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md). Details:
   [RULES_ENGINE.md](docs/RULES_ENGINE.md), [prompts/RULES_UPDATE_AGENT.md](prompts/RULES_UPDATE_AGENT.md).

## 6. Replay a failed webhook (WebhookLog → reprocess)
1. Admin panel → Webhook log → find the entry (filter by `provider`, `processed_at IS NULL` or
   `processing_error`).
2. Confirm `signature_valid = true`. If false, do **not** replay — investigate the sender.
3. Check idempotency: if a later duplicate `event_id` already processed, mark resolved, don't replay.
4. Trigger **Reprocess** → re-publishes the Inngest event. Verify `processed_at` set and the downstream
   effect (e.g., SMS delivery status updated).

## 7. Restore the database from backup (with test instructions)
**When:** data loss/corruption. **Last resort. Do in week one as a drill, not for the first time in a
crisis.**
1. Railway → Postgres → Backups → select the most recent good daily backup.
2. **Restore into a NEW database instance first** (never overwrite prod blindly). Point a staging app
   at it and sanity-check key tables (`shipments`, `escrow_records`, `handoff_records`, `audit_logs`).
3. Reconcile any transactions since the backup from `AuditLog` / provider records where possible.
4. Only after verification, cut over (update `DATABASE_URL`, redeploy). Communicate downtime.
5. **Drill requirement:** perform steps 1–2 in week one and record the result here. An untested backup
   is not a backup.

## 8. When Africa's Talking is down (SMS fallback)
1. Confirm via `/health` and the AT status page. Check `Notification` rows piling up as `QUEUED`/
   `RETRYING` — the outbox retains them (they won't be lost).
2. The Inngest `notification/retry-failed` job retries with backoff; do not manually re-send (risks
   duplicates).
3. For **urgent** delivery confirmations during an outage, confirm with the receiver by **phone call**
   and use §2 to advance the shipment, noting the manual confirmation in an `OperationalNote`.
4. When AT recovers, verify the queue drains and `status = SENT`.

## 9. Customs seizure report (escalation, state to set)
**When:** a traveler reports an item held/seized at customs.
1. Set the shipment → `CUSTOMS_FLAGGED` (§2). Escrow is **frozen** (do not release/refund yet).
2. Gather facts: which leg, which authority, what was stated, the traveler's situation. `OperationalNote`.
3. **Do not generate or send any document that looks like a commercial shipping manifest/waybill**
   (OQ-4 unresolved). Follow founder/legal guidance for what (if anything) to provide.
4. Resolve per outcome: returned → `RETURNED_TO_SENDER` + refund; lost → `DISPUTED` then admin
   resolution. Notify sender/receiver factually. Capture a lesson in the post-mortem.

## 10. Traveler reports item tampering (dispute initiation)
1. Set shipment → `DISPUTED` (escrow must **not** release).
2. Pull the evidence chain: all `HandoffRecord`s (intake photo, contents photos, seal applied, seal
   intact flags) and `ShipmentStatusHistory`.
3. Determine where the seal broke (which custody segment). `OperationalNote` with findings.
4. Resolve: carrier favor → `ESCROW_RELEASED`; sender favor → refund + `RETURNED_TO_SENDER`. If a party
   is at fault, consider suspension (§3).

## 11. Generate a corridor supply report (Phase 1 KPIs)
1. Run the supply-depth query ([DATA_MODEL.md](docs/DATA_MODEL.md) "Core Queries") for the corridor and
   window.
2. Compile the PRD KPIs: supply depth, match rate, completion rate, verification completion/abandonment,
   traveler acceptance rate, sender repeat rate, trust incidents ([PRD.md](docs/PRD.md)).
3. Compare against the Phase 2 gate thresholds ([PHASE_PLAN.md](docs/PHASE_PLAN.md)). Share with founder.

## 12. On-call escalation contacts
> Fill in real contacts before launch. Keep this list current.
- **Founder / product owner:** _[name, phone]_
- **Tech lead / backend on-call:** _[name, phone]_
- **Aggregator operator(s) per hub:** _[name, hub, phone]_
- **Payment partner contact (when OQ-1 resolved):** _[name, phone]_
- **Legal / customs counsel (for §9, OQ-4):** _[name, phone]_

---

### Post-mortem template (paste under the relevant section after any incident)
```
#### Incident YYYY-MM-DD — <short title>
- What happened:
- Why (root cause):
- How it was fixed:
- How to prevent it (runbook/code change):
```
