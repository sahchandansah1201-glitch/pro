import { useMemo, useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { useListPagination } from "@/lib/use-list-pagination";
import { getClinics, getAppointments } from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";

/**
 * Admin Doctors — список врачей клиники, расписание и лицензии (MVP, read-only).
 *
 * SAFETY:
 *   - Только операционные данные о врачах: имя, специализация, клиника,
 *     расписание, нагрузка. Пациент-уровневые поля не импортируются.
 *   - Никаких сетевых вызовов, clipboard, storage, медиа.
 *   - Кнопки действий — локальные демо-инструкции через React state.
 */

const DEMO_NOTICE =
  "MVP: данные демонстрационные. Реальные роли, RLS, аудит и синхронизация включаются на этапе бэкенда.";

type LicenseStatus = "valid" | "expiring" | "needs_check";

interface DoctorRow {
  id: string;
  fullName: string;
  specialty: string;
  roleLabel: string;
  clinicId: string;
  scheduleSummary: string;
  todayLoad: number;
  nextSlot: string;
  license: LicenseStatus;
  active: boolean;
}

// Детерминированный демо-список — расширяет DEMO_USERS операционными полями.
const DOCTOR_ROWS: DoctorRow[] = (() => {
  const doc = DEMO_USERS.doctor;
  const pdoc = DEMO_USERS.private_doctor;
  return [
    {
      id: doc.id,
      fullName: doc.fullName,
      specialty: "Дерматолог-онколог",
      roleLabel: "Дерматолог",
      clinicId: doc.clinicId ?? "clinic-demo-001",
      scheduleSummary: "Пн–Пт · 09:00–18:00",
      todayLoad: 6,
      nextSlot: "сегодня · 14:30",
      license: "valid",
      active: true,
    },
    {
      id: pdoc.id,
      fullName: pdoc.fullName,
      specialty: "Дерматолог",
      roleLabel: "Частный врач",
      clinicId: pdoc.clinicId ?? "clinic-private-007",
      scheduleSummary: "Вт, Чт, Сб · 11:00–19:00",
      todayLoad: 3,
      nextSlot: "завтра · 11:00",
      license: "expiring",
      active: true,
    },
    {
      id: "u-doc-002",
      fullName: "Кузнецов Павел Викторович",
      specialty: "Дерматолог",
      roleLabel: "Дерматолог",
      clinicId: "clinic-demo-001",
      scheduleSummary: "Пн, Ср, Пт · 12:00–20:00",
      todayLoad: 4,
      nextSlot: "сегодня · 16:15",
      license: "valid",
      active: true,
    },
    {
      id: "u-doc-003",
      fullName: "Никитина Ольга Романовна",
      specialty: "Дерматолог-косметолог",
      roleLabel: "Дерматолог",
      clinicId: "clinic-demo-002",
      scheduleSummary: "Пн–Чт · 10:00–17:00",
      todayLoad: 5,
      nextSlot: "сегодня · 17:00",
      license: "needs_check",
      active: true,
    },
    {
      id: "u-doc-004",
      fullName: "Рябов Андрей Сергеевич",
      specialty: "Дерматолог-онколог",
      roleLabel: "Дерматолог",
      clinicId: "clinic-demo-002",
      scheduleSummary: "Сб · 10:00–15:00",
      todayLoad: 0,
      nextSlot: "сб · 10:00",
      license: "valid",
      active: false,
    },
  ];
})();

const LICENSE_LABEL: Record<LicenseStatus, string> = {
  valid: "Лицензия действует",
  expiring: "Истекает скоро",
  needs_check: "Нужна проверка",
};
const LICENSE_TONE: Record<LicenseStatus, string> = {
  valid: "hsl(var(--success))",
  expiring: "hsl(var(--warning))",
  needs_check: "hsl(var(--destructive))",
};

type FilterKey = "all" | "active" | "needs_check";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "needs_check", label: "Проверить лицензию" },
];

