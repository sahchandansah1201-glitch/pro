import { Navigate } from "react-router-dom";
import { useRole } from "@/context/role-context";
import { ROLE_BY_ID } from "@/lib/roles";
import { isProductionAppMode } from "@/lib/app-mode";
import { isSelfHostedApiConfigured, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import { selfHostedHomePath } from "@/lib/self-hosted-role";

/**
 * Редирект "/" на стартовый маршрут текущей демо-роли.
 * UX-only, NOT a security boundary.
 */
export function RoleHome() {
  const { role } = useRole();
  const session = useSelfHostedApiSession();

  if (isProductionAppMode()) {
    if (!isSelfHostedApiConfigured(session)) return <Navigate to="/self-hosted/login" replace />;
    return <Navigate to={selfHostedHomePath(session)} replace />;
  }

  return <Navigate to={ROLE_BY_ID[role].home} replace />;
}
