import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { useListPagination } from "@/lib/use-list-pagination";
import { formatDateTime } from "@/lib/format";
import {
  adminApiErrorText,
  listAdminAuditEvents,
  type AdminAuditEventDTO,
} from "@/lib/self-hosted-admin-api";
import {
  clearSelfHostedApiSession,
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

type ProductionFilterKey = "all" | "clinics" | "staff" | "devices" | "auth" | "other";
const PRODUCTION_FILTERS: { key: ProductionFilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "clinics", label: "Клиники" },
  { key: "staff", label: "Сотрудники" },
  { key: "devices", label: "Устройства" },
  { key: "auth", label: "Входы" },
  { key: "other", label: "Другие события" },
];

const PRODUCTION_ACTION_LABEL: Record<string, string> = {
  "admin.clinics.list": "Просмотр клиник",
  "admin.clinic.create": "Клиника создана",
  "admin.clinic.update": "Клиника изменена",
  "admin.clinic.status.update": "Статус клиники изменён",
  "admin.clinic.delete.empty": "Пустая запись клиники удалена",
  "admin.private_practice.create": "Частный кабинет создан",
  "admin.users.list": "Просмотр сотрудников",
  "admin.user.create": "Сотрудник создан",
  "admin.user.role.assign": "Роль назначена",
  "admin.user.disable": "Доступ сотрудника отключён",
  "admin.user.reactivate": "Доступ сотрудника возвращён",
  "admin.user.role.status.update": "Статус роли изменён",
  "admin.doctors.list": "Просмотр врачей",
  "admin.analytics.read": "Просмотр аналитики",
  "admin.audit.list": "Просмотр журнала аудита",
  "clinic_booking_request.list": "Просмотр обращений на запись",
  "clinic_booking_request.read": "Карточка обращения открыта",
  "clinic_booking_request.update": "Заметка обращения сохранена",
  "clinic_booking_request.book_from_slot": "Обращение записано на приём",
  "auth.login": "Вход в систему",
};

const PRODUCTION_ENTITY_LABEL: Record<string, string> = {
  admin_user: "сотрудники",
  analytics: "аналитика",
  audit: "аудит",
  clinic: "клиники и кабинеты",
  device: "устройства",
  patient: "пациенты",
  visit: "визиты",
  report: "отчёты",
  patient_portal_booking_request: "обращения на запись",
};

function productionActionLabel(action: string): string {
  return PRODUCTION_ACTION_LABEL[action] ?? "Системное действие";
}

function productionEntityLabel(entityType: string): string {
  return PRODUCTION_ENTITY_LABEL[entityType] ?? "раздел системы";
}

