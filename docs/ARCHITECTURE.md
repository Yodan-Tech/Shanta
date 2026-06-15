# SHANTA — Architecture

> The system shape: components, how they communicate, and the patterns that make Shanta survive
> Ethiopian connectivity. Tech-stack rationale lives in [TRD.md](TRD.md); data shapes in
> [DATA_MODEL.md](DATA_MODEL.md). This document explains *why the pieces fit together this way*.

> ⚠️ **Superseded in part by [ADR-0001](DECISIONS.md) (Phase 1 kickoff).** Phase 1 is built
> as **one Next.js full-stack web app** (UI + Route Handlers + Server Actions via Prisma) on
> **Supabase** (Postgres + Auth + Storage), deployed on Vercel — not the Fastify/Railway +
> Flutter + Cloudflare(R2/edge) topology diagrammed below. The component *responsibilities*
> (state machine, rules engine, outbox, webhook→async, offline/SMS-first for receivers) are
> unchanged; only the hosting/runtime/auth/storage technologies changed.

## System Overview

```
            ┌──────────────────────────────────────────────────────────────┐
            │                         Cloudflare                            │
            │  TLS · WAF/DDoS · OTP rate-limit · CDN (R2/Images thumbnails) │
            └───────────────┬───────────────────────────────┬──────────────┘
                            │                               │
              ┌─────────────▼────────────┐     ┌────────────▼──────────────┐
              │   Flutter Mobile (Android │     │  Next.js Admin Panel       │
              │   first) — Senders,       │     │  (Vercel) — Shanta staff   │
              │   Travelers, Aggregators, │     │  IP-allowlisted, TOTP      │
              │   Receivers (app-optional)│     └────────────┬──────────────┘
              │   Offline: Drift + queue  │                  │
              └─────────────┬─────────────┘                  │
                            │  REST /api/v1 (JWT)             │ REST /api/v1 (admin JWT)
                            ▼                                 ▼
            ┌──────────────────────────────────────────────────────────────┐
            │                  Fastify API (Railway) — monolith             │
            │  modules: auth · users/kyc · trips · hubs · shipments ·       │
            │           items · handoffs · rules · escrow · pricing · admin │
            │  Zod validation · Pino logs (correlation id) · Sentry         │
            │  State machine service (optimistic locking) · Rules engine    │
            └───┬───────────┬───────────────┬───────────────┬──────────────┘
                │           │               │               │
        ┌───────▼──┐  ┌─────▼──────┐  ┌─────▼──────┐  ┌──────▼─────────┐
        │PostgreSQL│  │  Inngest    │  │ Cloudflare │  │  Outbox →      │
        │ 16       │  │ (jobs:      │  │ R2 + Images│  │  Africa's      │
        │ (Railway)│  │  sms,push,  │  │ (handoff   │  │  Talking (SMS) │
        │ Prisma   │  │  photo,     │  │  photos,   │  │  FCM (push)    │
        │          │  │  webhooks)  │  │  ID docs)  │  └────────────────┘
        └──────────┘  └─────────────┘  └────────────┘
                │  webhooks (signed) ▲
                └─ Africa's Talking / TeleBirr(P2) ─┘ → WebhookLog → Inngest
```

