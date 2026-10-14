// Route visibility only. Each backend must enforce authorization independently.
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";

import { useAuth } from "@/context/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { canRoleAccess } from "@/lib/access";
import { ROLE_BY_ID } from "@/lib/roles";
import { roleFromAuthUser } from "@/lib/auth-role";
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
  const { status, user, accessToken, signOut } = useAuth();
  const selfHostedSession = useSelfHostedApiSession();

  const configured = isSupabaseConfigured();
  if (isSelfHostedApiConfigured(selfHostedSession) || !configured) {
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
        authLoading={status === "loading"}
        onSignOut={status === "authenticated" && accessToken ? signOut : undefined}
      />
    );
  }

  if (configured) {
    if (status === "loading") return <AuthLoadingScreen />;
    if (status === "anonymous" || !accessToken) {
      const from = `${pathname}${search}${hash}`;
      return <Navigate to="/login" replace state={{ from }} />;
    }
  }

  const role = roleFromAuthUser(user);
  if (role && canRoleAccess(role, pathname)) return <>{children}</>;

  return <ProductionNoAccessScreen
    roleLabel={role ? ROLE_BY_ID[role].label : "роль не назначена"}
    clinicalRoute={isClinicalRoute(pathname)}
    homePath={role ? ROLE_BY_ID[role].home : "/"}
    loginPath="/login"
    onSignOut={signOut}
  />;
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
  loginPath = "/self-hosted/login",
  onSignOut,
  authLoading = false,
}: {
  roleLabel: string;
  clinicalRoute: boolean;
  homePath: string;
  loginPath?: string;
  onSignOut?: () => Promise<{ error: Error | null }>;
  authLoading?: boolean;
}) {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function switchAccount() {
    if (leaving || authLoading) return;
    setLeaving(true);
    try {
      if (onSignOut) {
        const { error } = await onSignOut();
        if (error) throw error;
      }
      clearSelfHostedApiSession();
      navigate(loginPath);
    } catch {
      setLogoutError("Не удалось выйти. Попробуйте ещё раз.");
    } finally {
      setLeaving(false);
    }
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

        {logoutError && <p role="alert" className="text-[12px] text-destructive">{logoutError}</p>}
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
                onClick={() => { void switchAccount(); }}
                disabled={leaving || authLoading}
              >
                Войти под другой учётной записью
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" className="min-h-11 text-[12px]" onClick={() => navigate(-1)}>
                Назад
              </Button>
              <Button size="sm" className="min-h-11 text-[12px]" onClick={() => { void switchAccount(); }} disabled={leaving || authLoading}>
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
