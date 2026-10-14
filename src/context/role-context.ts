import { createContext, useContext } from "react";
import type { Role } from "@/lib/roles";
import type { CurrentUser } from "@/lib/users";

export interface RoleContextValue {
  role: Role | null;
  roles: readonly Role[];
  label: string;
  /** Session-derived display identity, never an authorization boundary. */
  currentUser: CurrentUser | null;
}

export const RoleContext = createContext<RoleContextValue | null>(null);
// Historical key for negative tests. Runtime never reads or writes it.
export const ROLE_STORAGE_KEY = "derma-pro:demo-role";

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

export function useCurrentUser(): CurrentUser | null {
  return useRole().currentUser;
}
