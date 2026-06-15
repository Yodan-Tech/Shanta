import type { Profile, Role, AdminUser, AdminRole } from "@prisma/client";
import { getOrCreateProfile, getAdmin } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { ApiError } from "./errors";

/**
 * API auth helpers. Unlike the page helpers in src/lib/auth.ts (which redirect),
 * these throw ApiError so the response layer maps them to 401/403 envelopes.
 */

export async function requireApiProfile(): Promise<Profile> {
  const profile = await getOrCreateProfile();
  if (!profile) throw ApiError.unauthorized();
  if (profile.status === "SUSPENDED") {
    throw ApiError.forbidden("This account is suspended.");
  }
  return profile;
}

export async function requireApiRole(role: Role): Promise<Profile> {
  const profile = await requireApiProfile();
  if (!hasRole(profile.roles, role)) {
    throw ApiError.forbidden(`This action requires the ${role} role.`);
  }
  return profile;
}

export async function requireApiAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw ApiError.forbidden("Admin access required.");
  return admin;
}

/** Requires an admin holding one of the given roles (SUPER_ADMIN always allowed). */
export async function requireApiAdminRole(
  ...allowed: AdminRole[]
): Promise<AdminUser> {
  const admin = await requireApiAdmin();
  if (admin.role !== "SUPER_ADMIN" && !allowed.includes(admin.role)) {
    throw ApiError.forbidden(
      `This action requires one of these admin roles: ${allowed.join(", ")}.`,
    );
  }
  return admin;
}
