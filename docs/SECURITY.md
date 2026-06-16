# Shanta — Security Model (Milestone S)

## Assets

| Asset | Classification | Location |
|---|---|---|
| User phone numbers | PII | profiles.phone (Supabase Postgres) |
| KYC identity documents | Sensitive PII | Supabase Storage, kyc-docs bucket (private) |
| Handoff verification photos | Operational | Supabase Storage, handoff-photos bucket (private) |
| Escrow records + amounts | Financial | escrow_records (Postgres, service_role only) |
| Shipment contents declarations | Operational | items table |
| TravelProfile frequency data | Internal risk | travel_profiles (no client access, Constraint 2.1) |
| Admin credentials | Critical | admin_users table + Supabase Auth |
| Delivery token secret | Credential | DELIVERY_TOKEN_SECRET env var |
| CRON_SECRET | Credential | CRON_SECRET env var |
| Supabase service_role key | Credential | SUPABASE_SERVICE_ROLE_KEY env var |

## Controls In Place

### Authentication
- End-user: phone OTP via Supabase Auth (SMS). No passwords.
- Admin: email + password via `admin_users` table; sessions separate from user sessions.
- Receiver: stateless HMAC-SHA256 delivery token (7-day TTL), no login required.

### Authorization
- Row-Level Security enabled on all tables; default-deny for `anon` and `authenticated`.
- Per-role read policies: users see only their own rows. All writes via service_role (server-side only).
- `travel_profiles` has no `authenticated` policy → invisible to end users (Constraint 2.1).
- Admin panel role guards: OPERATIONS / FINANCE / KYC_REVIEWER / SUPER_ADMIN enforced on every endpoint.

### Transport
- HTTPS enforced via Vercel + HSTS header (`max-age=63072000; includeSubDomains; preload`).
- CSP header on every response (see `next.config.ts`).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

### File Uploads
- Magic-byte validation on all uploads (JPEG/PNG/WebP only; never trust MIME type).
- 10MB size cap.
- Private Supabase Storage buckets (`handoff-photos`, `kyc-docs`); no public access.
- Signed URLs with 1-hour TTL; issuance logged via AuditLog.
- Live-capture-only enforcement for delivery photos (server-side, not client flag).

### Rate Limiting
- `/api/v1/kyc/submit`: 5 req/min per IP.
- `/login`, `/verify`, `/api/auth`: 10 req/min per IP.
- Implemented in `src/proxy.ts` (module-scope sliding window, resets on cold start).
- Production upgrade path: replace with Upstash Redis + `@upstash/ratelimit`.

### Audit Trail
- Every admin action writes to `audit_logs`.
- Every shipment state transition writes to `shipment_status_history` + `audit_logs`.
- Immutable `handoff_records` with photo URLs at every verification step.

### Secrets
- All secrets in Vercel environment variables; never logged; never committed to git.
- `.env.local` gitignored; `.env.example` has key names only.

### Dependency Security
- `pnpm audit` clean (postcss override in `pnpm.overrides`).

## Attack Surface + Mitigations

| Attack | Control |
|---|---|
| OTP brute-force | Rate limit on /login + /verify; Supabase Auth lockout |
| Unauthorized data read | RLS deny-all + service_role-only write paths |
| KYC doc exfiltration | Private bucket; signed URL required; admin role guard |
| Traveler frequency disclosure | No client-facing policy on travel_profiles (Constraint 2.1) |
| Fake delivery confirmation | HMAC-SHA256 token; 7-day expiry; timing-safe compare |
| File upload exploit | Magic-byte validation; size cap; MIME type ignored |
| Admin panel unauthorized access | Separate AdminUser session; role guards; IP allowlist (TODO: MS follow-up) |
| Cron endpoint abuse | Bearer CRON_SECRET header required; returns 403 otherwise |
| Stuck shipment / escrow timeout | Cron jobs alert admin; manual intervention (RUNBOOK §5-6) |
| Cash/forex abuse (Constraint 2.5) | Cash is a hard-prohibited item category in the rules engine |

## Manual Steps Required (before external users)

1. **Apply RLS migration**: run `prisma/migrations/rls_policies_phase1.sql` via Supabase SQL editor.
   ```sh
   # Via Supabase dashboard → SQL editor → paste the file contents
   # Or: supabase db execute --project-ref plvrkjkoeybarlgmfqcv < prisma/migrations/rls_policies_phase1.sql
   ```
2. **Set CRON_SECRET** in Vercel dashboard (all environments).
3. **Verify kyc-docs bucket is private** in Supabase Storage → Policies.
4. **Rotate DELIVERY_TOKEN_SECRET** before production (currently falls back to service_role key).
5. **IP allowlist on /admin** (Vercel Firewall or Supabase Edge Functions) — deferred to M14.

## Accepted Risks (Phase 1 Pilot)

| Risk | Acceptance Rationale |
|---|---|
| In-memory rate limiting resets on cold start | Pilot scale; acceptable until Upstash available |
| CSP uses unsafe-inline | Next.js App Router compatibility; nonce-based CSP in future hardening pass |
| Admin IP allowlist not yet implemented | Pilot has known operators; schedule for M14 |
| No automated penetration testing | Scheduled before Phase 2 expansion |