One backend, one database, three clients (mobile, admin, and — implicitly — the receiver's plain SMS).

## Component Breakdown

| Component | Purpose | Tech | Phase 1 | Phase 2+ |
|---|---|---|---|---|
| Mobile app | Sender/Traveler/Aggregator flows; receiver optional | Flutter + Riverpod + Drift | Android, EN (am keys present) | iOS; Amharic translations |
| Admin panel | Staff operations: KYC, hubs, disputes, escrow, rules | Next.js + Shadcn/ui | Full operability set | richer analytics |
| API | All business logic, state machine, rules engine | Fastify + Prisma + Zod | Monolith, modules | API versioning before breaking changes |
| Database | Source of truth | PostgreSQL 16 | single region | row-level security per country (P3) |
| Jobs | Async work (SMS, push, photo, webhooks, reports) | Inngest | core jobs | settlement jobs (P2) |
| File storage | Handoff/ID photos | Cloudflare R2 + Images | thumbnails + signed full-res | retention/anonymization (OQ-9) |
| SMS/Push | Notifications | Africa's Talking + FCM | both channels | USSD exploration |
| Edge | TLS, rate limit, DDoS, CDN | Cloudflare | mandatory | — |

The **aggregator/hub operations** surface (within the mobile app) is treated as a first-class
component, not a sub-screen — it is the spine of the system (see
[prompts/AGGREGATOR_AGENT.md](../prompts/AGGREGATOR_AGENT.md)).

## API Layer

- **REST**, versioned at the path: `/api/v1/...`. Versioning introduced **before** any Phase 2 change
  breaks a Phase 1 mobile client (old app versions must keep working through the transition).
- **Auth:** `Authorization: Bearer <JWT access>` (15 min). Refresh via `/api/v1/auth/refresh` (refresh
  token 30 days, hashed in DB, revocable). Admin tokens are a *separate* issuer/audience (8h, no
  refresh, IP-allowlisted).
- **Validation:** every route has a Zod schema for body/params/query; Fastify schema validation at the
  route boundary + Zod at the service boundary. No unvalidated input reaches Prisma.
- **Idempotency:** mutating endpoints accept `Idempotency-Key`; replays within 24h return the original
  response (Postgres-backed store in Phase 1).
- **Rate limiting:** at the Cloudflare layer (esp. OTP) + application checks (`OTPRequest`). No custom
  rate-limit infra in Phase 1.
- **Errors:** consistent envelope `{ error: { code, message, correlation_id, details? } }`; 409 for
  concurrency conflicts (state machine), 422 for validation/rules failures.
- **Health:** `GET /health` (no auth, <100ms) reports db/inngest/storage — used by Railway/Cloudflare.

## Offline / Low-Connectivity Strategy

Designed for the worst link in the chain (airport during the verification step). See connectivity
realities in [CLAUDE.md](../CLAUDE.md).

- **Local-first mobile data layer (Drift/SQLite).** Critical flows write locally first, then sync.
- **Critical flows queue, never hard-fail:** content-verification photos and delivery-confirmation
  capture are saved to a local outbox and uploaded with retry/backoff when connectivity returns. The
  UI shows explicit "pending sync" state, not an ambiguous spinner or an error.
- **Photo handling:** compress to WebP (≤5MB, 75% quality) **on-device before upload**; generate a
  small thumbnail for immediate local display.
- **Each critical action completes in <60s active screen time** (load-shedding/low-battery reality).
- **Optimistic UI** for non-critical actions; authoritative state always re-synced from the API.
- **SMS-first for receivers:** delivery and confirmation never *require* the app. The receiver gets an
  SMS (with a confirmation code/link); confirmation works without a smartphone.
- **Idempotency keys** make the inevitable mobile retries safe (no duplicate shipments — Edge 7).

## File Storage Architecture

- All photos/videos → **Cloudflare R2** (S3-compatible, zero egress). Images via **Cloudflare Images**
  for auto-compression + CDN-served thumbnails.
- **Two resolutions:** 480p thumbnail (CDN, fast retrieval across Ethiopia) + full-res (dispute review).
- **Access control:** full-res and ID documents only via **signed URLs (1h expiry)**; every access is
  logged. ID documents are admin-only. Handoff photos are visible only to involved parties.
- **Never** serve uploads through the API server; validate file type by **magic bytes**, not extension.
- **Delivery-confirmation photos: live capture only** (no gallery), enforced in-app and via metadata.
- Retention/anonymization is OQ-9 (default: keep active indefinitely, anonymizable after 2y).

## Notification Architecture (dual channel + outbox)

- On a state transition, the `Notification` row is written in the **same DB transaction** (outbox
  pattern) — guaranteeing "state changed ⇒ notification eventually sent" even if a provider is down.
- An Inngest job drains the outbox: `PUSH` via FCM (app users), `SMS` via Africa's Talking (receivers
  and as fallback). Failures retry with backoff; `attempts`/`status` tracked on the row.
- Language per recipient (`User.preferred_language`, default AM). Templates are i18n keys.

## Webhook Handling

