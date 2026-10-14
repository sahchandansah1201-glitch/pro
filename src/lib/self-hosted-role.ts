import { ALL_ROLES, ROLE_BY_ID, type Role } from "@/lib/roles";
import { canRoleAccess } from "@/lib/access";
import type { SelfHostedApiSession } from "@/lib/self-hosted-api-session";

const ROLE_SET = new Set<Role>(ALL_ROLES);

export function isKnownSelfHostedRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_SET.has(value as Role);
}

export function selfHostedRoles(session: Pick<SelfHostedApiSession, "user">): Role[] {
  const roles = session.user?.roles ?? [];
  const normalized: Role[] = [];
  for (const role of roles) {
    if (isKnownSelfHostedRole(role) && !normalized.includes(role)) normalized.push(role);
  }
  return normalized;
}

export function primarySelfHostedRole(
  session: Pick<SelfHostedApiSession, "user">,
): Role | null {
  return selfHostedRoles(session)[0] ?? null;
}

export function selfHostedRoleLabel(session: Pick<SelfHostedApiSession, "user">): string {
  const roles = selfHostedRoles(session);
  return roles.length > 0
    ? roles.map((role) => ROLE_BY_ID[role].label).join(", ")
    : "роль не назначена";
}

export function selfHostedHomePath(session: Pick<SelfHostedApiSession, "user">): string {
  const role = primarySelfHostedRole(session);
  return role ? ROLE_BY_ID[role].home : "/self-hosted/login";
}

export function canSelfHostedSessionAccessPath(
  session: Pick<SelfHostedApiSession, "user">,
  pathname: string,
): boolean {
  const roles = selfHostedRoles(session);
  return roles.length > 0 && roles.some((role) => canRoleAccess(role, pathname));
}
