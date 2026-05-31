import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/admin/ListPagination";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { AdminMetric, AdminOpsCard } from "@/components/admin/AdminOpsCard";
import { useListPagination } from "@/lib/use-list-pagination";
import { getAppointments, getClinics, getIntegrations, getLeads } from "@/lib/mock-data";
import type { PartnerTier } from "@/lib/domain";

/**
 * Admin Clinics — клиники и филиалы (MVP, read-only).
 *
 * SAFETY:
 *   - Используются операционные данные клиники: имя, адрес, тариф,
 *     приоритет маршрутинга, агрегаты лидов и записей. Пациент-уровневые
 *     поля не импортируются. Телефон клиники не отображаем — оставлено
 *     для бэкенд-этапа редактирования контактов.
 *   - Никаких сетевых вызовов, clipboard, storage, медиа.
 */

const DEMO_NOTICE =
  "MVP: данные демонстрационные. Реальные роли, RLS, аудит и синхронизация включаются на этапе бэкенда.";

const PARTNER_TIER_LABEL: Record<PartnerTier, string> = {
  owned: "Своя",
  partner: "Партнёр",
  external: "Внешняя",
};

type FilterKey = "all" | "owned" | "partner" | "external";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "owned", label: "Свои" },
  { key: "partner", label: "Партнёрские" },
  { key: "external", label: "Внешние" },
];

type SortKey = "priority" | "conversion";

const SORT_OPTIONS: {
  key: SortKey;
  label: string;
  hint: string;
  Icon: typeof ArrowUpNarrowWide;
}[] = [
  {
    key: "priority",
    label: "По приоритету",
    hint: "сначала клиники с меньшим номером маршрутинга",
    Icon: ArrowUpNarrowWide,
  },
  {
    key: "conversion",
    label: "По конверсии",
    hint: "сначала клиники с лучшим отношением записей к лидам",
    Icon: ArrowDownWideNarrow,
  },
];

const isSortKey = (v: string | null): v is SortKey =>
  v === "priority" || v === "conversion";

// Детерминированная демо-готовность инфраструктуры по клинике.
const READINESS: Record<
  string,
  { integration: "ready" | "partial" | "missing"; bridge: "ready" | "partial" | "missing" }
> = {
  "clinic-demo-001": { integration: "ready", bridge: "ready" },
  "clinic-demo-002": { integration: "partial", bridge: "partial" },
  "clinic-private-007": { integration: "partial", bridge: "missing" },
};

const READINESS_LABEL = {
  ready: "Готово",
  partial: "Частично",
  missing: "Нет",
} as const;

const READINESS_TONE = {
  ready: "hsl(var(--success))",
  partial: "hsl(var(--warning))",
  missing: "hsl(var(--destructive))",
} as const;

