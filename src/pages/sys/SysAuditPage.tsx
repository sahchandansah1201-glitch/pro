import { useMemo, useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { useListPagination } from "@/lib/use-list-pagination";
import { getAuditLogs } from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";
import { ROLE_BY_ID } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";

/**
 * Sys Audit — журнал действий (MVP, демо).
 * SAFETY: только action / entity / id / безопасный summary.
 * Без имён пациентов, фото, текстов отчётов, токенов, AI-метаданных.
 */

const DEMO_BANNER =
  "Учебный режим. Рабочие роли, аудит, ключи и мост устройств включаются после подключения системы клиники.";

const ACTOR_LABEL = new Map<string, string>(
  Object.values(DEMO_USERS).map((u) => [
    u.id,
    u.role === "patient" ? "Учебный пациент" : `${u.fullName.split(" ")[0]} · ${ROLE_BY_ID[u.role].short}`,
  ]),
);

// Безопасные ключи payload для рендера. Всё остальное скрываем.
const SAFE_PAYLOAD_KEYS = new Set([
  "clinicId", "kind", "deviceId", "channel", "source", "status",
  "to", "reason", "model", "durationMin", "expiresInDays",
]);

function safeSummary(payload: Record<string, string | number | boolean | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (!SAFE_PAYLOAD_KEYS.has(k)) continue;
    if (v === null) continue;
    if (k === "clinicId") parts.push("клиника скрыта");
    if (k === "deviceId") parts.push("устройство скрыто");
    if (k === "kind") parts.push(`тип снимка: ${imageKindLabel(String(v))}`);
    if (k === "channel") parts.push(`канал: ${channelLabel(String(v))}`);
    if (k === "source") parts.push(`источник: ${sourceLabel(String(v))}`);
    if (k === "status") parts.push(`статус: ${statusValueLabel(String(v))}`);
    if (k === "to") parts.push(`новый статус: ${statusValueLabel(String(v))}`);
    if (k === "reason") parts.push(`причина: ${reasonLabel(String(v))}`);
    if (k === "model") parts.push("модель устройства указана");
    if (k === "durationMin") parts.push(`длительность: ${String(v)} мин`);
    if (k === "expiresInDays") parts.push(`срок: ${String(v)} дн.`);
  }
  return parts.length === 0 ? "—" : parts.join(" · ");
}

const ACTION_LABEL: Record<string, string> = {
  "visit.open": "Открыт визит",
  "visit.close": "Закрыт визит",
  "image.capture": "Снимок добавлен",
  "image.delete": "Снимок удалён",
  "report.create": "Отчёт создан",
  "report.publish": "Отчёт опубликован",
  "assessment.update": "Оценка обновлена",
  "lesion.update": "Очаг обновлён",
  "device.connect": "Устройство подключено",
  "device.disconnect": "Устройство отключено",
  "integration.sync": "Интеграция синхронизирована",
  "lead.create": "Заявка создана",
  "lead.update": "Заявка обновлена",
  "bot_dialog.handoff": "Обращение передано оператору",
  "appointment.create": "Запись создана",
};

const ENTITY_LABEL: Record<string, string> = {
  visit: "визит",
  assessment: "оценка",
  lesion: "очаг",
  image: "снимок",
  report: "отчёт",
  device: "устройство",
  integration: "интеграция",
  lead: "заявка",
  bot_dialog: "обращение",
  appointment: "запись",
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? "Системное действие";
}

function entityLabel(entity: string): string {
  return ENTITY_LABEL[entity] ?? "объект";
}

function imageKindLabel(value: string): string {
  if (value === "dermoscopy") return "дерматоскопия";
  if (value === "macro") return "обзорный снимок";
  return "снимок";
}

function channelLabel(value: string): string {
  if (value === "web") return "сайт";
  if (value === "telegram") return "Telegram";
  if (value === "whatsapp") return "WhatsApp";
  return "канал обращения";
}

function sourceLabel(value: string): string {
  if (value === "api") return "рабочая система";
  if (value === "demo") return "учебные данные";
  return "система";
}

function statusValueLabel(value: string): string {
  if (value === "draft") return "черновик";
  if (value === "published") return "опубликовано";
  if (value === "done") return "готово";
  if (value === "pending") return "ожидает";
  if (value === "cancelled") return "отменено";
  return "обновлён";
}

