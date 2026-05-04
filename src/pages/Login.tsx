import { useNavigate } from "react-router-dom";
import { Stethoscope, ShieldAlert } from "lucide-react";

import { useRole } from "@/context/RoleContext";
import { ROLES, ROLE_BY_ID, type Role } from "@/lib/roles";
import { DEMO_USERS } from "@/lib/users";
import { Button } from "@/components/ui/button";

/**
 * Демо-логин с выбором роли/пользователя. UX-симуляция, не настоящая авторизация.
 * Реальный auth появится при подключении Lovable Cloud.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { setRole } = useRole();

  const pick = (r: Role) => {
    // setRole сохраняет роль в localStorage и синхронизирует currentUser.
    setRole(r);
    navigate(ROLE_BY_ID[r].home, { replace: true });
  };

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
          <span>Демо-режим. Доступ не является реальной защитой.</span>
        </div>

        <div className="text-[12px] uppercase tracking-wide text-muted-foreground">
          Войти как
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <Button
              key={r.id}
              variant="outline"
              className="h-auto justify-start py-2 text-left"
              onClick={() => pick(r.id)}
            >
              <div className="flex flex-col">
                <span className="text-[13px] font-medium">{r.label}</span>
                <span className="text-[11px] text-muted-foreground">{r.description}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
