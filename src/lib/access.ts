// Карта прав доступа к маршрутам.
// UX-only, NOT a security boundary.
// Этот список используется RoleGuard'ом и сайдбаром только для демонстрации
// разделения ролей. Реальный контроль доступа появится с бэкендом.

import { ALL_ROLES, type Role } from "@/lib/roles";

const CLINICAL: Role[] = ["doctor", "assistant", "private_doctor"];
const ADMIN_ZONE: Role[] = ["clinic_admin", "private_doctor"];

/**
 * Карта prefix → разрешённые роли.
 * Префикс матчится началом pathname. Более длинные префиксы имеют приоритет.
 */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/login": ALL_ROLES,
  "/help": ALL_ROLES,

  // Клиническая зона врача / ассистента
  "/desk": ["doctor", "private_doctor"],
  "/visits": ["doctor", "private_doctor", "clinic_admin"],
  "/patients": [...CLINICAL, "clinic_admin"],
  "/capture": ["assistant", "doctor", "private_doctor"],

  // Зона администратора клиники
  "/admin": ADMIN_ZONE,

  // Зона оператора поддержки
  "/operator": ["operator", "clinic_admin"],

  // Зона системного администратора
  "/sys": ["system_admin"],

  // Портал пациента
  "/me": ["patient"],

  // Защищённая ссылка-результат — открывает любая роль (по токену)
  "/analysis": ALL_ROLES,

  // Симулятор бота — для всех демо-ролей
  "/bot-sim": ALL_ROLES,
};

/** Возвращает список разрешённых ролей для маршрута. По умолчанию — все. */
export function rolesForPath(pathname: string): Role[] {
  const match = Object.keys(ROUTE_ACCESS)
    .filter((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_ACCESS[match] : ALL_ROLES;
}

export function canRoleAccess(role: Role, pathname: string): boolean {
  return rolesForPath(pathname).includes(role);
}
