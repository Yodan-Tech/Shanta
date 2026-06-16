# Shanta Phase-1 Pilot Launch Checklist

> Complete all items before accepting the first real shipment. Sign off each section.
> Reference: [docs/PHASE_PLAN.md](PHASE_PLAN.md) gate metrics.

---

## 1. Infrastructure

- [ ] Supabase production project live, migrated (`pnpm db:deploy`), and seeded (`pnpm db:seed`)
- [ ] All Vercel environment variables set for production:
  - [ ] `DATABASE_URL` (pooled, `:6543`)
  - [ ] `DIRECT_URL` (direct, `:5432`)
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `CRON_SECRET` (random string ≥ 32 chars)
  - [ ] `DELIVERY_TOKEN_SECRET` (random string ≥ 32 chars, distinct from CRON_SECRET)
  - [ ] `NEXT_PUBLIC_APP_URL` (e.g. `https://shanta-alpha.vercel.app`)
- [ ] Vercel deployment of `main` at latest commit: `GET /api/v1/health` → `{"data":{"database":"ok"}}`
- [ ] Vercel Cron Jobs visible in dashboard (4 jobs scheduled)
- [ ] Cron drain test: manually trigger `/api/v1/cron/drain-notifications` with correct Bearer header → 200

---

## 2. Security

- [ ] RLS policies applied: run `prisma/migrations/rls_policies_phase1.sql` via Supabase SQL editor
  - Verify: `SELECT * FROM travel_profiles` as `authenticated` role returns 0 rows
- [ ] `kyc-docs` Supabase Storage bucket set to **private** (no public access)
- [ ] `handoff-photos` Supabase Storage bucket set to **private**
- [ ] `DELIVERY_TOKEN_SECRET` is NOT the service role key (must be a separate secret)
- [ ] Smoke tests pass: `PLAYWRIGHT_BASE_URL=https://shanta-alpha.vercel.app pnpm test:smoke`

---

## 3. Operations

- [ ] At least one `AdminUser` created in production DB with `role = SUPER_ADMIN`
- [ ] Admin panel accessible at `/admin` and shows KPI dashboard
- [ ] Rules manager shows the seeded item restrictions
- [ ] KYC review queue is operational (approve/reject flow tested with a test user)
- [ ] Manual escrow release tested end-to-end in staging (RUNBOOK §1)
- [ ] RUNBOOK §7 backup drill completed and result documented

---

## 4. SMS Provider (OQ-10)

> Block: cannot confirm delivery or OTP without real SMS. Confirm status before launch.

- [ ] SMS provider configured (Africa's Talking or confirmed alternative)
- [ ] Test OTP delivery to an Ethiopian phone number (real, not test mode)
- [ ] Test delivery confirmation SMS: receiver receives link, can confirm from basic Android browser

---

## 5. Pilot Supply (Phase-1 Gate Metrics)

> From [docs/PHASE_PLAN.md] — do not proceed without these:

- [ ] Pilot corridor confirmed by founder (OQ-5): ___________________________
- [ ] ≥ 5 KYC-verified travelers with active trips on the pilot corridor
- [ ] ≥ 1 aggregator hub operator trained and able to complete intake→verify→seal end-to-end
- [ ] Aggregator has completed the verification chain at least once on a test shipment
- [ ] ≥ 3 test senders have created shipments that reached `AWAITING_HUB_INTAKE`

---

## 6. Go/No-Go Gate

| Metric | Target | Actual | Pass? |
|---|---|---|---|
| KYC-verified travelers on corridor | ≥ 5 | | |
| Hub operators trained | ≥ 1 | | |
| End-to-end test shipments completed | ≥ 1 | | |
| P0 bugs in smoke suite | 0 | | |
| Trust incidents (disputed handoffs) | 0 | | |
| Health check response | `{database: ok}` | | |
| OTP delivery (real phone) | Working | | |
| Admin panel operational | Yes | | |

**Sign-off required:** Founder ________________ Date: ___________

---

## 7. Open Questions Status

| OQ | Topic | Status |
|---|---|---|
| OQ-1 | Payment architecture (manual hub escrow vs automated) | Manual hub escrow → pilot |
| OQ-2 | Pricing per kg | Provisional 120 ETB/kg seeded; update before launch |
| OQ-3 | Official customs regulation obtained? | **BLOCKING** if prohibitions need to be adjusted |
| OQ-4 | Customs documentation export | Generating no commercial docs (platform policy) |
| OQ-5 | Which pilot corridor | **MUST be resolved before launch** |
| OQ-10 | SMS provider | **BLOCKING** for OTP + delivery confirmation |

---

## 8. Post-Launch (first 48h)

- [ ] Monitor `/api/v1/admin/kpis` daily
- [ ] Check stuck shipments via admin panel (should be 0 >48h stuck)
- [ ] Verify cron `drain-notifications` is firing (Vercel dashboard)
- [ ] Complete first RUNBOOK §7 backup drill
- [ ] Document any incidents in RUNBOOK post-mortem template
