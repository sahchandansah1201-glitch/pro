// UX-only for demo role access; the real-session gate added in Stage 1H-A
// is the only auth-aware piece here.
//
// RoleGuard показывает аккуратный экран "Нет доступа в демо-режиме",
// если активная демо-роль не имеет права на маршрут. Это UX-симуляция.
//
// Stage 1H-A: когда Lovable Cloud сконфигурирован, неаутентифицированных
// пользователей редиректим на /login до проверки демо-роли. Когда Cloud
// не сконфигурирован — поведение прежнее, чисто демо.

import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";

import { useRole } from "@/context/role-context";
import { useAuth } from "@/context/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { canRoleAccess } from "@/lib/access";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const { role, setRole, label } = useRole();
  const { status } = useAuth();
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

function AuthLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full items-center justify-center p-6"
    >
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span>Проверяем сессию…</span>
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
          <div className="text-[13px] font-semibold">Нет доступа в демо-режиме</div>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Текущая роль <span className="text-foreground">{currentLabel}</span> не входит в
          число ролей, для которых открыт этот раздел. Это UX-симуляция, не настоящая
          защита — переключите демо-роль, чтобы увидеть интерфейс.
        </p>

        <div className="mt-4 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Сменить демо-роль
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <Button
                key={r.id}
                variant="outline"
                size="sm"
                className="h-7 text-[12px]"
                onClick={() => onSwitchRole(r.id)}
              >
                {r.short}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" className="h-8 text-[12px]" onClick={() => navigate(-1)}>
            Назад
          </Button>
          <Button size="sm" className="h-8 text-[12px]" onClick={() => navigate("/")}>
            На стартовый экран роли
          </Button>
        </div>
      </div>
    </div>
  );
}
