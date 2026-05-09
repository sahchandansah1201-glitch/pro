import { useNavigate } from "react-router-dom";
import { useRole } from "@/context/role-context";
import { useAuth } from "@/context/use-auth";
import { ROLES, type Role } from "@/lib/roles";
import { ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserCog, LogOut } from "lucide-react";

/**
 * Демо-переключатель роли. UX-симуляция, не настоящая авторизация.
 * Используется только для демонстрации интерфейса разных ролей.
 *
 * Stage 1G-C: при наличии аутентифицированной сессии Lovable Cloud рядом
 * показывается кнопка «Выйти», которая завершает реальную сессию.
 */
export function RoleSwitcher() {
  const { role, setRole, label, currentUser } = useRole();
  const { status, signOut, user } = useAuth();
  const navigate = useNavigate();

  const showLogout = status === "authenticated";
  const showSession = status === "authenticated";
  const sessionEmail = user?.email ?? null;

  const handleLogout = async () => {
    await signOut();
    setRole("doctor");
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserCog className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger
          className="h-8 w-[160px] text-[12px] sm:w-[220px]"
          aria-label="Демо-режим. Доступ не является реальной защитой. Сменить роль/пользователя."
          title={`Демо-режим. ${currentUser.fullName} · ${label}`}
        >
          <SelectValue>
            <span className="block truncate">{label}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
            Демо-режим. Доступ не является реальной защитой.
          </div>
          {ROLES.map((r) => (
            <SelectItem key={r.id} value={r.id} className="text-[12px]">
              <div className="flex flex-col">
                <span>{r.label}</span>
                <span className="text-[11px] text-muted-foreground">{r.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showLogout ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[12px]"
          onClick={handleLogout}
          aria-label="Выйти из аккаунта"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Выйти</span>
        </Button>
      ) : null}
    </div>
  );
}
