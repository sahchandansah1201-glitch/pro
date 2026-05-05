import { useMemo, useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { useListPagination } from "@/lib/use-list-pagination";
import { getClinics } from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";
import { ROLE_BY_ID, type Role } from "@/lib/roles";

/**
 * Sys Users — управление пользователями и ролями (MVP, демо).
 * SAFETY: не показывает email пациента и raw email вообще; пациент скрыт под
 * меткой «Демо-пациент». Никаких сетевых вызовов и storage.
 */

const DEMO_BANNER =
  "Демо-режим. Реальные роли, RLS, аудит, ключи и Device Bridge включаются на этапе бэкенда.";

type Status = "active" | "demo" | "needs_backend";
const STATUS_LABEL: Record<Status, string> = {
  active: "Активен",
  demo: "Демо",
  needs_backend: "Нужен бэкенд",
};
const STATUS_TONE: Record<Status, string> = {
  active: "hsl(var(--success))",
  demo: "hsl(var(--info))",
  needs_backend: "hsl(var(--warning))",
};

interface UserRow {
  accountId: string;
  display: string;
  role: Role;
  clinicId: string | null;
  status: Status;
  scope: string;
}

const CLINICAL: Role[] = ["doctor", "assistant", "private_doctor"];

const ROWS: UserRow[] = (Object.values(DEMO_USERS) as Array<typeof DEMO_USERS[Role]>).map((u) => {
  const isPatient = u.role === "patient";
  const scope =
    u.role === "system_admin"
      ? "Глобально, без клинического контента"
      : u.role === "patient"
        ? "Только свой портал"
        : u.role === "operator"
          ? "Диалоги бота, лиды клиники"
          : u.role === "clinic_admin"
            ? "Своя клиника, без клинических данных"
            : "Своя клиника, клинический контент";
  return {
    accountId: u.id,
    display: isPatient ? "Демо-пациент" : u.fullName,
    role: u.role,
    clinicId: u.clinicId,
    status: u.role === "system_admin" ? "needs_backend" : "demo",
    scope,
  };
});

type FilterKey = "all" | "clinical" | "clinic_admin" | "operator" | "system_admin" | "patient";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "clinical", label: "Клинический персонал" },
  { key: "clinic_admin", label: "Админ клиники" },
  { key: "operator", label: "Оператор" },
  { key: "system_admin", label: "Сисадмин" },
  { key: "patient", label: "Пациент" },
];

export default function SysUsersPage() {
  const clinics = getClinics();
  const clinicNameById = useMemo(() => {
    const m = new Map<string, string>();
    clinics.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clinics]);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ROWS.filter((r) => {
      if (filter === "clinical" && !CLINICAL.includes(r.role)) return false;
      if (
        (filter === "clinic_admin" || filter === "operator" || filter === "system_admin" || filter === "patient") &&
        r.role !== filter
      ) return false;
      if (q) {
        const hay = `${r.accountId} ${r.display} ${ROLE_BY_ID[r.role].label}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 5,
    desktopPageSize: 10,
    deps: [filter, query],
  });
  const visible = pagination.visible;

  const resetAll = () => { setFilter("all"); setQuery(""); };
  const activeFilterLabels =
    filter === "all" ? [] : [`фильтр: ${FILTERS.find((f) => f.key === filter)?.label}`];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Пользователи и роли" subtitle="Учётные записи, роли, область доступа." />

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

        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          RoleGuard в MVP — UX-симуляция, не security boundary.
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Фильтр пользователей" className="flex flex-wrap gap-1">
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
            <label className="relative block w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по id, имени или роли"
                aria-label="Поиск пользователей"
                className="h-11 pl-7 text-[12px] sm:h-9"
              />
            </label>
          </div>
        </Card>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        {rows.length === 0 && (
          <ListEmptyState
            itemNoun="пользователей"
            query={query}
            activeFilters={activeFilterLabels}
            totalUnfiltered={ROWS.length}
            onReset={resetAll}
            hint="В демо-каталоге фиксированный список ролей. С бэкендом сюда придут реальные учётные записи."
          />
        )}

        {/* Desktop таблица */}
        {rows.length > 0 && (
          <Card className="hidden p-0 md:block">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Account ID</th>
                  <th className="px-3 py-2">Имя / метка</th>
                  <th className="px-3 py-2">Роль</th>
                  <th className="px-3 py-2">Клиника</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Доступ</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.accountId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-[11px]">{r.accountId}</td>
                    <td className="px-3 py-2 font-medium">{r.display}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ROLE_BY_ID[r.role].label}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.clinicId ? clinicNameById.get(r.clinicId) ?? r.clinicId : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ color: STATUS_TONE[r.status], border: `1px solid ${STATUS_TONE[r.status]}` }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.scope}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() => setNote(`Изменение роли для ${r.accountId} — демо-действие.`)}
                        >
                          Изменить роль (демо)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() => setNote(`Отключение доступа ${r.accountId} — демо-действие.`)}
                        >
                          Отключить доступ (демо)
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Mobile карточки */}
        {rows.length > 0 && (
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {visible.map((r) => (
              <Card key={r.accountId} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{r.display}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">{r.accountId}</div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{ color: STATUS_TONE[r.status], border: `1px solid ${STATUS_TONE[r.status]}` }}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Роль</dt>
                  <dd className="text-right">{ROLE_BY_ID[r.role].label}</dd>
                  <dt className="text-muted-foreground">Клиника</dt>
                  <dd className="text-right">{r.clinicId ? clinicNameById.get(r.clinicId) ?? r.clinicId : "—"}</dd>
                  <dt className="text-muted-foreground">Доступ</dt>
                  <dd className="text-right">{r.scope}</dd>
                </dl>
                <div className="mt-3 flex flex-col gap-1.5">
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(`Изменение роли для ${r.accountId} — демо-действие.`)}>
                    Изменить роль (демо)
                  </Button>
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(`Отключение доступа ${r.accountId} — демо-действие.`)}>
                    Отключить доступ (демо)
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <ListPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          rangeLabel={pagination.rangeLabel}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPageChange={pagination.setPage}
          itemNoun="пользователей"
        />
      </div>
    </div>
  );
}
