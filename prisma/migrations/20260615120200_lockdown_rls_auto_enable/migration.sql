-- Security hardening (Milestone 0): least-privilege on the pre-existing
-- `public.rls_auto_enable()` event-trigger function.
--
-- That function auto-enables Row-Level Security on every new table in `public`
-- (a useful safety net), but it carried the default PUBLIC EXECUTE grant, so the
-- Supabase `anon`/`authenticated` roles could call it via /rest/v1/rpc — flagged
-- WARN by the security advisor (0028/0029). Event-trigger functions cannot actually
-- run outside trigger context, but least-privilege says revoke the grant anyway.
--
-- Guarded with IF EXISTS so this migration is a harmless no-op on a fresh database
-- that does not have the function (e.g. an ephemeral CI/test database).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
