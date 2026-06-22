// Роли продукта. В MVP это UX-симуляция доступа, не настоящая безопасность.
// Реальная авторизация появится с подключением Lovable Cloud.

export type Role =
  | "doctor"
  | "assistant"
  | "clinic_admin"
  | "private_doctor"
  | "patient"
  | "operator"
  | "system_admin";

export interface RoleMeta {
  id: Role;
  label: string;
  short: string;
  description: string;
  /** Стартовый маршрут роли — куда редиректит "/". */
  home: string;
}

export const ROLES: RoleMeta[] = [
  { id: "doctor",         label: "Дерматолог",                short: "Врач",          description: "Визиты, дерматоскопия, заключение.", home: "/desk" },
  { id: "assistant",      label: "Ассистент",                 short: "Ассистент",     description: "Съёмка и контроль качества фото.",  home: "/capture" },
  { id: "clinic_admin",   label: "Администратор клиники",     short: "Админ клиники", description: "Клиника, сотрудники, услуги и запись.", home: "/admin" },
  { id: "private_doctor", label: "Частный врач",              short: "Частный врач",  description: "Приём пациентов и управление своим кабинетом.", home: "/practice" },
  { id: "patient",        label: "Пациент",                   short: "Пациент",       description: "Портал пациента, отчёты, напоминания.", home: "/me" },
  { id: "operator",       label: "Оператор поддержки",        short: "Оператор",      description: "Диалоги бота, эскалация к врачу.",  home: "/operator" },
  { id: "system_admin",   label: "Системный администратор",   short: "Сисадмин",      description: "Клиники, кабинеты, сотрудники и аудит.", home: "/admin/clinics" },
];

export const ROLE_BY_ID: Record<Role, RoleMeta> = ROLES.reduce(
  (acc, r) => ({ ...acc, [r.id]: r }),
  {} as Record<Role, RoleMeta>,
);

export const ALL_ROLES: Role[] = ROLES.map((r) => r.id);
