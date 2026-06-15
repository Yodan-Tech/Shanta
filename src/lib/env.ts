/**
 * Centralised, validated environment access. Fail fast and loud if a required
 * variable is missing rather than producing confusing runtime errors later.
 * Public (NEXT_PUBLIC_*) values are safe in the browser; the service-role key and
 * DB URLs are server-only — never import `serverEnv` into a client component.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  countryCode: process.env.COUNTRY_CODE ?? "ET",
};

/** Server-only. Accessing this on the client will throw at import-eval time. */
export const serverEnv = {
  get serviceRoleKey() {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
  get databaseUrl() {
    return required("DATABASE_URL", process.env.DATABASE_URL);
  },
};
