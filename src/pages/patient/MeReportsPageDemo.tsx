import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ShieldAlert, Search, X, Download, Printer, LockKeyhole } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { ListPagination } from "@/components/admin/ListPagination";
import { useListPagination } from "@/lib/use-list-pagination";
import { formatDate } from "@/lib/format";
import { getSafeReports, demoNow } from "./patient-data";

const DEMO_BANNER =
  "Учебный режим. Список заключений сформирован из учебных данных кабинета.";

type SortMode = "new" | "old" | "clinic-asc" | "clinic-desc";
const SORT_LABEL: Record<SortMode, string> = {
  new: "Сначала новые",
  old: "Сначала старые",
  "clinic-asc": "Клиника А→Я",
  "clinic-desc": "Клиника Я→А",
};

type PeriodMode = "all" | "30" | "90" | "365" | "custom";
const PERIOD_LABEL: Record<PeriodMode, string> = {
  all: "Всё время",
  "30": "30 дней",
  "90": "90 дней",
  "365": "Год",
  custom: "Период…",
};

export default function MeReportsPage() {
  const allReports = useMemo(() => getSafeReports(), []);
  const clinics = useMemo(
    () => Array.from(new Set(allReports.map((r) => r.clinicName))).sort(),
    [allReports],
  );

  const [query, setQuery] = useState("");
  const [doctorQuery, setDoctorQuery] = useState("");
  const [clinic, setClinic] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("new");
  const [period, setPeriod] = useState<PeriodMode>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const range = useMemo<{ from?: number; to?: number }>(() => {
    const now = demoNow();
    if (period === "all") return {};
    if (period === "custom") {
      const from = fromDate ? Date.parse(`${fromDate}T00:00:00Z`) : undefined;
      const to = toDate ? Date.parse(`${toDate}T23:59:59Z`) : undefined;
      return { from, to };
    }
    const days = Number(period);
    return { from: now - days * 24 * 60 * 60 * 1000, to: now };
  }, [period, fromDate, toDate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dq = doctorQuery.trim().toLowerCase();
    let list = allReports.filter((r) => {
      if (clinic !== "all" && r.clinicName !== clinic) return false;
      const t = Date.parse(r.visitDate);
      if (range.from !== undefined && t < range.from) return false;
      if (range.to !== undefined && t > range.to) return false;
      if (dq && !r.doctorName.toLowerCase().includes(dq)) return false;
      if (!q) return true;
      return (
        r.summary.toLowerCase().includes(q) ||
        r.clinicName.toLowerCase().includes(q) ||
        r.doctorName.toLowerCase().includes(q) ||
        formatDate(r.visitDate).toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "clinic-asc" || sort === "clinic-desc") {
        const cmpC = a.clinicName.localeCompare(b.clinicName, "ru");
        if (cmpC !== 0) return sort === "clinic-asc" ? cmpC : -cmpC;
        // tie-break: новее сверху
        return -a.visitDate.localeCompare(b.visitDate);
      }
      const cmp = a.visitDate.localeCompare(b.visitDate);
      return sort === "new" ? -cmp : cmp;
    });
    return list;
  }, [allReports, query, doctorQuery, clinic, sort, range]);

  const pagination = useListPagination(filtered, {
    mobilePageSize: 5,
    desktopPageSize: 10,
    deps: [query, doctorQuery, clinic, sort, period, fromDate, toDate],
  });

  const reset = () => {
    setQuery(""); setDoctorQuery(""); setClinic("all"); setSort("new");
    setPeriod("all"); setFromDate(""); setToDate("");
  };
  const activeFilters: string[] = [];
  if (doctorQuery.trim()) activeFilters.push(`врач: «${doctorQuery.trim()}»`);
  if (clinic !== "all") activeFilters.push(`клиника: ${clinic}`);
  if (sort !== "new") activeFilters.push(`сортировка: ${SORT_LABEL[sort].toLowerCase()}`);
  if (period !== "all") {
    activeFilters.push(
      period === "custom"
        ? `период: ${fromDate || "…"} — ${toDate || "…"}`
        : `период: ${PERIOD_LABEL[period].toLowerCase()}`,
    );
  }
  const hasAnyFilter = !!query || !!doctorQuery || clinic !== "all" || sort !== "new" || period !== "all";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Мои заключения" subtitle="Поиск, фильтр по клинике и сортировка." />

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

        <Card role="region" aria-label="Контур безопасной выдачи" className="p-3">
          <div className="flex flex-wrap items-start gap-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-[13px] font-semibold">Контур безопасной выдачи</h2>
              <div className="mt-2 grid grid-cols-1 gap-2 text-[12px] text-muted-foreground md:grid-cols-3">
                <div>
                  <div className="font-medium text-foreground">Доступ: только личный кабинет</div>
                  <div>Открывается внутри роли пациента, без показа ссылки или кода доступа.</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">Служебные данные и врачебная версия скрыты</div>
                  <div>В списке видны только дата, клиника, врач и безопасный текст.</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">Нужен повторный осмотр или вопрос врачу</div>
                  <div>Откройте заключение и перейдите к записи на контроль.</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            aria-disabled="true"
            title="Сохранение файла будет подключено клиникой"
            className="min-h-[44px] sm:min-h-[32px]"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden /> Сохранить список
          </Button>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative">
              <span className="sr-only">Поиск по заключениям</span>
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по тексту, клинике, врачу, дате"
                className="h-11 pl-7 text-[13px] sm:h-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Очистить поиск"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>

            <label className="relative">
              <span className="sr-only">Поиск по ФИО врача</span>
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={doctorQuery}
                onChange={(e) => setDoctorQuery(e.target.value)}
                placeholder="Врач (ФИО)"
                aria-label="Поиск по ФИО врача"
                className="h-11 w-full pl-7 text-[13px] sm:h-9 sm:w-[220px]"
              />
              {doctorQuery && (
                <button
                  type="button"
                  aria-label="Очистить поиск по врачу"
                  onClick={() => setDoctorQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>

            <label className="flex items-center gap-2 text-[12px]">
              <span className="text-muted-foreground">Клиника</span>
              <select
                value={clinic}
                onChange={(e) => setClinic(e.target.value)}
                className="h-11 rounded-md border border-input bg-background px-2 text-[13px] sm:h-9"
                aria-label="Фильтр по клинике"
              >
                <option value="all">Все ({allReports.length})</option>
                {clinics.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <div
              className="flex flex-wrap items-center gap-1 sm:col-span-full"
              role="group"
              aria-label="Период"
            >
              <span className="mr-1 text-[12px] text-muted-foreground">Период:</span>
              {(Object.keys(PERIOD_LABEL) as PeriodMode[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={period === p ? "default" : "outline"}
                  aria-pressed={period === p}
                  className="min-h-[44px] sm:min-h-[32px]"
                  onClick={() => setPeriod(p)}
                >
                  {PERIOD_LABEL[p]}
                </Button>
              ))}
              {period === "custom" && (
                <div className="flex flex-wrap items-center gap-1">
                  <label className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    с
                    <Input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-11 w-[150px] text-[13px] sm:h-9"
                      aria-label="Начало периода"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    по
                    <Input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-11 w-[150px] text-[13px] sm:h-9"
                      aria-label="Конец периода"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Сортировка">
              {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={sort === m ? "default" : "outline"}
                  aria-pressed={sort === m}
                  className="min-h-[44px] sm:min-h-[32px]"
                  onClick={() => setSort(m)}
                >
                  {SORT_LABEL[m]}
                </Button>
              ))}
            </div>

            {hasAnyFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                className="min-h-[44px] sm:min-h-[32px]"
              >
                Сбросить
              </Button>
            )}
          </div>
        </Card>

        {filtered.length === 0 ? (
          <ListEmptyState
            itemNoun="заключений"
            query={query}
            activeFilters={activeFilters}
            totalUnfiltered={allReports.length}
            onReset={reset}
            hint="Уточните поиск или выберите другую клинику."
          />
        ) : (
          <Card className="p-3 sm:p-4">
            {(() => {
              const visibleIds = pagination.visible.map((r) => r.id);
              const allOnPage = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
              const someOnPage = visibleIds.some((id) => selected.has(id));
              const togglePage = () => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (allOnPage) visibleIds.forEach((id) => next.delete(id));
                  else visibleIds.forEach((id) => next.add(id));
                  return next;
                });
              };
              const downloadDemo = () => {
                toast({
                  title: "Сохранение файла недоступно",
                  description: `Выбрано заключений: ${selected.size}. В учебном режиме файл не формируется.`,
                });
              };
              return (
                <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-border pb-2">
                  <label className="flex items-center gap-2 text-[12px]">
                    <Checkbox
                      checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                      onCheckedChange={togglePage}
                      aria-label="Выбрать все на странице"
                      className="h-11 w-11 shrink-0 sm:h-4 sm:w-4"
                    />
                    <span className="text-muted-foreground">
                      Выбрано: <span className="tabular-nums">{selected.size}</span>
                    </span>
                  </label>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {selected.size > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(new Set())}
                        className="min-h-[44px] sm:min-h-[32px]"
                      >
                        Снять выбор
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={selected.size === 0}
                      onClick={downloadDemo}
                      className="min-h-[44px] sm:min-h-[32px]"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden /> Скачать выбранные
                    </Button>
                  </div>
                </div>
              );
            })()}
            <ul className="divide-y divide-border">
              {pagination.visible.map((r) => {
                const checked = selected.has(r.id);
                return (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label={`Выбрать заключение от ${formatDate(r.visitDate)}`}
                      className="mt-0 h-11 w-11 shrink-0 sm:mt-1 sm:h-4 sm:w-4"
                    />
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                        <span className="font-medium">{formatDate(r.visitDate)}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="truncate text-muted-foreground">{r.clinicName}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-muted-foreground">Врач: {r.doctorName}</div>
                      <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{r.summary}</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0 min-h-[44px] sm:min-h-[32px]">
                      <Link to={`/me/reports/${r.id}`}>Открыть</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3">
              <ListPagination
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={pagination.total}
                rangeLabel={pagination.rangeLabel}
                canPrev={pagination.canPrev}
                canNext={pagination.canNext}
                onPageChange={pagination.setPage}
                itemNoun="заключений"
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