export default function AdminClinicsPage() {
  const clinics = getClinics();
  const leads = getLeads();
  const appointments = getAppointments();
  const integrations = getIntegrations();
  const integrationsActive = integrations.some((i) => i.status === "connected");

  const [filter, setFilter] = useState<FilterKey>("all");

  // Сортировка синхронизируется с ?sort= в URL: значение сохраняется при
  // перезагрузке страницы и шарится по ссылке. Дефолт "priority" в URL не
  // прописываем, чтобы не засорять историю.
  const [searchParams, setSearchParams] = useSearchParams();
  const sortFromUrl = searchParams.get("sort");
  const sort: SortKey = isSortKey(sortFromUrl) ? sortFromUrl : "priority";
  const setSort = (next: SortKey) => {
    const sp = new URLSearchParams(searchParams);
    if (next === "priority") sp.delete("sort");
    else sp.set("sort", next);
    setSearchParams(sp, { replace: true });
  };

  // Если в URL пришло невалидное значение — мягко чистим параметр один раз.
  useEffect(() => {
    if (sortFromUrl !== null && !isSortKey(sortFromUrl)) {
      const sp = new URLSearchParams(searchParams);
      sp.delete("sort");
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortFromUrl]);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const enriched = useMemo(() => {
    return clinics.map((c) => {
      const leadsCount = leads.filter((l) => l.clinicId === c.id).length;
      const bookings = appointments.filter((a) => a.clinicId === c.id).length;
      const conversion = leadsCount > 0 ? Math.round((bookings / leadsCount) * 100) : 0;
      const r = READINESS[c.id] ?? { integration: "partial", bridge: "missing" };
      // Если в системе нет ни одной активной интеграции — даже "ready"
      // помечаем как partial, чтобы не вводить пользователя в заблуждение.
      const integration = integrationsActive ? r.integration : "partial";
      return {
        clinic: c,
        leads: leadsCount,
        bookings,
        conversion,
        integration,
        bridge: r.bridge,
      };
    });
  }, [clinics, leads, appointments, integrationsActive]);

  const readyBranches = enriched.filter(
    (row) => row.integration === "ready" && row.bridge === "ready",
  ).length;
  const needsBridge = enriched.filter((row) => row.bridge !== "ready").length;
  const totalLeads = enriched.reduce((sum, row) => sum + row.leads, 0);

  const visible = useMemo(() => {
    const filtered = enriched.filter((row) =>
      filter === "all" ? true : row.clinic.partnerTier === filter,
    );
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "priority") return a.clinic.routingPriority - b.clinic.routingPriority;
      return b.conversion - a.conversion;
    });
    return sorted;
  }, [enriched, filter, sort]);

  const pagination = useListPagination(visible, {
    mobilePageSize: 4,
    desktopPageSize: 6,
    deps: [filter, sort],
  });
  const visibleRows = pagination.visible;

  const activeFilterLabels =
    filter === "all" ? [] : [`фильтр: ${FILTERS.find((f) => f.key === filter)?.label}`];
  const resetAll = () => {
    setFilter("all");
    setSort("priority");
  };
  const isEmpty = visible.length === 0;
  const emptyState = (
    <ListEmptyState
      itemNoun="клиник"
      activeFilters={activeFilterLabels}
      totalUnfiltered={enriched.length}
      onReset={resetAll}
      hint="В демо-каталоге фиксированный список клиник. Реальный маршрутинг и партнёрские филиалы появятся с бэкендом."
    />
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Клиники и филиалы"
        subtitle="Адреса, маршрутинг лидов, готовность инфраструктуры."
      />

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
          <span>{DEMO_NOTICE}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <AdminOpsCard title="Готовность филиалов" hint="Филиал готов, только если есть интеграция и устройство/кабинет.">
            <div className="grid grid-cols-3 gap-2">
              <AdminMetric label="Филиалы" value={enriched.length} />
              <AdminMetric label="Готовы" value={readyBranches} tone={readyBranches ? "success" : "warning"} />
              <AdminMetric label="Bridge" value={needsBridge} tone={needsBridge ? "warning" : "success"} />
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Готовность показывает только инфраструктуру филиала: кабинет, device bridge, интеграции и правила записи.
            </p>
          </AdminOpsCard>

          <AdminOpsCard title="Связь с врачами и услугами" hint="Справочник мест, где реально работают врачи.">
            <div className="grid gap-2 text-[12px]">
              <div className="rounded-md border border-border bg-surface px-2.5 py-2">
                <div className="font-medium">Врач → филиал → услуга</div>
                <div className="text-[11px] text-muted-foreground">
                  Дерматолог, дерматоскопия и цифровая карта кожи должны быть привязаны к конкретному месту приема.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <span className="rounded bg-muted px-2 py-1">3 филиала</span>
                <span className="rounded bg-muted px-2 py-1">6 услуг</span>
              </div>
            </div>
          </AdminOpsCard>

          <AdminOpsCard
            title="Маршрутизация лидов"
            hint="Приоритет филиала, доступность врачей и качество интеграций."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={() =>
                  setActionNote("Проверка филиалов подготовлена локально. Реальный пересчет маршрутов появится с бэкендом.")
                }
              >
                Проверить филиалы
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <AdminMetric label="Лиды" value={totalLeads} tone="info" />
              <AdminMetric label="Сортировка" value={sort === "priority" ? "приоритет" : "конверсия"} />
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Лиды направляются в филиал только по операционным признакам: расписание, услуга, интеграция, кабинет.
            </p>
          </AdminOpsCard>

          <AdminOpsCard title="Ограничения передачи данных" hint="Админский слой остается aggregate/config only.">
            <p className="text-[12px] text-muted-foreground">
              В интеграции и маршрутизацию передаются только служебные статусы: без фото, диагнозов и raw ID.
            </p>
            <Link
              to="/admin/integrations"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-border px-3 text-[12px] font-medium hover:bg-muted sm:min-h-[32px]"
            >
              Открыть интеграции
            </Link>
          </AdminOpsCard>
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Фильтр клиник" className="flex flex-wrap gap-1">
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
            <div className="flex flex-col gap-1 sm:items-end">
              <div
                role="tablist"
                aria-label="Сортировка клиник"
                className="flex flex-wrap gap-1"
              >
                {SORT_OPTIONS.map((s) => {
                  const active = sort === s.key;
                  const Icon = s.Icon;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-pressed={active}
                      title={s.hint}
                      onClick={() => setSort(s.key)}
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[28px] sm:text-[11px] ${
                        active
                          ? "border-primary bg-primary/15 font-medium text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                          : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden
                        style={active ? { color: "hsl(var(--primary))" } : undefined}
                      />
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <div
                aria-live="polite"
                className="text-[11px] text-muted-foreground sm:text-right"
              >
                Сортировка: {SORT_OPTIONS.find((s) => s.key === sort)?.label}
              </div>
            </div>
          </div>
        </Card>

        {actionNote && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
          >
            {actionNote}
          </div>
        )}

        {isEmpty && emptyState}

        {/* Desktop: список-карточки в две колонки */}
        <div className={`grid grid-cols-1 gap-2 lg:grid-cols-2 ${isEmpty ? "hidden" : ""}`}>
          {visibleRows.map((row) => (
              <Card key={row.clinic.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{row.clinic.name}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {row.clinic.address}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {PARTNER_TIER_LABEL[row.clinic.partnerTier]}
                  </span>
                </div>

                <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Приоритет
                    </dt>
                    <dd className="tabular-nums">{row.clinic.routingPriority}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Лиды
                    </dt>
                    <dd className="tabular-nums">{row.leads}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Записи
                    </dt>
                    <dd className="tabular-nums">{row.bookings}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Конверсия
                    </dt>
                    <dd className="tabular-nums">{row.conversion}%</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Интеграции
                    </dt>
                    <dd>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: READINESS_TONE[row.integration],
                          border: `1px solid ${READINESS_TONE[row.integration]}`,
                        }}
                      >
                        {READINESS_LABEL[row.integration]}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Device Bridge
                    </dt>
                    <dd>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: READINESS_TONE[row.bridge],
                          border: `1px solid ${READINESS_TONE[row.bridge]}`,
                        }}
                      >
                        {READINESS_LABEL[row.bridge]}
                      </span>
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-col gap-1.5 sm:flex-row">
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1 text-[12px] sm:min-h-[36px]"
                    onClick={() =>
                      setActionNote(
                        `Настройка маршрутинга для «${row.clinic.name}» появится с бэкендом.`,
                      )
                    }
                  >
                    Настроить маршрутизацию (демо)
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1 text-[12px] sm:min-h-[36px]"
                    onClick={() =>
                      setActionNote(
                        `Проверка готовности «${row.clinic.name}» — демо-действие.`,
                      )
                    }
                  >
                    Проверить готовность (демо)
                  </Button>
                </div>
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
          itemNoun="клиник"
        />
      </div>
    </div>
  );
}
