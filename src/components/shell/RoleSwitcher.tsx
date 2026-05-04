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
  const { role, setRole } = useRole();

  return (
    <div className="flex items-center gap-2">
      <UserCog className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger className="h-8 w-[220px] text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.id} value={r.id} className="text-[13px]">
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
