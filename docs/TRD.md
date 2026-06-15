# SHANTA — Technical Requirements Document (Phase 1)

> The engineering contract: final tech choices justified against Ethiopian constraints, the API
> surface, security non-negotiables, performance targets, testing priorities, and deployment.
> System shape: [ARCHITECTURE.md](ARCHITECTURE.md). Data: [DATA_MODEL.md](DATA_MODEL.md).
> Standards here also belong in [CLAUDE.md](../CLAUDE.md) "How to Work on Shanta".

> ⚠️ **Superseded in part by [ADR-0001](DECISIONS.md) (Phase 1 kickoff).** The actual Phase 1
> stack is **Supabase (Postgres + Auth + Storage) + Next.js full-stack (web-only) + Prisma**
> on Vercel — not Fastify/Railway/custom-OTP-JWT/Cloudflare-R2/Flutter as written below.
> Supabase Auth owns OTP/JWT (custom `OTPRequest`/`RefreshToken` dropped). The security,
> testing, data-integrity, and deployment *principles* below still apply; only the named
> technologies changed. SMS provider hook: see OQ-10.

## Tech Stack Decisions (final — justified against constraints)

These are resolved; do not reopen in Phase 0. Rationale is **Ethiopia-specific**, not generic.

- **TypeScript (strict) + Node 20 + Fastify.** Fastify gives 2–3× Express throughput on the small
  Railway instances a pre-PMF startup can afford, with built-in schema validation. TS strict + Zod =
  type safety from DB to API surface, reducing the silent bugs that plague vibe-coded projects.
  Talent: Node/TS is the largest hireable pool in Addis.
- **Prisma + PostgreSQL 16.** Relational integrity for the state machine; JSONB for `pricing_snapshot`
  and flexible attributes; migrations built in; widely known locally; managed cheaply on Railway.
- **Flutter (Dart) mobile.** Native-canvas rendering outperforms React Native's bridge on 1–2GB
  Tecno/Itel/Infinix devices; Drift gives a real offline SQLite layer for spotty handoff connectivity
  (Constraint 2.3); the `camera` package gives the low-level control the live-capture verification flow
  needs. One codebase (Android now, iOS Phase 2). Growing East-African talent pool.
- **Riverpod / Drift / Dio / flutter_secure_storage / flutter_localizations.** State, offline DB,
  HTTP with JWT-refresh interceptors, secure token storage (not SharedPreferences), and i18n (en + am
  keys from day one — retrofitting i18n is expensive).
- **Next.js + Shadcn/ui admin** on Vercel, same API with admin-scoped JWT — no separate backend.
- **Inngest** jobs (zero infra vs Redis/Celery), **Pino** logs, **Sentry** errors, **Vitest** tests,
  **Resend** for admin/staff email only.
- **Cloudflare R2 + Images** (zero egress; receivers fetch photos heavily), **Africa's Talking** SMS
  (confirmed ET coverage), **FCM** push, **Cloudflare** edge (OTP rate-limit/DDoS/TLS), **Railway**
  hosting. Decision table with rejected alternatives: [ARCHITECTURE.md](ARCHITECTURE.md).
- **Turborepo monorepo**; `packages/types` is the single source of truth for API contracts (consumed
  by API + admin; Dart models generated from the same schemas) — prevents frontend/backend type drift.

## System Architecture Summary

Monolith Fastify API + Postgres + Inngest on Railway; Flutter Android app; Next.js admin on Vercel;
Cloudflare in front; R2/Images for files; Africa's Talking + FCM for notifications. Full diagram and
component breakdown: [ARCHITECTURE.md](ARCHITECTURE.md).

## Database Design & Migration Strategy

- Schema is `prisma/schema.prisma` (single source of truth); entities per [DATA_MODEL.md](DATA_MODEL.md).
- **Migrations run BEFORE app deploy** (CI/CD), never after — avoids new-code-vs-old-schema errors.
- **Expand–contract** for zero-downtime changes: add columns nullable (expand) → deploy → backfill →
  add constraints (contract) in a separate migration.
- **Constraints at the DB level**, not just app: unique(`phone_number`, admin `email`); checks
  (`weight_kg > 0`, `total_price_etb >= 0`); not-null on required fields; FK cascade behavior chosen
  per relationship; unique(`sender_id`,`idempotency_key`).
- **Soft deletes + audit fields** on every entity; **UTC** timestamps everywhere; **optimistic
  `version`** on state-machine entities (409 on conflict).
- **Phase 1 → Phase 2 upgrade path:** `country_code` already present (multi-tenancy seed);
  `EscrowRecord.holder_type` already supports automated payment; international rules are new rows, not
  schema changes; API versioning (`/api/v1`) lets Phase 2 add `/v2` without breaking Phase 1 clients.
