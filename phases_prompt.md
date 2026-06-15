# SHANTA — Master Implementation Plan (Autonomous Execution)

> **You are Claude Code, the founding engineer finishing Shanta end-to-end.** This file is your
> authoritative, ordered execution plan from the current state to a **bulletproof, production-ready
> platform**. Execute milestones **in order**. Do not skip the verification gate at the end of any
> milestone. This is professional product engineering, **not vibe coding** — every milestone ships
> with tests, passes CI, and is merged via a reviewed PR.
>
> **Read first, every session:** [CLAUDE.md](CLAUDE.md) (project memory + the 5 constraints),
> [GUARDRAILS.md](GUARDRAILS.md), [docs/DECISIONS.md](docs/DECISIONS.md) (ADR-0001 = the
> Supabase + Next.js stack), [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md),
> [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/RULES_ENGINE.md](docs/RULES_ENGINE.md),
> [docs/API.md](docs/API.md). When a decision changes, **update CLAUDE.md + the relevant doc in the
> same PR** — drift from the docs is drift from the project.

---

## 0. Prime Directives (never violate)

1. **The 5 constraints are law** (see CLAUDE.md): 2.1 frequent-traveler (no ratings/leaderboards/
   frequency rewards — *ever*; prefer low-frequency in matching; frequency is internal risk data),
   2.2 unwitting-mule (photo + acknowledgment + tamper-seal are mandatory **named states**, made
   structurally impossible to skip), 2.3 Addis multi-hop transit (state machine stays multi-leg),
   2.4 item caps (configurable rules engine, never hardcoded), 2.5 forex/cash (logistics only,
   cash is a hard-prohibited category; never a money-movement or forex tool).
2. **Smallest thing that validates the riskiest assumption.** Don't build Phase 2/3 scope. Check
   every feature against [GUARDRAILS.md](GUARDRAILS.md) "Traps that look like good ideas" and run
   the [PHASE_VALIDATOR](prompts/PHASE_VALIDATOR.md) reasoning when unsure.
3. **Layering is fixed** (already established — keep it): pure `src/lib/domain/*` (no I/O) →
   `src/lib/services/*` (orchestration over **repository ports**) → `src/lib/db/*` (ports + Prisma
   adapters + in-memory fakes) → `src/app/api/v1/*` (thin Route Handlers) / Server Actions → UI.
   **Services never import Prisma or `next/*` directly.** New domain logic = pure + unit-tested with
   fakes. New persistence = a port method + Prisma adapter + fake.
4. **Strict TypeScript, zero `any`, Zod on every input boundary.** Money is `Decimal` (integer-cent
   math in domain), timestamps UTC, optimistic `version` on state-machine entities (409 on conflict),
   idempotency keys on create mutations, soft deletes + audit fields, `country_code` respected.
5. **Security is non-negotiable before any external user** (see Milestone S). RLS on, secrets never
   in code/git, file uploads validated by magic bytes + private buckets + signed URLs, live-capture
   only for delivery photos, every admin action and state transition written to `AuditLog`.
6. **Open questions are not silently assumed.** OQ-1 (payment) → manual hub escrow only in Phase 1.
   OQ-4 (customs docs) → generate **no** commercial-shipping documents. OQ-10 (SMS provider) →
   pluggable. If blocked on an OQ, implement the documented default and flag it; don't guess.

---

## 1. Current State (already built — do NOT redo)

- **Phase 0 docs complete** (`docs/`, `prompts/`, CLAUDE/GUARDRAILS/RUNBOOK) + ADR-0001 reconciling
  the stack to **Supabase (Postgres+Auth+Storage) + Next.js full-stack (web-only) + Prisma on Vercel**.
- **App scaffolding:** Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn; strict TS; ESLint/
  Prettier; Vitest. Scripts in `package.json` (`typecheck`, `lint`, `test`, `build`, `db:*`).
- **Auth slice:** Supabase phone-OTP via `@supabase/ssr` — `/login`, `/verify`, `/onboarding`,
  `/dashboard`, `/admin`, middleware, `src/lib/auth.ts`, `src/lib/roles.ts`, `src/lib/validators.ts`.
