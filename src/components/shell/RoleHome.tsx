import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "@/context/role-context";
import { AuthContext } from "@/context/auth-context";
import { ROLE_BY_ID } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { isSelfHostedApiConfigured, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import { selfHostedHomePath } from "@/lib/self-hosted-role";

export function RoleHome() {
  const { role } = useRole();
  const auth = useContext(AuthContext);
  const session = useSelfHostedApiSession();
  const selfHosted = isSelfHostedApiConfigured(session);
  const selfHostedEntry = selfHosted || !isSupabaseConfigured();

  if (selfHostedEntry && !selfHosted) return <Navigate to="/self-hosted/login" replace />;
  if (!selfHostedEntry && auth?.status === "loading") return <div role="status" className="p-6">Проверяем вход…</div>;
  if (!selfHostedEntry && (auth?.status !== "authenticated" || !auth.accessToken)) return <Navigate to="/login" replace />;
  if (!role) return (
    <section role="alert" className="p-6">
      <h1 className="text-[15px] font-semibold">Роль не назначена</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">Обратитесь к администратору клиники. Доступ к рабочим разделам закрыт.</p>
    </section>
  );
  return <Navigate to={selfHosted ? selfHostedHomePath(session) : ROLE_BY_ID[role].home} replace />;
}
