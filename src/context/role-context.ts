import { createContext, useContext } from "react";
import type { Role } from "@/lib/roles";
import type { CurrentUser } from "@/lib/users";

export interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  label: string;
  /**
   * Текущий демо-пользователь. UX-симуляция, не настоящая сессия.
   * currentUser.role всегда синхронизирован с активной демо-ролью.
   */
  currentUser: CurrentUser;
}

export const RoleContext = createContext<RoleContextValue | null>(null);
export const ROLE_STORAGE_KEY = "derma-pro:demo-role";

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

/** Удобный хук — возвращает текущего демо-пользователя. */
export function useCurrentUser(): CurrentUser {
  return useRole().currentUser;
}