- **Prisma schema:** 21 models (Profile, TravelProfile, AdminUser, Trip, TripLeg, Hub, Shipment,
  ShipmentLeg, Item, HandoffRecord, ItemRestriction, RestrictionCheck, EscrowRecord, CorridorPricing,
  Notification, ShipmentStatusHistory, AuditLog, WebhookLog, AppConfig, OperationalNote,
  IdempotencyKey). `prisma/seed.ts` exists.
- **Domain core (pure, tested):** `state-machine`, `rules-engine`, `pricing`, `matching`.
- **Backend services + REST:** ports + in-memory fakes + Prisma adapters; ShipmentService (create/
  get/list/transition), TripService, MatchingService; routes `/api/v1/{health,shipments,
  shipments/[id],shipments/[id]/transition,trips,matching,rules}`. Error envelope + Zod + role guards.
- **Verification baseline:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green
  (~67 tests). **Supabase project + GitHub are NOT yet provisioned** — that is Milestone 0.

> **Do not rebuild the above.** Extend it. Reuse the ports/services/domain patterns exactly.

---

## 2. Definition of Done — applies to EVERY milestone

A milestone is done only when ALL of these pass. This is the bulletproofing discipline.

1. **Code** follows the fixed layering and prime directives.
2. **Tests added/updated**: unit tests (domain + services with fakes) for all new logic; integration
   tests for new DB-touching paths once Milestone 0 gives a test DB; the MUST-TEST areas
   ([docs/TRD.md] testing strategy) stay covered (state machine, rules, escrow, auth/role guards).
3. **`pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green.** Zero `any`, zero lint
   errors. (Warnings → fix or justify.)
4. **Docs updated in the same change**: CLAUDE.md (if a decision changed), [docs/API.md](docs/API.md)
   (new/changed endpoints), [docs/STATE_MACHINE.md] / [docs/DATA_MODEL.md] (if behavior/schema
   changed), [docs/OPEN_QUESTIONS.md] (if an OQ moved), [RUNBOOK.md] (new manual procedure).
5. **Conventional-commit PR** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`) on a short-lived
   `feat/*` branch, body stating: what changed, which **Riskiest Assumption (1–5)** or constraint it
   serves, test coverage, and verification output. **CI green required to merge.**
6. **Security touchpoint check**: if the change adds an input, a query, a file upload, an auth path,
   or a role boundary, run the relevant items of the Milestone S checklist before merge.
7. **Smoke check** (once deployable, M0+): the happy path of the changed flow works on a Preview
   deployment.

> **Git workflow:** trunk-based; `main` always deployable; branches `feat/<slug>` < 5 days; PR + 1
> review (or self-review with the `/code-review` skill at `high`); squash-merge; tag releases `vX.Y.Z`
> for production. Never force-push `main`. Never commit secrets. Never `--no-verify`.

---

## 3. Milestones (execute in order)