function reasonLabel(value: string): string {
  if (value === "manual") return "ручное действие";
  if (value === "system") return "системное действие";
  return "указана";
}

type FilterKey = "all" | "visits" | "reports" | "devices" | "integrations" | "leads_dialogs";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "visits", label: "Визиты" },
  { key: "reports", label: "Отчёты" },
  { key: "devices", label: "Устройства" },
  { key: "integrations", label: "Интеграции" },
  { key: "leads_dialogs", label: "Лиды и диалоги" },
];

const ENTITY_BUCKET: Record<string, FilterKey> = {
  visit: "visits",
  assessment: "visits",
  lesion: "visits",
  image: "visits",
  report: "reports",
  device: "devices",
  integration: "integrations",
  lead: "leads_dialogs",
  bot_dialog: "leads_dialogs",
  appointment: "leads_dialogs",
};

export default function SysAuditPage() {
  const logs = getAuditLogs();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [integrity, setIntegrity] = useState<null | {
    total: number;
    actors: number;
    entities: number;
  }>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (filter !== "all" && ENTITY_BUCKET[l.entity] !== filter) return false;
      if (q && !`${l.action} ${l.entity} ${l.entityId}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 5,
    desktopPageSize: 10,
    deps: [filter, query],
  });
  const visible = pagination.visible;

  const checkIntegrity = () => {
    const total = logs.length;
    const actors = new Set(logs.map((l) => l.actorId)).size;
    const entities = new Set(logs.map((l) => l.entity)).size;
    setIntegrity({ total, actors, entities });
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Аудит" subtitle="Журнал действий, проверка целостности." />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{DEMO_BANNER}</span>
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Фильтр аудита" className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.key)}
                    className={`min-h-[44px] rounded-md border px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[32px] ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-foreground hover:bg-muted"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <label className="relative block w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по действию или разделу"
                aria-label="Поиск аудита"
                className="h-11 pl-7 text-[12px] sm:h-9"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-9 min-h-[44px] sm:min-h-[32px]"
              onClick={checkIntegrity}
            >
              Проверить целостность (демо)
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled
              aria-disabled="true"
              title="Экспорт появится после подключения системы клиники"
              className="h-9 min-h-[44px] sm:min-h-[32px]"
            >
              Экспорт отключён
            </Button>
          </div>
        </Card>

        {integrity && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
          >
            Целостность: записей {integrity.total} · участников {integrity.actors} · разделов {integrity.entities}.
            Без сетевых вызовов и экспорта.
          </div>
        )}

        {/* Desktop */}
        <Card className="hidden p-0 md:block">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Когда</th>
                <th className="px-3 py-2">Участник</th>
                <th className="px-3 py-2">Действие</th>
                <th className="px-3 py-2">Раздел</th>
                <th className="px-3 py-2">Код объекта</th>
                <th className="px-3 py-2">Контекст</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                  <td className="px-3 py-2">{ACTOR_LABEL.get(l.actorId) ?? l.actorId}</td>
                  <td className="px-3 py-2">{actionLabel(l.action)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{entityLabel(l.entity)}</td>
                  <td className="px-3 py-2 text-muted-foreground">скрыт</td>
                  <td className="px-3 py-2 text-muted-foreground">{safeSummary(l.payload)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Mobile */}
        <div className="grid grid-cols-1 gap-2 md:hidden">
          {visible.map((l) => (
            <Card key={l.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium">{actionLabel(l.action)}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {ACTOR_LABEL.get(l.actorId) ?? l.actorId} · {formatDateTime(l.createdAt)}
                  </div>
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <dt className="text-muted-foreground">Раздел</dt>
                <dd className="text-right">{entityLabel(l.entity)}</dd>
                <dt className="text-muted-foreground">Код объекта</dt>
                <dd className="text-right">скрыт</dd>
                <dt className="text-muted-foreground">Контекст</dt>
                <dd className="text-right">{safeSummary(l.payload)}</dd>
              </dl>
            </Card>
          ))}
        </div>

        <ListPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          rangeLabel={pagination.rangeLabel}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPageChange={pagination.setPage}
          itemNoun="записей"
        />
      </div>
    </div>
  );
}