- **Seed:** `prisma db seed` produces a complete working dataset (1 hub, 3 senders, 5 travelers with
  trips, 3 shipments in different states, the Constraint 2.4 ruleset, one `CorridorPricing`).

## API Specification (key Phase 1 endpoints)

All under `/api/v1`. Auth = user JWT unless noted. All bodies/params/queries Zod-validated. Mutations
accept `Idempotency-Key`. Errors: `{ error: { code, message, correlation_id, details? } }`.

| Method | Path | Auth | Request (key fields) | Success | Error cases |
|---|---|---|---|---|---|
| POST | /auth/otp/request | none | `{ phone_number }` | 200 `{ sent: true }` | 429 rate limit (3/hr,10/24h) |
| POST | /auth/otp/verify | none | `{ phone_number, otp }` | 200 `{ access, refresh, user }` | 401 bad/expired/used OTP |
| POST | /auth/refresh | refresh | `{ refresh_token }` | 200 `{ access }` | 401 revoked/expired |
| POST | /auth/logout | user | `{ refresh_token }` | 204 | — |
| GET | /me | user | — | 200 user | 401 |
| POST | /kyc/submit | user | `{ full_name, id_document(file) }` | 202 PENDING_REVIEW | 422 invalid file |
| POST | /trips | user(traveler,VERIFIED) | `{ mode, legs[] }` | 201 trip | 403 not verified, 422 |
| GET | /trips/search | admin/operator | `?origin&destination&from&to` | 200 trips | — |
| POST | /shipments | user(sender) | item(s), origin/dest, receiver, `Idempotency-Key` | 201 shipment(+price) | 422 rules FAIL, 409 dup key |
| GET | /shipments/:id | user(party)/admin | — | 200 shipment+history | 403, 404 |
| POST | /shipments/:id/transition | actor/admin | `{ to_status, version, handoff? }` | 200 new state | **409** wrong version/state, 422 invalid transition |
| POST | /handoffs | actor | `{ shipment_id, type, photos[], acknowledged?, seal? }` | 201 handoff | 422 missing photo/ack |
| POST | /shipments/:id/match | operator | `{ trip_leg_id }` | 200 matched | 422 crowding/capacity/freq fail |
| POST | /shipments/:id/confirm-delivery | receiver(SMS/app) | `{ code }` or live photo | 200 CONFIRMED | 410 expired code |
| POST | /webhooks/africa-talking | signature | provider payload | 200 always | (logs invalid sig) |
| GET | /health | none | — | 200 status | — |
| (admin) POST | /admin/escrow/:id/release | admin(FINANCE) | `{ reason }` | 200 RELEASED | 409 if DISPUTED |
| (admin) POST | /admin/rules | admin(OPS) | rule record | 201 rule | 403, 422 |

The `POST /shipments/:id/transition` endpoint is the single guarded entry to the state machine: it
checks `(expected status, version)`, validates the transition is legal ([STATE_MACHINE.md](STATE_MACHINE.md)),
writes `ShipmentStatusHistory` + `AuditLog`, and emits outbox `Notification`s — all in one transaction.

## Security Requirements (non-negotiable before any external user)

- **Auth:** phone OTP (bcrypt-hashed, 10-min, single-use); JWT access 15m / refresh 30d (hashed,
  revocable in DB, key-versioned for rotation). **Admin auth separate:** email+password+TOTP, 8h
  tokens, no refresh, IP-allowlisted (`ADMIN_ALLOWED_IPS`).
- **OTP abuse:** rate-limit at Cloudflare **and** app (`OTPRequest`); 3/hr, 10/24h; never log OTPs.
- **Input:** Zod on every endpoint; Prisma parameterizes all queries (no string-interpolated SQL;
  `$queryRaw` only with `Prisma.sql`).
- **File uploads:** validate by **magic bytes** (not extension), ≤5MB; store in R2; serve via signed
  URLs (1h, access-logged); **delivery photos live-capture only**.
- **Data at rest:** ID documents and handoff photos access-controlled (signed URLs); secrets in Railway
  env, never in code/git; rotate before first prod deploy; never log secrets/tokens.
- **Data in transit:** TLS everywhere (Cloudflare); **certificate pinning** in the Flutter app.
- **PII:** phone numbers, ID references, item descriptions, photos are PII; access-controlled;
  retention/anonymization per OQ-9 (default keep active, anonymizable after 2y).
- **CORS:** explicit origin allowlist (admin domain, app deep-link scheme); never `*` in prod.
- **Headers:** `@fastify/helmet` defaults (CSP, HSTS, X-Content-Type-Options, X-Frame-Options).
- **Webhooks:** verify HMAC-SHA256 before parsing; log to `WebhookLog`; idempotent by `event_id`.
- **Audit:** every admin action and every state transition → `AuditLog` (no action without a log).

