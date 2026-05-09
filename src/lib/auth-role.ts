// Stage 1G-C · Map a Supabase auth user to a demo Role.
//
// Reads role from app_metadata.role first, then user_metadata.role.
// Falls back to "doctor" when missing or unknown. Only roles defined in
// src/lib/roles.ts are accepted.

import type { User } from "@supabase/supabase-js";
import { ALL_ROLES, type Role } from "@/lib/roles";

const ROLE_SET: ReadonlySet<string> = new Set<string>(ALL_ROLES);

function asRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  return ROLE_SET.has(value) ? (value as Role) : null;
}

export function roleFromAuthUser(user: User | null | undefined): Role {
  if (!user) return "doctor";
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return asRole(appMeta.role) ?? asRole(userMeta.role) ?? "doctor";
}
