import { formatCardNumber } from "@/lib/card-number";
import type { AccessEventSource } from "@/lib/admin-access-events";
import type { AdminAuditEventDTO } from "@/lib/self-hosted-admin-api";
import type { Tables } from "@/integrations/supabase/types";

export type FilterKey = "all" | "clinical" | "admin" | "integrations" | "devices";
export type SourceFilter = "all" | AccessEventSource;
export type AccessEventsViewRow = Tables<"access_events_admin">;

export interface AccessEventRow {
  id: string;
  createdAt: string;
  clinicName: string;
  actorLabel: string;
  action: string;
  entity: string;
  entityId: string | null;
  patientCode: string | null;
  visitId: string | null;
  lesionLabel: string | null;
  source: AccessEventSource;
}

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "clinical", label: "Клиника" },
  { key: "admin", label: "Администрирование" },
  { key: "integrations", label: "Интеграции" },
  { key: "devices", label: "Устройства" },
];

export const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "Все источники" },
  { key: "api", label: "Рабочая система" },
  { key: "demo", label: "Учебные данные" },
];

const ENTITY_BUCKET: Record<string, FilterKey> = {
  visit: "clinical",
  image: "clinical",
  assessment: "clinical",
  lesion: "clinical",
  report: "clinical",
  appointment: "admin",
  lead: "admin",
  bot_dialog: "admin",
  admin_user: "admin",
  admin_clinic: "admin",
  admin_audit: "admin",
  admin_analytics: "admin",
  system: "admin",
  integration: "integrations",
  device: "devices",
};

const ENTITY_LABEL: Record<string, string> = {
  visit: "визит",
  image: "снимок",
  assessment: "оценка",
  lesion: "очаг",
  report: "отчёт",
  appointment: "запись",
  lead: "заявка",
  bot_dialog: "обращение",
  admin_user: "сотрудник",
  admin_clinic: "клиника",
  admin_audit: "аудит",
  admin_analytics: "аналитика",
  system: "система",
  integration: "интеграция",
  device: "устройство",
};

const ACTION_LABEL: Record<string, string> = {
  "visit.open": "Открыт визит",
  "visit.close": "Закрыт визит",
  "image.capture": "Добавлен снимок",
  "image.delete": "Удалён снимок",
  "assessment.update": "Оценка обновлена",
  "assessment.submit": "Оценка отправлена",
  "lesion.update": "Данные очага обновлены",
  "report.publish": "Отчёт опубликован",
  "report.share": "Отчёт открыт по ссылке",
  "report.generate": "Отчёт сформирован",
  "lead.create": "Заявка создана",
  "lead.update": "Заявка обновлена",
  "bot_dialog.handoff": "Обращение передано",
  "dialog.escalate": "Обращение передано специалисту",
  "appointment.create": "Запись создана",
  "appointment.book": "Запись на приём создана",
  "admin.user.create": "Сотрудник создан",
  "admin.user.role.assign": "Роль назначена",
  "admin.user.disable": "Доступ сотрудника отключён",
  "admin.user.reactivate": "Доступ сотрудника восстановлен",
  "admin.user.role.disable": "Роль сотрудника отключена",
  "admin.user.role.reactivate": "Роль сотрудника восстановлена",
  "admin.clinic.create": "Клиника создана",
  "admin.clinic.update": "Клиника обновлена",
  "admin.clinic.status": "Статус клиники изменён",
  "admin.clinic.delete": "Запись клиники удалена",
  "admin.private_practice.create": "Частный кабинет создан",
  "admin.analytics.list": "Аналитика открыта",
  "admin.audit.list": "Журнал аудита открыт",
  "device.connect": "Устройство подключено",
  "device.register": "Устройство зарегистрировано",
  "integration.sync": "Интеграция обновлена",
  "integration.update": "Интеграция обновлена",
};

export function entityBucket(entity: string): FilterKey {
  return ENTITY_BUCKET[entity] ?? "admin";
}

export function entityLabel(entity: string): string {
  return ENTITY_LABEL[entity] ?? "объект";
}

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? "Системное действие";
}

export function sourceLabel(source: AccessEventSource): string {
  return source === "api" ? "Рабочая система" : "Учебные данные";
}

export function fromViewRow(row: AccessEventsViewRow): AccessEventRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    clinicName: row.clinic_name,
    actorLabel: row.actor_full_name ?? row.actor_id ?? "Системное событие",
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    patientCode: row.patient_code,
    visitId: row.visit_id,
    lesionLabel: row.lesion_label,
    source: "api",
  };
}

export function fromAdminAuditEvent(event: AdminAuditEventDTO): AccessEventRow {
  return {
    id: event.id,
    createdAt: event.createdAt ?? "",
    clinicName: event.clinicName ?? "Все клиники",
    actorLabel: event.actorName ?? "Системное событие",
    action: event.action,
    entity: event.entityType,
    entityId: null,
    patientCode: null,
    visitId: null,
    lesionLabel: null,
    source: "api",
  };
}

export function contextLabel(row: AccessEventRow): string {
  const parts = [];
  if (row.visitId) parts.push("визит: код скрыт");
  if (row.lesionLabel) parts.push(`очаг ${row.lesionLabel}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function rowDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function filterLabel(
  filter: FilterKey,
  sourceFilter: SourceFilter,
  entityFilter: string,
  clinicFilter: string,
  actorFilter: string,
  actionFilter: string,
  patientCodeFilter: string,
  dateFrom: string,
  dateTo: string,
): string {
  const parts = [
    FILTERS.find((f) => f.key === filter)?.label ?? "Все",
    SOURCE_FILTERS.find((f) => f.key === sourceFilter)?.label ?? "Все источники",
  ];
  if (entityFilter !== "all") parts.push(`объект: ${entityLabel(entityFilter)}`);
  if (clinicFilter !== "all") parts.push(`клиника: ${clinicFilter}`);
  if (actorFilter !== "all") parts.push(`роль: ${actorFilter}`);
  if (actionFilter !== "all") parts.push(`действие: ${actionLabel(actionFilter)}`);
  if (patientCodeFilter.trim()) parts.push(`номер карты: ${formatCardNumber(patientCodeFilter.trim())}`);
  if (dateFrom) parts.push(`с ${dateFrom}`);
  if (dateTo) parts.push(`по ${dateTo}`);
  return parts.join(" · ");
}
