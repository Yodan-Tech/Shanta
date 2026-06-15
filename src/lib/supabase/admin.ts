import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role Supabase client for trusted SERVER-ONLY work (Storage uploads,
 * signed URLs). It bypasses RLS, so it must NEVER be imported into client code or
 * exposed to the browser. Use the SSR client (src/lib/supabase/server.ts) for any
 * user-scoped request. No session is persisted.
 */
let cached: SupabaseClient | undefined;

export function getServiceClient(): SupabaseClient {
  cached ??= createClient(
    publicEnv.supabaseUrl,
    serverEnv.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
