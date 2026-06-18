import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Role, type Profile, type AdminUser } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { needsOnboarding } from "@/lib/roles";
import { TELEGRAM_EMAIL_DOMAIN } from "@/lib/env";

/** The authenticated Supabase user, or null. */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the domain Profile for the current auth user, creating it on first
 * sign-in (profile.id == auth.users.id). Mirrors the phone number for convenience.
 * Returns null if there is no authenticated user.
 */
export async function getOrCreateProfile(): Promise<Profile | null> {
  const user = await getAuthUser();
  if (!user) return null;

  // Mirror real contact channels from auth.users. Synthetic Telegram emails
  // (tg_*@telegram.shanta.app) are NOT mirrored onto profile.email — that field is
  // reserved for real email-OTP logins; Telegram identity lives in telegramUserId.
  const realEmail =
    user.email && !user.email.endsWith(`@${TELEGRAM_EMAIL_DOMAIN}`)
      ? user.email
      : undefined;

  return prisma.profile.upsert({
    where: { id: user.id },
    update: {
      ...(user.phone ? { phone: user.phone } : {}),
      ...(realEmail ? { email: realEmail } : {}),
    },
    create: {
      id: user.id,
      ...(user.phone ? { phone: user.phone } : {}),
      ...(realEmail ? { email: realEmail } : {}),
      roles: [Role.RECEIVER],
    },
  });
}

/** Like getOrCreateProfile but redirects to /login when unauthenticated. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getOrCreateProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** True if the profile holds the given role. */
export function hasRole(profile: Profile, role: Role): boolean {
  return profile.roles.includes(role);
}

/** Redirects to onboarding if the profile holds no "active" (non-receiver) role yet. */
export function requireActiveRole(profile: Profile): void {
  if (needsOnboarding(profile.roles)) {
    redirect("/onboarding");
  }
}

/** The AdminUser record for the current auth user, or null (not staff). */
export async function getAdmin(): Promise<AdminUser | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const admin = await prisma.adminUser.findUnique({ where: { id: user.id } });
  return admin?.active ? admin : null;
}

/** Redirects non-staff away from the admin area. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/");
  return admin;
}
