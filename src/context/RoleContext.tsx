import { useMemo, useState, type ReactNode } from "react";
import { type Role, ROLE_BY_ID } from "@/lib/roles";
import { userForRole } from "@/lib/users";
import {
  RoleContext,
  ROLE_STORAGE_KEY,
  type RoleContextValue,
} from "@/context/role-context";

export { useRole, useCurrentUser } from "@/context/role-context";

export function RoleProvider({ children }: { children: ReactNode }) {
  // Lazy initializer — читаем сохранённую демо-роль синхронно до первого рендера,
  // чтобы редирект "/" сразу вёл на стартовый маршрут нужной роли.
  const [role, setRoleState] = useState<Role>(() => {
    if (typeof window === "undefined") return "doctor";
    try {
      const saved = window.localStorage.getItem(ROLE_STORAGE_KEY) as Role | null;
      if (saved && ROLE_BY_ID[saved]) return saved;
    } catch {
      // ignore
    }
    return "doctor";
  });

  const setRole = (r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, r);
    } catch {
      // ignore
    }
  };

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole,
      label: ROLE_BY_ID[role].label,
      // currentUser выводится из роли — переключение роли всегда меняет и пользователя.
      currentUser: userForRole(role),
    }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
