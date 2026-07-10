import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, ServerCog } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCardNumber } from "@/lib/card-number";
import { formatDateTime } from "@/lib/format";
import {
  bookSelfHostedClinicBookingRequestFromSlot,
  listSelfHostedClinicBookingRequests,
  updateSelfHostedClinicBookingRequest,
  type SelfHostedApiError,
  type SelfHostedClinicBookingRequestDTO,
  type SelfHostedClinicBookingRequestsPage,
} from "@/lib/self-hosted-clinic-booking-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import {
  getSelfHostedExternalIntakeStatus,
  listSelfHostedExternalIntakeImports,
  type SelfHostedExternalIntakeImportBatchesPage,
  type SelfHostedExternalIntakeStatusDTO,
} from "@/lib/self-hosted-external-intake-api";
import {
  listSelfHostedClinicAvailableSlots,
  type SelfHostedClinicAvailableSlotDTO,
  type SelfHostedClinicAvailableSlotsPage,
} from "@/lib/self-hosted-clinic-availability-api";
import {
  availabilitySyncStatusLabel,
  buildSelfHostedAvailabilitySyncSummary,
} from "@/lib/self-hosted-availability-sync";

const STATUS_LABEL: Record<string, string> = {
  all: "Все",
  requested: "Новые",
  reviewing: "В работе",
  booked: "Записаны",
  cancelled: "Отменены",
};

const SOURCE_SYSTEM_LABEL: Record<string, string> = {
  clinic_crm: "Система клиники",
  ads: "Рекламный источник",
  site: "Сайт",
  manual: "Ручной импорт",
  other: "Другой источник",
};

const IMPORT_BATCH_STATUS_LABEL: Record<string, string> = {
  completed: "готово",
  failed: "ошибка",
  processing: "в работе",
  pending: "ожидает",
};

const ISSUE_SEVERITY_LABEL: Record<string, string> = {
  critical: "критично",
  high: "важно",
  medium: "проверить",
  low: "заметка",
};

const EMPTY_PAGE: SelfHostedClinicBookingRequestsPage = {
  items: [],
  count: 0,
  limit: 25,
  offset: 0,
  filters: { status: "all", search: null },
};

const EMPTY_IMPORTS: SelfHostedExternalIntakeImportBatchesPage = {
  items: [],
  count: 0,
  limit: 5,
  offset: 0,
  filters: { sourceSystem: "all" },
};

const EMPTY_IMPORT_STATUS: SelfHostedExternalIntakeStatusDTO = {
  sourceSystem: "all",
  recentBatchCount: 0,
  rejectedLast24h: 0,
  duplicateLast24h: 0,
  latestImportAt: null,
  openBookingRequestCount: 0,
  availableSlotCount: 0,
  storedRawPayload: false,
  runtimeCallsExternalSystems: false,
  hardeningVersion: "stage5t",
  latestBySource: [],
};

const EMPTY_SLOTS: SelfHostedClinicAvailableSlotsPage = {
  items: [],
  count: 0,
  limit: 5,
  offset: 0,
  filters: { sourceSystem: "all", status: "available", dateFrom: null, dateTo: null },
};

type StatusFilter = "all" | "requested" | "reviewing" | "booked" | "cancelled";

