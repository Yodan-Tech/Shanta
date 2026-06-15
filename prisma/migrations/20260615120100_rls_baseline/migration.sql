-- RLS baseline (Milestone 0): default-deny for the public PostgREST roles.
--
-- All application data access goes through the server-side path: Prisma connects as
-- the `postgres` role (which has BYPASSRLS), and Supabase Auth/Storage are reached
-- with the service-role key. Enabling Row-Level Security with NO policies therefore
-- denies the `anon` and `authenticated` Supabase clients by default, while leaving the
-- trusted server path unaffected. Full per-role policies are Milestone S.
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op if already enabled.

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."travel_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."trips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."trip_legs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."hubs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shipment_legs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."handoff_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."item_restrictions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."restriction_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."escrow_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corridor_pricing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."shipment_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."operational_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."idempotency_keys" ENABLE ROW LEVEL SECURITY;
