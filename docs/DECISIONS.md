# SHANTA — Architecture Decision Records (ADRs)

Short, dated records of decisions that change what the Phase 0 docs originally assumed.
When an ADR supersedes part of a doc, that doc carries a banner pointing here.

---

## ADR-0001 — Phase 1 implementation stack: Supabase + Next.js (web-only)

**Date:** 2026-06-14 · **Status:** Accepted · **Phase:** 1 kickoff

**Context.** Phase 0 documented a self-hosted stack (Fastify API + Prisma + self-managed
Postgres on Railway, custom phone-OTP/JWT auth, Cloudflare R2 storage, Flutter mobile app).
At Phase 1 kickoff the founder revised the stack for cost, speed, and simplicity, and to
serve *many* node interfaces from one surface.

**Decision.**
1. **Supabase** provides Postgres **+ Auth + Storage** (free tier).
   - **Auth:** Supabase phone-OTP replaces the custom OTP/JWT system. The custom
     `OTPRequest` and `RefreshToken` entities are **dropped** (Supabase Auth owns OTP
     issuance, sessions, refresh, rate limiting). Real SMS delivery will use a Supabase
     **Send-SMS auth hook → Africa's Talking** (see OQ-10); dev uses Supabase **test
     phone numbers**.
   - **Storage:** Supabase Storage (private buckets, signed URLs) replaces Cloudflare R2.
2. **Web-only** — one **Next.js** (App Router) application serves all node interfaces
   (Sender, Traveler, Aggregator) plus a guarded admin area. The **Flutter mobile app is
   dropped.** Receivers remain SMS-first (no app required).
3. **Next.js full-stack** holds business logic (Route Handlers + Server Actions) with
   **Prisma** against Supabase Postgres — replacing the standalone Fastify service. Single
   free **Vercel** deploy.
4. **RLS** (Row-Level Security) is enabled on all tables as defense-in-depth and the Phase 3
   multi-tenancy tool (aligns with the existing `country_code` seed). Business logic runs
   server-side via Prisma; client-direct table access is denied by default.
5. **Identity model:** `User` → **`profiles`** table keyed by Supabase `auth.users.id`
   (uuid). Admins are `auth.users` too, with an `admin_users` table for staff role.
6. **Tooling wired into Claude Code:** the official **Supabase MCP** (`.mcp.json`).

**What is unchanged.** The domain model, state machine, rules engine (configurable data),
all five constraints, escrow design (`EscrowRecord` still supports manual HUB and automated
PAYMENT_PROVIDER holders — OQ-1 still open), pricing model, audit trail
(`ShipmentStatusHistory` + `AuditLog`), idempotency, soft deletes, UTC, and the phasing
gates. Africa's Talking remains the SMS provider — now invoked via a Supabase auth hook.

**Consequences.**
- Faster to ship, $0 infra for Phase 1, fewer services to run.
- Less custom auth code to own/test (Supabase owns OTP/JWT correctness).
- Some Phase 0 docs (TRD, ARCHITECTURE, DATA_MODEL, CLAUDE) describe the *old* stack in
  places; they carry a banner pointing here. They will be revised in full as Phase 1
  proceeds. Where a doc and this ADR disagree, **this ADR wins** for Phase 1.
- New open question **OQ-10** (SMS provider hook). OQ-1 (payment) and OQ-6 (Fayda KYC)
  remain open and unaffected in substance.
