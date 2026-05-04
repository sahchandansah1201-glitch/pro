import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { type Role, ROLE_BY_ID } from "@/lib/roles";
import { type CurrentUser, userForRole } from "@/lib/users";

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  label: string;
  /**
   * Текущий демо-пользователь. UX-симуляция, не настоящая сессия.
   * currentUser.role всегда синхронизирован с активной демо-ролью.
   */
  currentUser: CurrentUser;
}

const RoleContext = createContext<RoleContextValue | null>(null);
const STORAGE_KEY = "derma-pro:demo-role";

export function RoleProvider({ children }: { children: ReactNode }) {
  // Lazy initializer — читаем сохранённую демо-роль синхронно до первого рендера,
  // чтобы редирект "/" сразу вёл на стартовый маршрут нужной роли.
  const [role, setRoleState] = useState<Role>(() => {
    if (typeof window === "undefined") return "doctor";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Role | null;
      if (saved && ROLE_BY_ID[saved]) return saved;
    } catch {
      // ignore
    }
    return "doctor";
  });

  const setRole = (r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem(STORAGE_KEY, r);
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

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

/** Удобный хук — возвращает текущего демо-пользователя. */
export function useCurrentUser(): CurrentUser {
  return useRole().currentUser;
}
