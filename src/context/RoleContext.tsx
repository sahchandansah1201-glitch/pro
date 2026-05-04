import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { type Role, ROLE_BY_ID } from "@/lib/roles";

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  label: string;
}

const RoleContext = createContext<RoleContextValue | null>(null);
const STORAGE_KEY = "derma-pro:demo-role";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("doctor");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Role | null;
    if (saved && ROLE_BY_ID[saved]) setRoleState(saved);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    localStorage.setItem(STORAGE_KEY, r);
  };

  const value = useMemo(
    () => ({ role, setRole, label: ROLE_BY_ID[role].label }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