Inbound webhooks (Africa's Talking delivery receipts; TeleBirr in Phase 2; Inngest):
```
1. POST /webhooks/{provider}
2. Verify HMAC signature immediately; if invalid → log + return 200 (avoid retry floods)
3. Write raw payload to WebhookLog (dedupe by event_id)
4. Publish an Inngest event; return 200 fast
5. Inngest processes asynchronously with retry/backoff — never synchronous business logic
```

## Background Jobs (Inngest)

`notification/send-sms`, `notification/send-push`, `notification/retry-failed`,
`shipment/check-stuck` (daily, >48h in one state → alert), `shipment/escrow-timeout-check` (daily,
HELD >7d → alert finance), `traveler/frequency-report` (weekly, maintains `TravelProfile` counts for
Constraint 2.1), `verification/process-photo` (compress + thumbnail + signed URL),
`kyc/notify-reviewer`. Every job: **idempotent, logged, monitored**.

## Technology Decisions Table

| Component | Choice | Rationale (Ethiopia-specific) | Rejected | Why rejected |
|---|---|---|---|---|
| Backend framework | Fastify | 2–3× Express throughput on modest Railway instances; built-in schema validation; TS-first | Express | No built-in validation; slower; legacy patterns |
| ORM | Prisma | Type-safe client, migrations, JSONB, known in Addis dev community | TypeORM/Knex | Less type safety / more boilerplate |
| Mobile | Flutter | Native-canvas rendering faster on 1–2GB Tecno/Itel; Drift offline DB; camera control for live capture; one codebase | React Native | Bridge perf worse on low-end; weaker offline story |
| Local DB | Drift (SQLite) | Robust offline-first for spotty handoff connectivity (2.3) | Hive/prefs | Not relational; weaker for queued sync state |
| Auth | Phone OTP + JWT | Phone = identity in ET; users trained by TeleBirr/CBE Birr; email unreliable | Email/password, OAuth | Email rarely used by receivers; reset flows break |
| Jobs | Inngest | Zero infra (no Redis/Celery), TS-native retries, Railway-friendly | BullMQ+Redis | Extra infra to run/monitor in Phase 1 |
| File storage | Cloudflare R2 + Images | Zero egress (receivers fetch photos a lot); CDN near users; auto-compress | AWS S3 | Egress cost; no built-in image pipeline |
| SMS | Africa's Talking | Confirmed Ethiopia coverage; intl delivery for diaspora; ETB billing | Twilio | Weaker ET coverage/pricing |
| Hosting | Railway | Managed Postgres, git deploys, monorepo, minimal DevOps pre-PMF | AWS/GCP/K8s | DevOps overhead unjustified before validation |
| Admin host | Vercel | Natural Next.js host; preview deploys | self-host | Extra ops |
| Edge | Cloudflare | OTP rate-limit, DDoS, TLS, CDN — free tier covers Phase 1 | none | — |

## Phase 1 Architecture (what's actually built)

Monolith Fastify API + Postgres + Inngest on Railway; Flutter Android app; Next.js admin on Vercel;
R2/Images; Africa's Talking + FCM; Cloudflare in front. **Manual** matching, escrow (hub-held), and
KYC (staff review) — all via the admin panel. Single corridor (OQ-5), single region, EN UI (am keys
present). No payment integration, no international, no GPS, no commercial documents.

## Phase 2 Additions (international corridors)

API versioning; `CUSTOMS_CLEARANCE`/`AT_TRANSIT_HUB` flows activated (Constraint 2.3, Addis transit);
cross-border payment partner + TeleBirr/CBE Birr integration (OQ-1 resolved) with settlement jobs +
reconciliation; iOS app; Amharic translations; stricter international rulesets (OQ-3); Fayda KYC
(OQ-6) if production-ready.

## What We're NOT Building in the Architecture

- **Microservices** — monolith until a concrete scaling reason exists; splitting early multiplies ops.
- **Kubernetes / container orchestration** — Railway handles deploys; k8s is unjustified overhead.
- **GraphQL** — REST is sufficient; GraphQL adds tooling/complexity with no Phase 1 benefit.
- **WebSockets / real-time** — push + SMS cover status updates; live channels are premature.
- **Multi-region / read replicas** — single region pre-PMF; `country_code` seeds future tenancy only.
- **Full-text search** — Postgres `ILIKE` is enough for Phase 1 item/trip lookups.
- **Custom rate-limit / WAF infra** — Cloudflare provides it.
- **Fraud-detection ML / analytics pipeline / A/B infra** — rule-based flags + SQL reporting first.
- **Any commercial-shipping document generation** — OQ-4 regulatory risk; records stay internal.

(See [GUARDRAILS.md](../GUARDRAILS.md) for the reasoning behind each exclusion.)
