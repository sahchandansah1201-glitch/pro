import { useRole } from "@/context/RoleContext";
import { ROLES, type Role } from "@/lib/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCog } from "lucide-react";

/**
 * Демо-переключатель роли. UX-симуляция, не настоящая авторизация.
 * Используется только для демонстрации интерфейса разных ролей.
 */
export function RoleSwitcher() {
  const { role, setRole, label, currentUser } = useRole();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserCog className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger
          className="h-8 w-[160px] text-[12px] sm:w-[220px]"
          aria-label="Демо-режим. Доступ не является реальной защитой. Сменить роль/пользователя."
          title={`Демо-режим. ${currentUser.fullName} · ${label}`}
        >
          {/* Кастомный value, чтобы не наследовать многострочный SelectItem и не обрезаться */}
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
    </div>
  );
}
