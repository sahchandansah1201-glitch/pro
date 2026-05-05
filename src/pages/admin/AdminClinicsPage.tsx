import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/admin/ListPagination";
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
  const [sort, setSort] = useState<SortKey>("priority");
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
            <div role="tablist" aria-label="Сортировка клиник" className="flex flex-wrap gap-1">
              {(
                [
                  { key: "priority", label: "По приоритету" },
                  { key: "conversion", label: "По конверсии" },
                ] as const
              ).map((s) => {
                const active = sort === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    
                    onClick={() => setSort(s.key)}
                    className={`min-h-[44px] rounded-md border px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[28px] sm:text-[11px] ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-foreground hover:bg-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
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

        {/* Desktop: список-карточки в две колонки */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {visible.length === 0 ? (
            <Card className="p-4 text-center text-[12px] text-muted-foreground">
              Нет клиник по выбранному фильтру.
            </Card>
          ) : (
            visible.map((row) => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
