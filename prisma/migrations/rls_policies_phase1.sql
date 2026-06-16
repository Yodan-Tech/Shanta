-- Phase-1 RLS policies. Run via Supabase dashboard SQL editor or:
--   supabase db execute --project-ref <ref> < prisma/migrations/rls_policies_phase1.sql
--
-- All tables have RLS enabled by default (deny-all baseline from M0 migration).
-- service_role bypasses RLS globally — no explicit policy needed.
-- authenticated role = end-user session (Supabase auth.users).

-- profiles: each user reads/updates only their own row
CREATE POLICY IF NOT EXISTS profiles_self_select ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY IF NOT EXISTS profiles_self_update ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- shipments: sender reads their own
CREATE POLICY IF NOT EXISTS shipments_sender_select ON shipments
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid());

-- items: readable if the authenticated user is the sender
CREATE POLICY IF NOT EXISTS items_via_shipment ON items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = items.shipment_id
        AND shipments.sender_id = auth.uid()
    )
  );

-- notifications: user reads their own
CREATE POLICY IF NOT EXISTS notifications_self_select ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- trips: traveler reads their own
CREATE POLICY IF NOT EXISTS trips_traveler_select ON trips
  FOR SELECT TO authenticated
  USING (traveler_id = auth.uid());

-- trip_legs: readable if the authenticated user owns the parent trip
CREATE POLICY IF NOT EXISTS trip_legs_via_trip ON trip_legs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_legs.trip_id
        AND trips.traveler_id = auth.uid()
    )
  );

-- item_restrictions: readable by all authenticated (public rule catalog)
CREATE POLICY IF NOT EXISTS rules_authenticated_select ON item_restrictions
  FOR SELECT TO authenticated USING (true);

-- corridor_pricing: readable by all authenticated
CREATE POLICY IF NOT EXISTS pricing_authenticated_select ON corridor_pricing
  FOR SELECT TO authenticated USING (true);

-- NO policies on (deny by default = service_role only):
--   travel_profiles  — internal frequency risk data (Constraint 2.1)
--   escrow_records   — financial; admin/service only
--   handoff_records  — verification evidence; service only
--   audit_logs       — admin only
--   admin_users      — admin auth table
--   app_config       — service only
--   shipment_status_history — service only
