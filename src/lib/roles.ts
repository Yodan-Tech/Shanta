import { Role } from "@prisma/client";

/** Roles a user can actively choose at onboarding (RECEIVER is implicit for all). */
export const SELECTABLE_ROLES: readonly Role[] = [
  Role.SENDER,
  Role.TRAVELER,
  Role.AGGREGATOR,
];

export function hasRole(roles: Role[], role: Role): boolean {
  return roles.includes(role);
}

/** A user needs onboarding until they hold at least one active (non-receiver) role. */
export function needsOnboarding(roles: Role[]): boolean {
  return !roles.some((r) => SELECTABLE_ROLES.includes(r));
}

/** Normalises raw role inputs to valid selectable roles + the implicit RECEIVER. */
export function normaliseSelectedRoles(raw: string[]): Role[] {
  const selected = raw.filter((r): r is Role =>
    SELECTABLE_ROLES.includes(r as Role),
  );
  return Array.from(new Set<Role>([...selected, Role.RECEIVER]));
}
