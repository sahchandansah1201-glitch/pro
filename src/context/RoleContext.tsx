import { useContext, type ReactNode } from "react";
import { ROLE_BY_ID } from "@/lib/roles";
import { roleFromAuthUser } from "@/lib/auth-role";
import { AuthContext } from "@/context/auth-context";
import { isSelfHostedApiConfigured, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import { selfHostedRoles, selfHostedRoleLabel } from "@/lib/self-hosted-role";
import { RoleContext, type RoleContextValue } from "@/context/role-context";

export function RoleProvider({ children }: { children: ReactNode }) {
  const session = useSelfHostedApiSession();
  const auth = useContext(AuthContext);
  const selfHosted = isSelfHostedApiConfigured(session);
  const authRole = !selfHosted && auth?.status === "authenticated" && auth.accessToken
    ? roleFromAuthUser(auth.user)
    : null;
  const roles = selfHosted ? selfHostedRoles(session) : authRole ? [authRole] : [];
  const role = roles[0] ?? null;
  const currentUser = role && selfHosted && session.user
    ? {
        id: session.user.id,
        email: "",
        fullName: session.user.displayName,
        role,
        clinicId: session.user.roleBindings?.find((binding) => binding.role === role)?.clinicId ?? null,
        locale: "ru-RU" as const,
      }
    : role && auth?.user
      ? { id: auth.user.id, email: auth.user.email ?? "", fullName: auth.user.email ?? "Пользователь",
          role, clinicId: null, locale: "ru-RU" as const }
      : null;
  const value: RoleContextValue = {
    role,
    roles,
    label: selfHosted ? selfHostedRoleLabel(session) : role ? ROLE_BY_ID[role].label : "Роль не назначена",
    currentUser,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