## Performance Requirements (calibrated to Ethiopia, not 5G)

- **Target on 3G:** key screens interactive < 3s on a mid-2010s Android over 3G; `GET /health` < 100ms.
- **Payloads:** keep list responses small/paginated; thumbnails (480p) by default, full-res on demand.
- **Images:** compress to WebP (≤5MB, 75%) **on device before upload**; never upload raw camera files.
- **Offline sync:** critical captures queue locally (Drift) and upload with retry/backoff; UI shows
  explicit "pending sync"; **each critical action completable in <60s active screen time.**
- **API p95** < 2000ms (alert above); 5xx error rate < 1% over 5 min (alert above).

## Testing Strategy (pragmatic — test what breaks)

**MUST TEST (target ~80% of these areas):**
- State machine: every valid transition → correct state; every invalid transition rejected;
  compensation/rollback paths; **optimistic-locking concurrency** (two actors, one wins, other 409).
- Rules engine: each seed rule passes a compliant item and rejects a non-compliant one; corridor
  override beats base; frequency-sensitive jewelry applies the right cap by tier; rule update doesn't
  break in-flight validated shipments.
- Auth: OTP rate limits (3/hr, 10/24h); expired OTP rejected; used OTP not reusable; revoked refresh
  token can't mint access; admin auth fully separate from user auth.
- Escrow: not released on `DISPUTED`; release requires receiver confirmation; amount matches
  `pricing_snapshot`.

**SHOULD TEST:** key endpoint contracts (integration w/ test DB); auth middleware rejects
unauthenticated; role guards reject wrong roles.

**DO NOT TEST in Phase 1 (defer, with reason):** UI/E2E (brittle, too few users), load tests (no
load), visual regression. Coverage target: ~80% of MUST-TEST areas, 0% of DO-NOT-TEST. *Write tests
for what breaks if wrong, not for what's obvious.*

## Deployment Strategy

- **Environments:** local · staging (mirrors prod, auto-deploy on merge to `main`) · production
  (manual trigger from a tagged release).
- **CI (every PR):** `turbo run lint`, `turbo run typecheck` (`tsc --noEmit`), `turbo run test`
  (Vitest), `prisma migrate` dry-run. Green required to merge.
- **CD:** merge→main deploys staging (migrate then deploy). Tag `vX.Y.Z` → **manual approval gate** →
  prod (`prisma migrate deploy` **before** app deploy) → tag Sentry release.
- **Git:** trunk-based; short-lived `feat/*`,`fix/*` (<5 days); Conventional Commits (commitlint+husky);
  PR + 1 reviewer for logic changes.
- **Config:** every app has a committed `.env.example` (keys + descriptions, no values). No undocumented
  secrets. Required vars listed in the supplementary spec (DATABASE_URL, JWT secrets/expiries, AT_*,
  FCM_SERVER_KEY, CF_R2_*/CF_IMAGES_*, INNGEST_*, SENTRY_DSN, ADMIN_ALLOWED_IPS, NODE_ENV, APP_URL,
  COUNTRY_CODE=ET).
- **Backups:** Railway daily Postgres backups enabled day one; **verify a restore in week one** (don't
  assume — test it; see [RUNBOOK.md](../RUNBOOK.md) §7).
- **Observability:** Pino structured logs with a per-request `correlation_id`; Sentry; Railway metrics;
  the business-metrics dashboard from the supplementary (supply depth, match/completion/acceptance
  rates, verification abandonment, stuck-shipment alerts).

## Conscious Technical Debt (Phase 1, accepted with future cost)

| Debt | Why accepted now | Future cost |
|---|---|---|
| Manual escrow + manual matching (admin-run) | Validates the human trust loop at zero infra cost | Build automation in Phase 2 (OQ-1) |
| Manual KYC review | One-time onboarding step; low volume | Swap to Fayda API later (no schema change, OQ-6) |
| Idempotency store in Postgres (not Redis) | Avoids running Redis in Phase 1 | Move to Redis at scale |
| Postgres `ILIKE` search, no FTS | Sufficient for Phase 1 volume | Add full-text/search service later |
| Single region, single Postgres | Pre-PMF; cheap | Add DR/replicas/RLS for multi-country (Phase 3) |
| No automated Addis-transit handling | Phase 1 domestic; states exist, automation doesn't | Phase 2 builds the transit flows |

Debt is legitimate only because it's **named, reasoned, and revisited at the phase gate**
([PHASE_PLAN.md](PHASE_PLAN.md)). See also [GUARDRAILS.md](../GUARDRAILS.md).
