import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Stethoscope, ShieldAlert } from "lucide-react";

import { useRole } from "@/context/role-context";
import { useAuth } from "@/context/use-auth";
import { ROLES, ROLE_BY_ID, type Role } from "@/lib/roles";
import { DEMO_USERS } from "@/lib/users";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/LoginForm";
import { roleFromAuthUser } from "@/lib/auth-role";
import { canRoleAccess } from "@/lib/access";

/** Accept only same-origin absolute paths starting with a single "/". */
function safeFromPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/\\")) return null;
  return value;
}

/**
 * Учебный вход с выбором роли/пользователя. UX-симуляция, не настоящая авторизация.
 * Stage 1G-C: над учебным выбором роли смонтирована рабочая форма входа.
 * Stage 1H-A: уже аутентифицированных пользователей редиректим на роль-home.
 * Stage 1H-B: при наличии безопасного location.state.from возвращаем туда,
 * если маппированная роль имеет доступ к этому маршруту.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setRole } = useRole();
  const { status, user } = useAuth();

  const pick = (r: Role) => {
    setRole(r);
    navigate(ROLE_BY_ID[r].home, { replace: true });
  };

  const handleRealLoginSuccess = () => {
    // No-op: real navigation is handled by the auth-state effect below.
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    const mapped = roleFromAuthUser(user);
    setRole(mapped);
    const fromState = (location.state as { from?: unknown } | null)?.from;
    const from = safeFromPath(fromState);
    const target =
      from && canRoleAccess(mapped, from) ? from : ROLE_BY_ID[mapped].home;
    navigate(target, { replace: true });
  }, [status, user, setRole, navigate, location.state]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="w-full max-w-lg rounded-md border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">Дерматолог Про</h1>
            <p className="text-[12px] text-muted-foreground">Клиническая поддержка решений</p>
          </div>
        </div>

        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--warning) / 0.08)",
            borderColor: "hsl(var(--warning) / 0.30)",
            color: "hsl(var(--warning))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Учебный режим. Доступ не является реальной защитой.</span>
        </div>

        <section aria-labelledby="login-real-heading" className="mb-6">
          <h2
            id="login-real-heading"
            className="mb-2 text-[13px] font-semibold leading-tight"
          >
            Вход в Дерматолог Про
          </h2>
          <LoginForm onSuccess={handleRealLoginSuccess} />
        </section>

        <div className="text-[12px] uppercase tracking-wide text-muted-foreground">
          Выбрать учебную роль
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLES.map((r) => {
            const u = DEMO_USERS[r.id];
            return (
              <Button
                key={r.id}
                variant="outline"
                className="h-auto justify-start py-2 text-left"
                onClick={() => pick(r.id)}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-medium">{r.label}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {u.fullName}
                  </span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
