// UX-only for учебный role access; the real-entry gate added in Stage 1H-A
// is the only auth-aware piece here.
//
// RoleGuard показывает аккуратный экран "Нет доступа в демо-режиме",
// если активная демо-роль не имеет права на маршрут. Это UX-симуляция.
//
// Stage 1H-A: когда рабочий вход сконфигурирован, неаутентифицированных
// пользователей редиректим на /login до проверки учебной роли. Когда вход
// не сконфигурирован — поведение прежнее, чисто учебное.

import { useEffect, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";

import { useRole } from "@/context/role-context";
import { useAuth } from "@/context/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { isProductionAppMode } from "@/lib/app-mode";
import { canRoleAccess } from "@/lib/access";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  clearSelfHostedApiSession,
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import {
  canSelfHostedSessionAccessPath,
  selfHostedHomePath,
  selfHostedRoleLabel,
} from "@/lib/self-hosted-role";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const { role, setRole, label } = useRole();
  const { status } = useAuth();
  const selfHostedSession = useSelfHostedApiSession();
  const productionMode = isProductionAppMode();

  if (productionMode) {
    if (!isSelfHostedApiConfigured(selfHostedSession)) {
      const from = `${pathname}${search}${hash}`;
      return <Navigate to="/self-hosted/login" replace state={{ from }} />;
    }
    if (canSelfHostedSessionAccessPath(selfHostedSession, pathname)) return <>{children}</>;
    return (
      <ProductionNoAccessScreen
        roleLabel={selfHostedRoleLabel(selfHostedSession)}
        clinicalRoute={isClinicalRoute(pathname)}
        homePath={selfHostedHomePath(selfHostedSession)}
      />
    );
  }

  const configured = isSupabaseConfigured();

  if (configured) {
    if (status === "loading") return <AuthLoadingScreen />;
    if (status === "anonymous") {
      const from = `${pathname}${search}${hash}`;
      return <Navigate to="/login" replace state={{ from }} />;
    }
  }

  if (canRoleAccess(role, pathname)) return <>{children}</>;

  return <NoAccessScreen currentLabel={label} onSwitchRole={setRole} />;
}

function isClinicalRoute(pathname: string): boolean {
  return ["/patients", "/visits"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function ProductionNoAccessScreen({
  roleLabel,
  clinicalRoute,
  homePath,
}: {
  roleLabel: string;
  clinicalRoute: boolean;
  homePath: string;
}) {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function switchAccount() {
    clearSelfHostedApiSession();
    navigate("/self-hosted/login");
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6">
        <div className="mb-3 flex items-center gap-2 text-warning">
          <Lock className="h-4 w-4" aria-hidden />
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="rounded-sm text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {clinicalRoute ? "Нет доступа к клиническим данным" : "Нет доступа"}
          </h1>
        </div>
        {clinicalRoute ? (
          <p className="text-[13px] text-muted-foreground">
            Этот раздел доступен только сотрудникам с клиническим доступом.
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Текущая роль в системе клиники <span className="text-foreground">{roleLabel}</span> не
            имеет доступа к этому разделу. Права доступа определяются активным рабочим входом.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {clinicalRoute ? (
            <>
              <Button size="sm" className="min-h-11 text-[12px]" onClick={() => navigate(homePath)}>
                Вернуться к рабочему экрану
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="min-h-11 text-[12px]"
                onClick={switchAccount}
              >
                Войти под другой учётной записью
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" className="min-h-11 text-[12px]" onClick={() => navigate(-1)}>
                Назад
              </Button>
              <Button size="sm" className="min-h-11 text-[12px]" onClick={() => navigate("/self-hosted/login")}>
                Сменить вход в систему клиники
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full items-center justify-center p-6"
    >
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span>Проверяем вход…</span>
      </div>
    </div>
  );
}

function NoAccessScreen({
  currentLabel,
  onSwitchRole,
}: {
  currentLabel: string;
  onSwitchRole: (r: ReturnType<typeof useRole>["role"]) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6">
        <div className="mb-3 flex items-center gap-2 text-warning">
          <Lock className="h-4 w-4" aria-hidden />
          <h1 className="text-[13px] font-semibold">Нет доступа в учебном режиме</h1>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Текущая роль <span className="text-foreground">{currentLabel}</span> не входит в
          число ролей, для которых открыт этот раздел. Это учебный просмотр интерфейса;
          переключите роль, чтобы увидеть нужный рабочий экран.
        </p>

        <div className="mt-4 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Сменить учебную роль
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <Button
                key={r.id}
                variant="outline"
                size="sm"
                className="min-h-11 min-w-11 text-[12px]"
                onClick={() => onSwitchRole(r.id)}
              >
                {r.short}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="min-h-11 text-[12px]" onClick={() => navigate(-1)}>
            Назад
          </Button>
          <Button size="sm" className="min-h-11 text-[12px]" onClick={() => navigate("/")}>
            На стартовый экран роли
          </Button>
        </div>
      </div>
    </div>
  );
}
