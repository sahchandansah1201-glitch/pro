// Карта прав доступа к маршрутам.
// Frontend route visibility only, NOT a security boundary.
// Рабочий контроль доступа выполняется backend RBAC; этот список нужен для
// навигации и раннего redirect в клиентском shell.

import { ALL_ROLES, type Role } from "@/lib/roles";

const CLINICAL: Role[] = ["doctor", "assistant", "private_doctor"];
const ADMIN_ZONE: Role[] = ["system_admin", "clinic_admin", "private_doctor"];

/**
 * Карта prefix → разрешённые роли.
 * Префикс матчится началом pathname. Более длинные префиксы имеют приоритет.
 */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/login": ALL_ROLES,
  "/help": ALL_ROLES,

  // Клиническая зона врача / ассистента
  "/practice": ["private_doctor"],
  "/desk": ["doctor", "private_doctor"],
  "/cockpit": ["doctor", "private_doctor"],
  "/reports": ["doctor", "private_doctor"],
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

  // Запись через встроенный помощник пациента
  "/bot-sim/miniapp": ["patient"],

  // Симулятор помощника записи — для проверки сценариев
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