### Milestone 0 — Infrastructure & Environment Bootstrap  ⚠️ founder-assisted, do first
**Goal:** a live, migrated, deployable system with CI/CD — the foundation every later milestone needs.
**Depends on:** founder providing Supabase + GitHub + Vercel access (see "Founder inputs" below).
**Steps:**
1. **Supabase:** confirm/create the free project; connect the **Supabase MCP** (read [docs/DECISIONS.md]).
   Build `.env.local` (gitignored): `DATABASE_URL` (pooled `:6543?pgbouncer=true`), `DIRECT_URL`
   (`:5432`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   Keep `.env.example` current (keys only).
2. **Migrate + seed:** `pnpm db:migrate` (creates all 21 tables) then `pnpm db:seed`. Verify tables
   via the MCP. Enable Supabase Auth **phone** provider with **test phone numbers** for dev (no real
   SMS yet — OQ-10).
3. **RLS baseline:** enable Row-Level Security on every table; default-deny for the `anon` role
   (all data access goes through server-side service-role/Prisma). Add a smoke test proving anon
   client cannot read a domain table. (Full per-role policies = Milestone S.)
4. **GitHub:** init/connect the repo (Shanta becomes its own repo). Add CI workflow
   `.github/workflows/ci.yml`: on PR → install → `lint` → `typecheck` → `test` → `prisma validate`
   → `build`. Cache pnpm. Required status checks on `main`.
5. **Vercel:** link the project (`vercel.ts` config), set env vars per environment, enable **Preview
   deployments per PR** and **production = promote/tag** (migrate-before-deploy). Add Sentry (DSN env)
   for errors. Configure security headers.
6. **Live smoke:** deploy a Preview; sign in with a test phone number → OTP → onboarding →
   `/dashboard`; hit `GET /api/v1/health` (database: ok). Document the result.
**Founder inputs needed (request explicitly, then continue):** Supabase project ref + DB password +
anon/service_role keys + a **personal access token** (for MCP); GitHub repo permission; Vercel
project link; (later) an SMS provider for OQ-10.
**DoD / gate:** migrations applied; seed loaded; CI green on a PR; Preview deploy live; auth works
end-to-end on the deploy; RLS anon-deny smoke test passes. Update RUNBOOK §7 with a **backup-restore
drill** result.

---

### Milestone 4 — Escrow + shipment-lifecycle completion (manual hub escrow, OQ-1)
**Goal:** money-hold lifecycle that never auto-releases on dispute; close the create→awaiting-intake gap.
**Scope (in):** `EscrowRepository` port + Prisma adapter + fake; `EscrowService`. On shipment create,
after `RULES_VALIDATED`, create `EscrowRecord{ holderType: HUB, status: PENDING }` and transition →
`AWAITING_HUB_INTAKE` (one transaction). Escrow → `HELD` when custody transfers (`WITH_TRAVELER`).
Admin release (`HELD`→`RELEASED`, only when `DELIVERY_CONFIRMED` and not `DISPUTED`) and refund
(`REFUNDED`). Endpoints: `POST /api/v1/admin/escrow/:id/release`, `/refund` (admin/FINANCE).
**Scope (out):** automated/cross-border payment, TeleBirr (Phase 2, OQ-1).
**Constraints:** 2.5 (cash/forex) — escrow holds a logistics fee, never moves cash for users.
**Tests:** escrow never releases on `DISPUTED`; release requires `DELIVERY_CONFIRMED`; amount matches
`pricing_snapshot`; create→escrow PENDING→AWAITING_HUB_INTAKE atomicity (fake + integration).
**DoD:** + docs/API.md updated; RUNBOOK §1 (manual release) verified against the real endpoint.

---

### Milestone 5 — Hub operations, handoffs & Supabase Storage (Constraint 2.2 core)
**Goal:** the verification chain — the spine of trust — fully enforced server-side.
**Scope (in):** `HandoffRepository` + `HandoffService`. Endpoints (aggregator role), each **derives
guard context server-side** (never trusts the client for safety flags):
- `POST /api/v1/shipments/:id/intake` — weigh (`actualWeightKg`), intake photo, **explicit cash check**;
  if `|actual−declared|` over `AppConfig` threshold → `WEIGHT_DISCREPANCY`.
- `POST /api/v1/shipments/:id/verify` — ≥1 contents photo required → `CONTENTS_VERIFIED`.
- `POST /api/v1/shipments/:id/seal` — only after verification; records `sealId` → `SEALED`.
Each writes an immutable `HandoffRecord`, advances state via the existing guarded transition, and
re-runs the rules engine at intake on `actualWeightKg`.
**Storage:** Supabase Storage **private** buckets for handoff/ID photos; upload via server with
**magic-byte** type validation + size cap + WebP compression; serve via **signed URLs (1h, logged)**.
**Constraints:** 2.2 (impossible to verify without a photo; seal strictly after verification; the app
must make skipping impossible); 2.4 (re-validate at intake).
**Tests:** cannot reach `CONTENTS_VERIFIED` without a photo; `SEALED` cannot precede verification;
weight-discrepancy path; upload rejects a non-image (magic bytes); signed URL access logged.
**DoD:** + RUNBOOK + API.md; storage bucket + policies documented.

### Milestone 6 — Matching assignment + traveler accept/reject (Constraints 2.1 + 2.2)
**Goal:** assign a ranked traveler and enforce the acknowledgment before custody.
**Scope (in):** `POST /api/v1/shipments/:id/match` (aggregator) — takes `tripLegId`, **re-checks
capacity + crowding + KYC/active** server-side, creates `ShipmentLeg`, decrements
`TripLeg.availableCapacityKg`, → `MATCHED_TO_TRAVELER`. Traveler: `POST .../review` →
`TRAVELER_REVIEWED`; `POST .../accept` (records the verbatim acknowledgment on `HandoffRecord`,
verifies seal intact) → `TRAVELER_ACCEPTED` → custody → `WITH_TRAVELER` + escrow `HELD`; `POST
.../reject` → `TRAVELER_REJECTED` → re-queue (`AWAITING_MATCH`, restore capacity).
**Constraints:** 2.1 (ranking already prefers low-frequency; never expose frequency); 2.2 (accept
requires acknowledgment; reject is a normal state).
**Tests:** crowding/over-capacity match rejected (422); accept without acknowledgment impossible;
reject restores capacity and re-queues; matching never surfaces frequency to the client.

### Milestone 7 — Delivery + receiver SMS confirmation + SMS provider hook (OQ-10)
**Goal:** close the loop for receivers who may have no smartphone.
**Scope (in):** `OUT_FOR_DELIVERY`, `DELIVERED` (live-capture photo only), `DELIVERY_ATTEMPTED`
(retry/escalate), and a **no-login receiver confirmation** page reached via SMS token/link →
`POST /api/v1/delivery/confirm` (token) → `DELIVERY_CONFIRMED`; broken-seal/problem path → `DISPUTED`
(escrow stays HELD). **SMS:** pluggable provider behind a `SmsSender` port; wire Supabase Auth
**Send-SMS hook → Africa's Talking** (or chosen provider) for OTP, and transactional SMS for receiver
links. Verify provider webhook signatures → `WebhookLog`.
**Constraints:** 2.2 (live capture, seal-intact check), SMS-first receiver (CLAUDE.md).
**Tests:** expired/invalid token rejected; gallery upload rejected for delivery; disputed delivery
does not release escrow; webhook signature verification.

### Milestone 8 — Notifications outbox + background jobs
**Goal:** "state changed ⇒ notification eventually sent," resilient to provider downtime.
**Scope (in):** write `Notification` (outbox) in the **same transaction** as the transition that
triggers it; a worker drains it (Vercel **Cron** route or Inngest) → SMS/push with retry/backoff,
tracking `attempts`/`status`. Jobs: `shipment/check-stuck` (>48h → alert), `escrow/timeout` (HELD
>7d → alert), `traveler/frequency-report` (weekly → maintain `TravelProfile` counts, Constraint 2.1).
**Constraints:** every job idempotent, logged, monitored.
**Tests:** outbox row written in the transition txn; retry on send failure; jobs idempotent.

### Milestone 9 — KYC submission + admin review (tiered, OQ-6)
**Goal:** identity accountability per actor tier without blocking casual-traveler onboarding speed.
**Scope (in):** `POST /api/v1/kyc/submit` (full name + ID upload to **private** Storage); admin
review queue + approve/reject (`kyc_status`, `kyc_method=MANUAL`, reviewer + timestamps). Gate:
traveler cannot publish a trip until `VERIFIED`; aggregator requires location verification.
**Constraints:** Sybil mitigation (OQ-8) via phone + ID uniqueness; ID docs admin-only signed URLs.
**Tests:** unverified traveler blocked from `POST /trips`; ID doc not publicly accessible.

### Milestone 10 — Admin operations panel (Phase-1 operability)
**Goal:** the platform is operable by staff without DB access.
**Scope (in):** admin endpoints + admin UI: shipments overview + manual transitions; dispute mgmt
(view evidence chain); escrow hold/release/refund; hub approval/suspend; **rules CRUD** (the rules
engine, with future `effectiveFrom`, 4-eyes for prohibitions/limit-decreases — see
[prompts/RULES_UPDATE_AGENT.md]); user suspend; KYC queue; audit/OTP logs; KPI dashboard
(supply depth, match/completion/acceptance/verification-abandonment rates — the Riskiest Assumptions).
**Constraints:** admin auth separate + role-guarded + IP/allowlist; every action → `AuditLog`.
**Tests:** role guards (OPERATIONS/FINANCE/KYC_REVIEWER/SUPER_ADMIN) enforced; rule update logged;
no admin action without an audit entry.

### Milestone S — Security hardening & review (run before any external user)
**Goal:** bulletproof the platform. **Run the `/security-review` skill** and resolve findings.
**Checklist (implement + verify):** full **RLS policies** per role on every table (deny by default;
service-role server path); Zod on every input; Prisma-only queries (no string SQL); file uploads
(magic bytes, size, private buckets, signed-URL expiry + access log, live-capture delivery);
secrets only in env (rotate before prod; never logged); `@next/*` security headers (CSP, HSTS,
X-Frame-Options); rate limiting (Supabase/Vercel + app-level on sensitive routes); CORS allowlist;
webhook signature verification; PII handling + retention (OQ-9); dependency audit (`pnpm audit`);
authz tests for every role boundary; **no commercial-shipping document generation** (OQ-4).
**DoD:** security-review findings triaged (fixed or explicitly accepted with rationale); a written
threat-model pass against [docs threat model]; penetration smoke on auth/upload/transition endpoints.

### Milestone 12 — Frontend integration & hardening (UI via v0/dyad, then wired)
**Goal:** polished, on-brand, accessible web UI for every node, wired to the live API.
**Scope (in):** generate screens with [prompts/UI_GENERATION_PROMPT.md], then integrate into the app
and **wire to `/api/v1/*`** (the prompt already encodes the contract + brand + non-negotiables):
sender create/list/detail; traveler trips + accept-item; **aggregator hub console** (guided intake→
verify→seal→match); receiver SMS-confirmation page; admin. Full **i18n EN+AM** (next-intl, Noto Sans
Ethiopic); **WCAG AA**; mobile-first + low-bandwidth (thumbnails, lazy-load, “pending sync” states);
every view has loading/empty/error states; optimistic UI for non-critical actions.
**Constraints:** **no ratings/leaderboards/frequency UI** (2.1); verification + acknowledgment cannot
be skipped (2.2); transparent price breakdown; live-capture only.
**Tests:** component tests for critical forms; the E2E suite (Milestone 13) covers the flows.

### Milestone 13 — Testing completeness (unit + integration + E2E + smoke)
**Goal:** the test pyramid that makes refactors safe.
**Scope (in):** keep unit/domain/service coverage; **integration tests** against a real test
Postgres (Supabase branch or local container) for the Prisma adapters + route handlers;
**E2E with Playwright** for the critical user journeys — *Flow A end-to-end* (sender create → hub
intake/verify/seal → match → traveler accept → in-transit → delivered → receiver confirm → escrow
release → completed), traveler reject re-queue, weight-discrepancy, disputed delivery (no release),
admin manual transition; **smoke tests** run post-deploy against a Preview (`/health`, login, create
shipment). Coverage target: ~80% of the MUST-TEST areas; 0% of the deliberately-untested (per TRD).
**DoD:** E2E green in CI (headless) on an ephemeral DB; smoke job wired into the deploy pipeline.

### Milestone 14 — CI/CD, deployment & observability (production-grade)
**Goal:** safe, repeatable, observable releases.
**Scope (in):** finalize GitHub Actions: PR pipeline (lint/typecheck/test/integration/build/
`prisma migrate diff` check) + **E2E** + required checks; deploy pipeline — **migrate-before-deploy**,
Preview per PR, production via tag `vX.Y.Z` with manual approval + **Sentry release** tagging +
post-deploy **smoke** + documented **rollback** (Vercel rollback + migration-down strategy / expand-
contract). Observability: Sentry (errors), structured logs with correlation IDs, `/health`, uptime
check, the KPI/business dashboards from [docs/TRD.md] observability section, alerts (5xx>1%,
p95>2s, stuck shipments, escrow timeouts, OTP-abuse). Validate the **backup-restore** drill (RUNBOOK §7).
**DoD:** a tagged release deploys to production through the gated pipeline with smoke + rollback proven.

### Milestone 15 — Pilot readiness & Phase-1 launch gate
**Goal:** close business Phase 1 — ready to run one real domestic corridor.
**Scope (in):** finalize seed/operational data for the chosen corridor (OQ-5, founder decision);
verify all RUNBOOK procedures against the live system; wire the **Phase-1 validation-gate metrics**
([docs/PRD.md] KPIs + [docs/PHASE_PLAN.md] gates: supply depth, match ≥70%, completion ≥80%,
acceptance ≥75%, verification-abandonment trend, repeat ≥30%, **zero trust incidents**); go/no-go
checklist; confirm OQ-1 (payment), OQ-3 (customs reg), OQ-4 (docs) status before any Phase-2 work.
**DoD:** a documented launch checklist passes; dashboards show the gate metrics live; founder sign-off.

---

## 4. Cross-cutting standards (apply throughout)

- **Testing pyramid:** many pure unit tests (domain) → service tests (fakes) → integration (real test
  DB) → few E2E (critical journeys) → smoke (post-deploy). Test what breaks (state machine, rules,
  escrow, auth/role, money), not the obvious.
- **Security:** see Milestone S; treat it as a gate, not a phase you can defer.
- **Performance (Ethiopia):** 3G budgets, payloads small/paginated, images compressed to WebP +
  thumbnails, critical actions < 60s screen time, Lighthouse checks on key pages.
- **Accessibility & i18n:** WCAG AA; EN+AM from the start; layouts survive long Amharic strings.
- **Observability:** correlation IDs end-to-end; Sentry; business KPIs instrumented from day one.
- **Docs are part of the work:** CLAUDE.md authoritative; API.md tracks the contract; ADRs in
  DECISIONS.md for any architectural change; RUNBOOK grows with every manual procedure/incident.

## 5. Phase 2 / Phase 3 (future — gated, do NOT start until Phase-1 gates pass)

- **Phase 2 (international):** activate `CUSTOMS_CLEARANCE`/`AT_TRANSIT_HUB` (Constraint 2.3 Addis
  transit), cross-border payment via a licensed partner + TeleBirr/CBE Birr (OQ-1 resolved), stricter
  international rulesets (OQ-3), API `/v2` (keep `/v1` working), Fayda KYC (OQ-6). Prereqs: all
  Phase-1 gates met; OQ-1/3/4 resolved. See [docs/PHASE_PLAN.md].
- **Phase 3 (pan-African):** audit `country_code` scoping + add Postgres RLS per country before the
  2nd country; formalize the professional-courier tier (additive); data-residency review per country.

## 6. How to run each milestone (the loop)

1. Re-read CLAUDE.md + the constraint(s) the milestone touches + the relevant `docs/*` + `prompts/*`.
2. Branch `feat/<slug>`. Implement following the fixed layering; add tests first where practical.
3. Run the gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (+ integration/E2E where
   applicable). Update docs in the same change.
4. Self-review with `/code-review` at `high`; fix findings. Security-touchpoint check.
5. Open a conventional-commit PR (state the served Riskiest Assumption + coverage + verification).
   Ensure CI is green. Merge. Smoke-check the Preview/Prod.
6. Tick the milestone DoD. Only then start the next milestone. **Never skip a gate.**

> If a step is blocked on a founder decision or credential, implement the documented **default**,
> clearly flag the blocker in the PR description and [docs/OPEN_QUESTIONS.md], and continue with the
> next unblocked milestone. Build the platform that makes change cheap — and keep it bulletproof.
