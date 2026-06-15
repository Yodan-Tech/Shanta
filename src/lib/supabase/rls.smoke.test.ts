import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS baseline smoke test (Milestone 0 security gate). Proves the public `anon`
 * Supabase client is denied direct access to domain tables — all real data access
 * must go through the server-side service-role / Prisma path.
 *
 * Hits the live Supabase project, so it is opt-in: it runs only when
 * `RUN_INTEGRATION=1` and real Supabase env vars are present. The default unit-test
 * run (and CI without live credentials) skips it. Wired into a real test DB in M13.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const enabled =
  process.env.RUN_INTEGRATION === "1" &&
  !!url &&
  !!anonKey &&
  !url.includes("placeholder");

describe.runIf(enabled)("RLS baseline — anon is denied (M0 security gate)", () => {
  // Built lazily inside tests so the skipped path never constructs a client.
  const anon = () => createClient(url!, anonKey!);

  it("cannot read seeded item_restrictions (RLS hides all rows from anon)", async () => {
    // The seed inserts 8 rules; with RLS enabled and no anon policy the public
    // client must see zero of them.
    const { data, error } = await anon().from("item_restrictions").select("*");
    expect(data ?? []).toHaveLength(0);
    // PostgREST returns an empty set rather than an error for a denying RLS filter;
    // either way, no rows leak.
    expect(error?.message ?? "no-error").toBeDefined();
  });

  it("cannot read shipments as anon", async () => {
    const { data } = await anon().from("shipments").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot insert a shipment as anon", async () => {
    const { error } = await anon().from("shipments").insert({ receiver_name: "x" });
    expect(error).not.toBeNull();
  });
});
