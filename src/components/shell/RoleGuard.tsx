// UX-only, NOT a security boundary.
// RoleGuard показывает аккуратный экран "Нет доступа в демо-режиме",
// если активная демо-роль не имеет права на маршрут.
// Это исключительно UX-симуляция для демонстрации разных ролевых зон.
// Реальная авторизация и RLS появятся при подключении Lovable Cloud.

import { useLocation } from "react-router-dom";
import { Lock } from "lucide-react";

import { useRole } from "@/context/RoleContext";
import { canRoleAccess } from "@/lib/access";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { role, setRole, label } = useRole();

  if (canRoleAccess(role, pathname)) return <>{children}</>;

  return <NoAccessScreen currentLabel={label} onSwitchRole={setRole} />;
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
