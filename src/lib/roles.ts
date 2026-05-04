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
}

export const ROLES: RoleMeta[] = [
  { id: "doctor", label: "Дерматолог", short: "Врач", description: "Визиты, дерматоскопия, заключение." },
  { id: "assistant", label: "Ассистент", short: "Ассистент", description: "Съёмка и контроль качества фото." },
  { id: "clinic_admin", label: "Администратор клиники", short: "Админ клиники", description: "Расписание, услуги, лиды, интеграции." },
  { id: "private_doctor", label: "Частный врач", short: "Частный врач", description: "Упрощённый режим врач + админ." },
  { id: "patient", label: "Пациент", short: "Пациент", description: "Портал пациента, отчёты, напоминания." },
  { id: "operator", label: "Оператор поддержки", short: "Оператор", description: "Диалоги бота, эскалация к врачу." },
  { id: "system_admin", label: "Системный администратор", short: "Сисадмин", description: "Пользователи, устройства, аудит." },
];

export const ROLE_BY_ID: Record<Role, RoleMeta> = ROLES.reduce(
  (acc, r) => ({ ...acc, [r.id]: r }),
  {} as Record<Role, RoleMeta>,
);
