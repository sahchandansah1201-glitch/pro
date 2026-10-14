// Trusted app metadata is a UI hint only. Backend RBAC remains authoritative.

import type { User } from "@supabase/supabase-js";
import { ALL_ROLES, type Role } from "@/lib/roles";

const ROLE_SET: ReadonlySet<string> = new Set<string>(ALL_ROLES);

function asRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  return ROLE_SET.has(value) ? (value as Role) : null;
}

export function roleFromAuthUser(user: User | null | undefined): Role | null {
  if (!user) return null;
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  return asRole(appMeta.role);
}