function productionBucket(entityType: string, action: string): ProductionFilterKey {
  if (action.startsWith("auth.")) return "auth";
  if (entityType === "clinic") return "clinics";
  if (entityType === "admin_user") return "staff";
  if (entityType === "device") return "devices";
  return "other";
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildAuditCsv(rows: AdminAuditEventDTO[]): string {
  const header = ["Когда", "Участник", "Клиника", "Действие", "Раздел", "Код объекта"];
  const body = rows.map((event) => [
    formatDateTime(event.createdAt),
    event.actorName || "система",
    event.clinicName || "все клиники",
    productionActionLabel(event.action),
    productionEntityLabel(event.entityType),
    "скрыт",
  ]);
  return [header, ...body].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function SysAuditPageLive() {
  const session = useSelfHostedApiSession();
  const configured = isSelfHostedApiConfigured(session);
  const [events, setEvents] = useState<AdminAuditEventDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState<ProductionFilterKey>("all");
  const [query, setQuery] = useState("");
  const [integrity, setIntegrity] = useState<null | { total: number; actors: number; entities: number }>(null);

  const loadEvents = useCallback(async () => {
    if (!configured) {
      setError("Войдите в рабочую систему, чтобы открыть журнал аудита.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await listAdminAuditEvents({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    });
    setLoading(false);
    if (!result.ok) {
      setError(adminApiErrorText(result.error));
      return;
    }
    setEvents(result.value);
    setStatus(`Журнал обновлён: ${result.value.length} событий.`);
  }, [configured, session.apiBaseUrl, session.apiToken]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      if (filter !== "all" && productionBucket(event.entityType, event.action) !== filter) return false;
      if (!q) return true;
      return [
        productionActionLabel(event.action),
        productionEntityLabel(event.entityType),
        event.actorName || "",
        event.clinicName || "",
      ].join(" ").toLowerCase().includes(q);
    });
  }, [events, filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 5,
    desktopPageSize: 10,
    deps: [filter, query],
  });

  const visible = pagination.visible;

  const checkIntegrity = () => {
    setIntegrity({
      total: events.length,
      actors: new Set(events.map((event) => event.actorName || "система")).size,
      entities: new Set(events.map((event) => event.entityType)).size,
    });
  };

  const exportRows = () => {
    if (rows.length === 0) {
      setStatus("Нет событий для выгрузки.");
      return;
    }
    downloadTextFile(`audit-events-${new Date().toISOString().slice(0, 10)}.csv`, buildAuditCsv(rows));
    setStatus(`Табличный журнал готов: ${rows.length} событий.`);
  };

  const sessionExpired = /Сессия истекла/i.test(error);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Аудит" subtitle="Рабочий журнал действий и проверка целостности." />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
        >
          Рабочий режим: журнал читается из базы сервера. Коды объектов, служебные данные и защищённые поля скрыты.
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Фильтр аудита" className="flex flex-wrap gap-1">
              {PRODUCTION_FILTERS.map((f) => {
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
            <label className="relative block w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по действию, разделу или клинике"
                aria-label="Поиск аудита"
                className="h-11 pl-7 text-[12px] sm:h-9"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px] sm:min-h-[32px]" onClick={loadEvents} disabled={loading || !configured}>
              {loading ? "Обновляем..." : "Обновить журнал"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px] sm:min-h-[32px]" onClick={checkIntegrity} disabled={!events.length}>
              Проверить целостность
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px] sm:min-h-[32px]" onClick={exportRows} disabled={!rows.length}>
              Скачать журнал
            </Button>
          </div>
        </Card>

        {error && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
            {error}
            {sessionExpired && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-2 min-h-[44px] sm:min-h-[32px]"
                onClick={() => {
                  clearSelfHostedApiSession();
                  window.location.assign("/self-hosted/login");
                }}
              >
                Войти заново
              </Button>
            )}
          </div>
        )}

        {status && !error && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {status}
          </div>
        )}

        {integrity && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            Целостность: записей {integrity.total} · участников {integrity.actors} · разделов {integrity.entities}. Защищённые данные не выводились.
          </div>
        )}

        {rows.length === 0 && !loading && !error && (
          <Card className="p-4 text-[13px] text-muted-foreground">
            События не найдены. Измените фильтр или обновите журнал.
          </Card>
        )}

        {rows.length > 0 && (
          <>
            <Card className="hidden p-0 md:block">
              <table className="w-full text-[12px]">
                <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Когда</th>
                    <th className="px-3 py-2">Участник</th>
                    <th className="px-3 py-2">Клиника</th>
                    <th className="px-3 py-2">Действие</th>
                    <th className="px-3 py-2">Раздел</th>
                    <th className="px-3 py-2">Код объекта</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((event) => (
                    <tr key={event.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{formatDateTime(event.createdAt)}</td>
                      <td className="px-3 py-2">{event.actorName || "система"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{event.clinicName || "все клиники"}</td>
                      <td className="px-3 py-2">{productionActionLabel(event.action)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{productionEntityLabel(event.entityType)}</td>
                      <td className="px-3 py-2 text-muted-foreground">скрыт</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="grid grid-cols-1 gap-2 md:hidden">
              {visible.map((event) => (
                <Card key={event.id} className="p-3">
                  <div className="text-[12px] font-medium">{productionActionLabel(event.action)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {event.actorName || "система"} · {formatDateTime(event.createdAt)}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                    <dt className="text-muted-foreground">Клиника</dt>
                    <dd className="text-right">{event.clinicName || "все клиники"}</dd>
                    <dt className="text-muted-foreground">Раздел</dt>
                    <dd className="text-right">{productionEntityLabel(event.entityType)}</dd>
                    <dt className="text-muted-foreground">Код объекта</dt>
                    <dd className="text-right">скрыт</dd>
                  </dl>
                </Card>
              ))}
            </div>
          </>
        )}

        <ListPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          rangeLabel={pagination.rangeLabel}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPageChange={pagination.setPage}
          itemNoun="событий"
        />
      </div>
    </div>
  );
}

export default function SysAuditPage() {
  const session = useSelfHostedApiSession();
  return <SysAuditPageLive key={session.revision} />;
}