export default function OperatorBookingRequestsPageLive() {
  const session = useSelfHostedApiSession();
  const [page, setPage] = useState<SelfHostedClinicBookingRequestsPage>(EMPTY_PAGE);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<SelfHostedApiError | null>(null);
  const [selected, setSelected] = useState<SelfHostedClinicBookingRequestDTO | null>(null);
  const [clinicNote, setClinicNote] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [importBatches, setImportBatches] = useState<SelfHostedExternalIntakeImportBatchesPage>(EMPTY_IMPORTS);
  const [importStatus, setImportStatus] = useState<SelfHostedExternalIntakeStatusDTO>(EMPTY_IMPORT_STATUS);
  const [availableSlots, setAvailableSlots] = useState<SelfHostedClinicAvailableSlotsPage>(EMPTY_SLOTS);
  const [actionMessage, setActionMessage] = useState("Очередь заявок готова.");

  const baseArgs = useMemo(
    () => ({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    }),
    [session.apiBaseUrl, session.apiToken],
  );
  const isConfigured = isSelfHostedApiConfigured(session);

  const loadRequests = useCallback(async () => {
    if (!isConfigured) {
      setLoadStatus("error");
      setError({
        kind: "not_configured",
        code: "not_configured",
        message: "Для очереди заявок нужен вход в систему клиники.",
      });
      return;
    }
    setLoadStatus("loading");
    const result = await listSelfHostedClinicBookingRequests({
      ...baseArgs,
      status: statusFilter,
      search,
      limit: 25,
    });
    if (result.ok && result.value) {
      setPage(result.value);
      const imports = await listSelfHostedExternalIntakeImports({
        ...baseArgs,
        limit: 5,
      });
      if (imports.ok && imports.value) setImportBatches(imports.value);
      const importStatusResult = await getSelfHostedExternalIntakeStatus({
        ...baseArgs,
      });
      if (importStatusResult.ok && importStatusResult.value) setImportStatus(importStatusResult.value);
      const slots = await listSelfHostedClinicAvailableSlots({
        ...baseArgs,
        status: "available",
        limit: 5,
      });
      if (slots.ok && slots.value) setAvailableSlots(slots.value);
      setError(null);
      setLoadStatus("ready");
      setSelected((current) => current ? result.value.items.find((item) => item.id === current.id) ?? null : null);
    } else {
      setPage(EMPTY_PAGE);
      setError(result.error);
      setLoadStatus("error");
    }
  }, [baseArgs, isConfigured, search, statusFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function chooseRequest(request: SelfHostedClinicBookingRequestDTO) {
    setSelected(request);
    setClinicNote(request.clinicNote || "");
    setSelectedSlotId("");
  }

  async function updateRequest(
    request: SelfHostedClinicBookingRequestDTO,
    status: "reviewing" | "cancelled",
    extra: { clinicNote?: string | null; assignedVisitId?: string | null } = {},
  ) {
    setBusyKey(`${status}:${request.id}`);
    const result = await updateSelfHostedClinicBookingRequest({
      ...baseArgs,
      requestId: request.id,
      payload: {
        status,
        ...extra,
      },
    });
    setBusyKey(null);
    if (result.ok && result.value) {
      setActionMessage(`Заявка: статус ${STATUS_LABEL[result.value.status] || result.value.status}.`);
      setSelected(result.value);
      setClinicNote(result.value.clinicNote || "");
      await loadRequests();
    } else {
      setActionMessage(publicBookingMessage(result.error));
    }
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await updateRequest(selected, "reviewing", {
      clinicNote,
    });
  }

  async function bookSelected() {
    if (!selected || !selectedSlotId) return;
    setBusyKey(`booked:${selected.id}`);
    const result = await bookSelfHostedClinicBookingRequestFromSlot({
      ...baseArgs,
      requestId: selected.id,
      payload: {
        slotId: selectedSlotId,
        clinicNote,
      },
    });
    setBusyKey(null);
    if (result.ok && result.value) {
      setActionMessage("Заявка записана на визит.");
      setSelected(result.value);
      setClinicNote(result.value.clinicNote || "");
      setSelectedSlotId("");
      await loadRequests();
    } else {
      setActionMessage(publicBookingMessage(result.error));
    }
  }

  const subtitle = session.user?.displayName
    ? `${session.user.displayName} · заявки на запись`
    : "Заявки на запись из системы клиники";
  const availabilitySync = useMemo(
    () =>
      buildSelfHostedAvailabilitySyncSummary({
        bookingRequests: page.items,
        availableSlots: availableSlots.items,
        importStatus,
      }),
    [availableSlots.items, importStatus, page.items],
  );

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Запросы на запись"
        subtitle={subtitle}
        actions={
          <Button asChild size="sm" variant="outline" className="min-h-[44px] text-[12px]">
            <Link to="/self-hosted/login">Вход в систему</Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-6 overflow-auto px-6 py-6">
        <section
          role="status"
          aria-live="polite"
          className="surface-card flex items-center justify-between gap-3 px-4 py-3 text-row"
        >
          <div className="flex min-w-0 items-center gap-2">
            <ServerCog className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">
              {loadStatus === "loading"
                ? "Загружаем заявки…"
                : loadStatus === "error"
                  ? "Очередь заявок недоступна."
                  : "Данные загружены из системы клиники."}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[44px] text-[12px]"
            onClick={() => void loadRequests()}
          >
            Обновить
          </Button>
        </section>

        {error && (
          <section role="alert" className="surface-card border-destructive/30 px-4 py-3 text-row text-destructive">
            {error.message}
          </section>
        )}

        <section
          className="surface-card overflow-hidden"
          aria-label="Готовность свободных окон"
        >
          <header className="section-bar">
            <h2 className="h-section">Готовность свободных окон</h2>
            <span className="h-section-hint">локальная проверка</span>
          </header>
          <div className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">
            <Kpi label="Конфликты" value={availabilitySync.issues.reduce((sum, issue) => sum + issue.count, 0)} />
            <Kpi label="Открытые заявки" value={availabilitySync.openBookingRequests} />
            <Kpi label="Доступные окна" value={availabilitySync.availableSlots} />
            <Kpi label="Кандидаты" value={availabilitySync.confirmationCandidates.length} />
          </div>
          <div className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {availabilitySyncStatusLabel(availabilitySync.status)} — {availabilitySync.nextActionLabel}
              </span>
              <span>
                Свободные окна проверяются по локальному расписанию; внешние системы с экрана не вызываются
              </span>
            </div>
          </div>
          <div className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            {availabilitySync.issues.length === 0 ? (
              "Конфликтов синхронизации не найдено."
            ) : (
              <ul className="space-y-2">
                {availabilitySync.issues.map((issue) => (
                  <li key={issue.type} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{issue.label}</span>
                    <span className="tabular-nums">
                      {ISSUE_SEVERITY_LABEL[issue.severity] || issue.severity} · {issue.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="surface-card overflow-hidden" aria-label="Статус входящих источников записи">
          <header className="section-bar">
            <h2 className="h-section">Входящие источники записи</h2>
            <span className="h-section-hint">защищённый импорт</span>
          </header>
          <div className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
            <Kpi label="Батчей" value={importBatches.count} />
            <Kpi
              label="Заявок принято"
              value={importBatches.items.reduce((sum, item) => sum + item.acceptedBookingCount, 0)}
            />
            <Kpi
              label="Окон принято"
              value={importBatches.items.reduce((sum, item) => sum + item.acceptedSlotCount, 0)}
            />
            <Kpi
              label="Отклонено"
              value={importBatches.items.reduce((sum, item) => sum + item.rejectedCount, 0)}
            />
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border lg:grid-cols-4 lg:divide-y-0">
            <Kpi label="Дубликаты 24ч" value={importStatus.duplicateLast24h} />
            <Kpi label="Ошибки 24ч" value={importStatus.rejectedLast24h} />
            <Kpi label="Открытые заявки" value={importStatus.openBookingRequestCount} />
            <Kpi label="Окна в кэше" value={importStatus.availableSlotCount} />
          </div>
          <div className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Защита импорта включена; исходные данные {importStatus.storedRawPayload ? "сохраняются" : "не сохраняются"};
                внешние вызовы {importStatus.runtimeCallsExternalSystems ? "включены" : "выключены"}
              </span>
              <span className="tabular-nums">
                Последний импорт: {importStatus.latestImportAt ? formatDateTime(importStatus.latestImportAt) : "нет данных"}
              </span>
            </div>
          </div>
          <div className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            {importBatches.items.length === 0 ? (
              "Импортов пока нет. Источники записи подключаются через защищённый входящий импорт, без прямых вызовов с экрана."
            ) : (
              <ul className="space-y-2">
                {importBatches.items.map((batch) => (
                  <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {sourceSystemLabel(batch.sourceSystem)} · {IMPORT_BATCH_STATUS_LABEL[batch.status] || batch.status}
                    </span>
                    <span className="tabular-nums">
                      {batch.acceptedBookingCount} заявок / {batch.acceptedSlotCount} окон / {batch.rejectedCount} отклонено
                      {batch.duplicateCount > 0 ? ` / ${batch.duplicateCount} дубликатов` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="surface-card overflow-hidden" aria-label="Свободные окна клиники из локального кэша">
          <header className="section-bar">
            <h2 className="h-section">Свободные окна клиники</h2>
            <span className="h-section-hint">локальный кэш</span>
          </header>
          <div className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
            <Kpi label="Окон всего" value={availableSlots.count} />
            <Kpi label="Показано" value={availableSlots.items.length} />
            <Kpi
              label="Клиника"
              value={availableSlots.items.filter((slot) => slot.sourceSystem === "clinic_crm").length}
            />
            <Kpi
              label="Минут"
              value={availableSlots.items.reduce((sum, slot) => sum + slot.durationMinutes, 0)}
            />
          </div>
          <div className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            {availableSlots.items.length === 0 ? (
              "Свободных окон в локальном кэше пока нет. Доступность передаётся только через защищённый входящий импорт."
            ) : (
              <ul className="space-y-2">
                {availableSlots.items.map((slot) => (
                  <li key={slot.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {slotLabel(slot)}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={selectedSlotId === slot.id ? "default" : "outline"}
                      className="min-h-11 text-[12px]"
                      onClick={() => setSelectedSlotId(slot.id)}
                      aria-label={`Выбрать окно ${slotLabel(slot)}`}
                    >
                      {selectedSlotId === slot.id ? "Выбрано" : "Выбрать"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="surface-card grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
          <Kpi label="Всего" value={page.count} />
          <Kpi label="Новые" value={page.items.filter((item) => item.status === "requested").length} />
          <Kpi label="В работе" value={page.items.filter((item) => item.status === "reviewing").length} />
          <Kpi label="Записаны" value={page.items.filter((item) => item.status === "booked").length} />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="overflow-hidden">
            <header className="section-bar">
              <h2 className="h-section">Очередь заявок на запись</h2>
              <span className="h-section-hint">система клиники</span>
            </header>

            <div className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
              <label className="grid w-48 gap-1 text-[12px] font-medium">
                Статус заявки
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
                  aria-label="Фильтр статуса заявок на запись"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-[220px] flex-1 gap-1 text-[12px] font-medium">
                Поиск
                <Input
                  aria-label="Поиск заявок на запись"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Пациент, код, причина"
                  className="min-h-11"
                />
              </label>
            </div>

            {page.items.length === 0 ? (
              <div className="p-6 text-[13px] text-muted-foreground">Заявок на запись по текущему фильтру нет.</div>
            ) : (
              <ul className="divide-y divide-border">
                {page.items.map((request) => (
                  <li key={request.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => chooseRequest(request)}
                      aria-label={`Открыть заявку на запись: ${request.patient.fullName || (request.patient.code ? formatCardNumber(request.patient.code) : "без имени")}`}
                    >
                      <div className="truncate text-[14px] font-semibold">
                        {request.patient.fullName || "Пациент"} · {request.patient.code ? formatCardNumber(request.patient.code) : "без кода"}
                      </div>
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        {formatDateTime(request.preferredFrom)} · {STATUS_LABEL[request.status] || request.status}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
                        {request.reason || "Причина не указана"}
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                      <Button asChild size="sm" variant="outline" className="min-h-11 text-[12px]">
                        <Link
                          to={`/operator/dialogs/${request.id}`}
                          aria-label={`Открыть карточку обращения: ${request.patient.fullName || "пациент"}`}
                        >
                          Карточка
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11 text-[12px]"
                        disabled={busyKey === `reviewing:${request.id}`}
                        onClick={() => void updateRequest(request, "reviewing", { clinicNote: request.clinicNote })}
                        aria-label={`Взять в работу заявку: ${request.patient.fullName || (request.patient.code ? formatCardNumber(request.patient.code) : "без имени")}`}
                      >
                        В работу
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11 text-[12px]"
                        disabled={busyKey === `cancelled:${request.id}`}
                        onClick={() => void updateRequest(request, "cancelled", { clinicNote: request.clinicNote })}
                        aria-label={`Отменить заявку: ${request.patient.fullName || (request.patient.code ? formatCardNumber(request.patient.code) : "без имени")}`}
                      >
                        Отменить
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <header className="section-bar">
              <h2 className="h-section">Карточка заявки</h2>
              <span className="h-section-hint">разбор и запись</span>
            </header>
            {!selected ? (
              <div className="p-4 text-[13px] text-muted-foreground">Выберите заявку из очереди.</div>
            ) : (
              <form className="space-y-4 p-4" onSubmit={submitDetails}>
                <div>
                  <div className="text-[14px] font-semibold">{selected.patient.fullName || "Пациент"}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {selected.patient.code ? formatCardNumber(selected.patient.code) : "без кода"} · {formatDateTime(selected.preferredFrom)}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-[13px] text-muted-foreground">
                  {selected.reason || "Причина не указана"}
                </div>
                {selected.assignedVisitId ? (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-[13px] text-muted-foreground">
                    Визит назначен
                  </div>
                ) : (
                  <label className="grid gap-1 text-[12px] font-medium">
                    Свободное окно для записи
                    <select
                      aria-label="Свободное окно для записи"
                      value={selectedSlotId}
                      onChange={(event) => setSelectedSlotId(event.target.value)}
                      className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
                    >
                      <option value="">Выберите локально кэшированное окно</option>
                      {availableSlots.items.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slotLabel(slot)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="grid gap-1 text-[12px] font-medium">
                  Заметка клиники
                  <Textarea
                    aria-label="Заметка клиники по заявке"
                    value={clinicNote}
                    onChange={(event) => setClinicNote(event.target.value)}
                    maxLength={1000}
                    rows={5}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" className="min-h-11" disabled={busyKey === `reviewing:${selected.id}`}>
                    Сохранить
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={Boolean(selected.assignedVisitId) || !selectedSlotId || busyKey === `booked:${selected.id}`}
                    onClick={() => void bookSelected()}
                  >
                    Подтвердить запись
                  </Button>
                </div>
                <div role="status" aria-live="polite" className="text-[13px] text-muted-foreground">
                  {actionMessage}
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function slotLabel(slot: SelfHostedClinicAvailableSlotDTO): string {
  return `${formatDateTime(slot.startedAt)} · ${slot.durationMinutes} мин · ${slot.doctor.displayName || "врач не указан"} · ${sourceSystemLabel(slot.sourceSystem)}`;
}

function publicBookingMessage(error: SelfHostedApiError | null): string {
  if (!error) return "Неизвестная ошибка системы.";
  if (error.code === "validation_error") return "Проверьте статус, выбранное окно и заметку клиники.";
  if (error.code === "forbidden") return "У роли нет доступа к очереди заявок.";
  return error.message;
}

function sourceSystemLabel(value: string): string {
  return SOURCE_SYSTEM_LABEL[value] || "Другой источник";
}
