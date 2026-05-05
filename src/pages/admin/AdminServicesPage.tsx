import { useMemo, useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { useListPagination } from "@/lib/use-list-pagination";

/**
 * Admin Services — каталог услуг и тарифов (MVP, read-only).
 *
 * SAFETY:
 *   - Только операционные поля услуги (код, категория, длительность,
 *     цена, активность, согласие, онлайн-запись). Пациент-уровневые
 *     данные не используются.
 *   - Никаких клинических рекомендаций или формулировок диагноза.
 *   - Никаких сетевых вызовов, clipboard, storage, медиа.
 */

const DEMO_NOTICE =
  "MVP: данные демонстрационные. Реальные роли, RLS, аудит и синхронизация включаются на этапе бэкенда.";

type Category = "consult" | "procedure" | "imaging";

interface ServiceRow {
  code: string;
  name: string;
  category: Category;
  durationMin: number;
  priceMin: number;
  priceMax: number;
  active: boolean;
  consentNote: string;
  onlineBooking: boolean;
}

const SERVICES: ServiceRow[] = [
  {
    code: "DRM-001",
    name: "Первичный приём дерматолога",
    category: "consult",
    durationMin: 30,
    priceMin: 2500,
    priceMax: 3500,
    active: true,
    consentNote: "Согласие на обработку персональных данных",
    onlineBooking: true,
  },
  {
    code: "DRM-002",
    name: "Повторный приём",
    category: "consult",
    durationMin: 20,
    priceMin: 1800,
    priceMax: 2500,
    active: true,
    consentNote: "—",
    onlineBooking: true,
  },
  {
    code: "DRM-010",
    name: "Дерматоскопия одного образования",
    category: "imaging",
    durationMin: 15,
    priceMin: 800,
    priceMax: 1200,
    active: true,
    consentNote: "Согласие на медицинскую съёмку",
    onlineBooking: true,
  },
  {
    code: "DRM-011",
    name: "Цифровая карта кожи",
    category: "imaging",
    durationMin: 60,
    priceMin: 4500,
    priceMax: 6000,
    active: true,
    consentNote: "Согласие на медицинскую съёмку и хранение снимков",
    onlineBooking: false,
  },
  {
    code: "DRM-020",
    name: "Удаление образования",
    category: "procedure",
    durationMin: 40,
    priceMin: 3500,
    priceMax: 9000,
    active: true,
    consentNote: "Согласие на медицинскую процедуру",
    onlineBooking: false,
  },
  {
    code: "DRM-021",
    name: "Контроль после удаления",
    category: "consult",
    durationMin: 20,
    priceMin: 1500,
    priceMax: 2000,
    active: false,
    consentNote: "—",
    onlineBooking: true,
  },
];

const CATEGORY_LABEL: Record<Category, string> = {
  consult: "Консультация",
  procedure: "Процедура",
  imaging: "Снимок/карта",
};

type FilterKey = "all" | "active" | "online" | "procedure";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "online", label: "Онлайн-запись" },
  { key: "procedure", label: "Процедуры" },
];

function fmtPrice(min: number, max: number): string {
  if (min === max) return `${min.toLocaleString("ru-RU")} ₽`;
  return `${min.toLocaleString("ru-RU")}–${max.toLocaleString("ru-RU")} ₽`;
}

export default function AdminServicesPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [actionNote, setActionNote] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICES.filter((s) => {
      if (filter === "active" && !s.active) return false;
      if (filter === "online" && !s.onlineBooking) return false;
      if (filter === "procedure" && s.category !== "procedure") return false;
      if (q && !`${s.name} ${s.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 4,
    desktopPageSize: 8,
    deps: [filter, query],
  });
  const visibleRows = pagination.visible;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Услуги и тарифы" subtitle="Каталог услуг, цены, длительность." />

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
            <div role="tablist" aria-label="Фильтр услуг" className="flex flex-wrap gap-1">
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
                placeholder="Поиск по названию или коду"
                aria-label="Поиск услуг"
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

        <Card className="hidden p-0 md:block">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Код</th>
                <th className="px-3 py-2">Услуга</th>
                <th className="px-3 py-2">Категория</th>
                <th className="px-3 py-2 text-right">Длит.</th>
                <th className="px-3 py-2 text-right">Цена</th>
                <th className="px-3 py-2">Согласие</th>
                <th className="px-3 py-2">Онлайн</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    Нет услуг по выбранным фильтрам.
                  </td>
                </tr>
              ) : (
                visibleRows.map((s) => (
                  <tr key={s.code} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{s.code}</td>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{CATEGORY_LABEL[s.category]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.durationMin} мин</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtPrice(s.priceMin, s.priceMax)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{s.consentNote}</td>
                    <td className="px-3 py-2">
                      {s.onlineBooking ? (
                        <span className="text-[11px]" style={{ color: "hsl(var(--success))" }}>
                          Да
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Нет</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: s.active
                            ? "hsl(var(--success))"
                            : "hsl(var(--muted-foreground))",
                          border: `1px solid ${
                            s.active
                              ? "hsl(var(--success))"
                              : "hsl(var(--muted-foreground))"
                          }`,
                        }}
                      >
                        {s.active ? "Активна" : "Отключена"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 min-h-[44px] sm:min-h-[32px]"
                        onClick={() =>
                          setActionNote(
                            `Редактирование услуги «${s.name}» (${s.code}) появится с бэкендом.`,
                          )
                        }
                      >
                        Редактировать (демо)
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <div className="grid grid-cols-1 gap-2 md:hidden">
          {rows.length === 0 ? (
            <Card className="p-4 text-center text-[12px] text-muted-foreground">
              Нет услуг по выбранным фильтрам.
            </Card>
          ) : (
            rows.map((s) => (
              <Card key={s.code} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{s.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {s.code} · {CATEGORY_LABEL[s.category]}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      color: s.active
                        ? "hsl(var(--success))"
                        : "hsl(var(--muted-foreground))",
                      border: `1px solid ${
                        s.active
                          ? "hsl(var(--success))"
                          : "hsl(var(--muted-foreground))"
                      }`,
                    }}
                  >
                    {s.active ? "Активна" : "Отключена"}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Длительность</dt>
                  <dd className="text-right tabular-nums">{s.durationMin} мин</dd>
                  <dt className="text-muted-foreground">Цена</dt>
                  <dd className="text-right tabular-nums">{fmtPrice(s.priceMin, s.priceMax)}</dd>
                  <dt className="text-muted-foreground">Согласие</dt>
                  <dd className="text-right">{s.consentNote}</dd>
                  <dt className="text-muted-foreground">Онлайн-запись</dt>
                  <dd className="text-right">{s.onlineBooking ? "Да" : "Нет"}</dd>
                </dl>
                <Button
                  variant="outline"
                  className="mt-3 min-h-[44px] w-full text-[12px]"
                  onClick={() =>
                    setActionNote(
                      `Редактирование услуги «${s.name}» (${s.code}) появится с бэкендом.`,
                    )
                  }
                >
                  Редактировать (демо)
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
