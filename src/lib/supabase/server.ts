import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Server-side Supabase client bound to the request cookies. Use in Server
 * Components, Route Handlers, and Server Actions to read the authenticated user.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` called from a Server Component — safe to ignore when the
            // session is refreshed by middleware instead.
          }
        },
      },
    },
  );
}
