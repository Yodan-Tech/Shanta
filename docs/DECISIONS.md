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

---

## ADR-0002 — Multi-channel auth: email-OTP + Telegram-OTP (phone kept)

**Date:** 2026-06-16 · **Status:** Accepted · **Phase:** 1 (Ethio↔Dubai expansion)

**Context.** Many senders/carriers are diaspora or Dubai-based and don't have an Ethiopian
phone handy, so phone-only login (ADR-0001) blocks them. Telegram is also the dominant chat
app in Ethiopia and already hosts the informal version of this marketplace.

**Decision.**
1. Add **email-OTP** (native Supabase `signInWithOtp`/`verifyOtp`) and **Telegram-OTP**
   login alongside the existing **phone-OTP** (all config-toggleable via `auth.*.enabled`
   AppConfig). This is email **OTP**, not email/password — the GUARDRAILS "email/password
   trap" still holds.
2. Telegram is not a Supabase-native provider, so it's verified server-side: HMAC over the
   bot token (login widget) or the webhook secret token (bot), then a session is minted via
   the admin `generateLink` → `verifyOtp` exchange. Telegram identity lives in
   `Profile.telegramUserId`; a synthetic `tg_<id>@telegram.shanta.app` maps it to a Supabase
   auth user. See [src/lib/telegram/auth.ts](../src/lib/telegram/auth.ts), `profile.ts`.
3. **Receivers are unchanged** — they never log in; they keep getting SMS confirmation links.
   SMS infrastructure stays for notifications (and optional phone OTP), not for sender/carrier login.

**Known limitation.** A Telegram identity gets its own auth user; cross-channel account
merging (same person via phone AND Telegram) is a later enhancement (relates to OQ-8 Sybil).

---

## ADR-0003 — Pull international (Ethio↔Dubai) into Phase 1 + routes/agents/aggregation-only

**Date:** 2026-06-16 · **Status:** Accepted (founder override) · **Phase:** 1

**Context.** GUARDRAILS + ADR-0001 defer international corridors to Phase 2 (customs,
cross-border payment, Addis transit). The founder chose to launch **Ethio↔Dubai** now
alongside intra-Ethiopia, as a deliberate override, to match where real demand and the
informal "distributed carry" economy already are.

**Decision.**
1. **Routes are first-class** via a new `RouteConfig` (per-route behavior: international,
   currency, customs-intelligence, allowed services). Pricing/rules still key off region
   pairs; RouteConfig adds behavior without hardcoding any route. The `code` doubles as the
   rule `corridorCode`. See [src/lib/routes.ts](../src/lib/routes.ts).
2. **Customs intelligence (compliance-positive).** `ItemRestriction` gains
   `maxUnitsPerTraveler` (lawful personal-use allowance, e.g. 1 laptop/person ENTRY into ET)
   and `dutyApplies`/`dutyNote` (transparency). The unit cap is enforced as an **aggregate**
   across a shipment's items per category. A manifest-diversity check flags carrier bags that
   look commercial — to **protect the individual traveler**, not to evade duties.
   **Scope boundary (held):** we did NOT build a duty-avoidance optimizer that fragments a
   commercial consignment to defeat customs thresholds — that is customs structuring/evasion.
   Public positioning of the customs feature is a new founder + customs-counsel open question.
3. **Aggregation-only service** (`Shipment.serviceType`): the hub consolidates and hands off
   to the sender's own carrier/receiver (state `CONSOLIDATED`), skipping matching/transit.
4. **Airport agents** (`Role.AIRPORT_AGENT`, `HubType.AGENT`, `Trip.agentId`): informal
   airport forwarders onboarded as a supply node (they bring travelers + act as a collection point).

**Caveats (unchanged constraints).** Cross-border payment stays **manual hub escrow** (OQ-1
unresolved). Dubai customs caps are **research-seeded, admin-editable** (OQ-3). VAT off (OQ-7).