export default function AdminDoctorsPage() {
  const clinics = getClinics();
  const appointments = getAppointments();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [actionNote, setActionNote] = useState<string | null>(null);

  const clinicNameById = useMemo(() => {
    const m = new Map<string, string>();
    clinics.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clinics]);

  // Реальная нагрузка по записям — суммируем для контекста.
  const realLoadById = useMemo(() => {
    const m = new Map<string, number>();
    appointments.forEach((a) => m.set(a.doctorId, (m.get(a.doctorId) ?? 0) + 1));
    return m;
  }, [appointments]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOCTOR_ROWS.filter((r) => {
      if (filter === "active" && !r.active) return false;
      if (filter === "needs_check" && r.license !== "needs_check") return false;
      if (q && !`${r.fullName} ${r.specialty}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 4,
    desktopPageSize: 8,
    deps: [filter, query],
  });
  const visibleRows = pagination.visible;

  const note = (text: string) => setActionNote(text);

  const activeFilterLabels =
    filter === "all" ? [] : [`фильтр: ${FILTERS.find((f) => f.key === filter)?.label}`];
  const resetAll = () => {
    setFilter("all");
    setQuery("");
  };
  const isEmpty = rows.length === 0;
  const emptyState = (
    <ListEmptyState
      itemNoun="врачей"
      query={query}
      activeFilters={activeFilterLabels}
      totalUnfiltered={DOCTOR_ROWS.length}
      onReset={resetAll}
      hint="В демо-каталоге фиксированный список врачей. С бэкендом сюда добавятся живые данные клиники."
    />
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Врачи" subtitle="Состав, специализации, расписание, лицензии." />

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

        {/* Фильтры + поиск */}
        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Фильтр врачей"
              className="flex flex-wrap gap-1"
            >
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
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени или специализации"
                aria-label="Поиск врачей"
                className="h-11 pl-7 text-[12px] sm:h-9"
              />
            </label>
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

        {/* Desktop таблица */}
        <Card className={`hidden p-0 md:block ${isEmpty ? "md:hidden" : ""}`}>
          <table className="w-full text-[12px]">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Врач</th>
                <th className="px-3 py-2">Специализация</th>
                <th className="px-3 py-2">Клиника</th>
                <th className="px-3 py-2">Расписание</th>
                <th className="px-3 py-2 text-right">Нагрузка</th>
                <th className="px-3 py-2">Лицензия</th>
                <th className="px-3 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{r.fullName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.specialty}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {clinicNameById.get(r.clinicId) ?? r.clinicId}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.scheduleSummary}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.todayLoad}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        /{realLoadById.get(r.id) ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: LICENSE_TONE[r.license],
                          border: `1px solid ${LICENSE_TONE[r.license]}`,
                        }}
                      >
                        {LICENSE_LABEL[r.license]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() =>
                            note(`Открытие расписания врача «${r.fullName}» появится с бэкендом.`)
                          }
                        >
                          Открыть расписание
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() =>
                            note(`Проверка лицензии «${r.fullName}» — демо-действие.`)
                          }
                        >
                          Проверить лицензию (демо)
                        </Button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Mobile карточки */}
        <div className={`grid grid-cols-1 gap-2 md:hidden ${isEmpty ? "hidden" : ""}`}>
          {visibleRows.map((r) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{r.fullName}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {r.specialty} · {r.roleLabel}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      color: LICENSE_TONE[r.license],
                      border: `1px solid ${LICENSE_TONE[r.license]}`,
                    }}
                  >
                    {LICENSE_LABEL[r.license]}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Клиника</dt>
                  <dd className="text-right">
                    {clinicNameById.get(r.clinicId) ?? r.clinicId}
                  </dd>
                  <dt className="text-muted-foreground">Расписание</dt>
                  <dd className="text-right">{r.scheduleSummary}</dd>
                  <dt className="text-muted-foreground">Сегодня</dt>
                  <dd className="text-right tabular-nums">{r.todayLoad}</dd>
                  <dt className="text-muted-foreground">Ближайший слот</dt>
                  <dd className="text-right">{r.nextSlot}</dd>
                </dl>
                <div className="mt-3 flex flex-col gap-1.5">
                  <Button
                    variant="outline"
                    className="min-h-[44px] text-[12px]"
                    onClick={() =>
                      note(`Открытие расписания врача «${r.fullName}» появится с бэкендом.`)
                    }
                  >
                    Открыть расписание
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] text-[12px]"
                    onClick={() =>
                      note(`Проверка лицензии «${r.fullName}» — демо-действие.`)
                    }
                  >
                    Проверить лицензию (демо)
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <ListPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          rangeLabel={pagination.rangeLabel}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPageChange={pagination.setPage}
          itemNoun="врачей"
        />
      </div>
    </div>
  );
}
