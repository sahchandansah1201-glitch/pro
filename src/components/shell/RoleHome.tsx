import { Navigate } from "react-router-dom";
import { useRole } from "@/context/role-context";
import { ROLE_BY_ID } from "@/lib/roles";

/**
 * Редирект "/" на стартовый маршрут текущей демо-роли.
 * UX-only, NOT a security boundary.
 */
export function RoleHome() {
  const { role } = useRole();
  return <Navigate to={ROLE_BY_ID[role].home} replace />;
}
