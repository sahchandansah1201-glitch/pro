import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  APPOINTMENTS,
  LESIONS,
  PATIENTS,
  VISITS,
} from "@/lib/mock-data";
import { calcAge, formatDate, sexShort } from "@/lib/format";
import type { Patient, Phototype } from "@/lib/domain";

const PHOTOTYPES: Phototype[] = ["I", "II", "III", "IV", "V", "VI"];

type ConsentFilter = "any" | "yes" | "no";
type LesionsFilter = "any" | "with_active" | "without_active";

interface Row {
  patient: Patient;
  age: number;
  lesionCount: number;
  hasActive: boolean;
  lastVisit: string | null;
  nextVisit: string | null;
}

function buildRow(patient: Patient): Row {
  const lesions = LESIONS.filter((l) => l.patientId === patient.id);
  const visits = VISITS.filter((v) => v.patientId === patient.id);
  const past = visits
    .filter((v) => v.status === "closed" && v.closedAt)
    .map((v) => v.closedAt!)
    .sort()
    .reverse();
  const future = [
    ...visits.filter((v) => v.status === "scheduled").map((v) => v.startedAt),
    ...APPOINTMENTS.filter((a) => a.patientId === patient.id && (a.status === "planned" || a.status === "confirmed")).map(
      (a) => a.slotAt,
    ),
  ].sort();

  return {
    patient,
    age: calcAge(patient.birthDate),
    lesionCount: lesions.length,
    hasActive: lesions.some((l) => l.status === "active" || l.status === "monitoring"),
    lastVisit: past[0] ?? null,
    nextVisit: future[0] ?? null,
  };
}

const ALL_ROWS: Row[] = PATIENTS.map(buildRow);

export default function PatientsPage() {
  const [query, setQuery] = useState("");
  const [phototype, setPhototype] = useState<"any" | Phototype>("any");
  const [consent, setConsent] = useState<ConsentFilter>("any");
  const [lesionsFilter, setLesionsFilter] = useState<LesionsFilter>("any");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_ROWS.filter(({ patient, hasActive }) => {
      if (q) {
        const hay = `${patient.fullName} ${patient.code}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (phototype !== "any" && patient.phototype !== phototype) return false;
      if (consent === "yes" && !patient.consents.imaging) return false;
      if (consent === "no" && patient.consents.imaging) return false;
      if (lesionsFilter === "with_active" && !hasActive) return false;
      if (lesionsFilter === "without_active" && hasActive) return false;
      return true;
    });
  }, [query, phototype, consent, lesionsFilter]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Пациенты" subtitle={`Всего в базе: ${PATIENTS.length}`} />

      {/* Тулбар фильтров */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по ФИО или коду пациента"
            className="h-8 pl-7 text-[13px]"
            aria-label="Поиск пациента"
          />
        </div>

        <FilterSelect
          label="Фототип"
          value={phototype}
          onChange={(v) => setPhototype(v as typeof phototype)}
          options={[{ value: "any", label: "Любой фототип" }, ...PHOTOTYPES.map((p) => ({ value: p, label: `Фототип ${p}` }))]}
        />

        <FilterSelect
          label="Согласие на съёмку"
          value={consent}
          onChange={(v) => setConsent(v as ConsentFilter)}
          options={[
            { value: "any", label: "Любое согласие" },
            { value: "yes", label: "Согласие есть" },
            { value: "no", label: "Согласия нет" },
          ]}
        />

        <FilterSelect
          label="Образования"
          value={lesionsFilter}
          onChange={(v) => setLesionsFilter(v as LesionsFilter)}
          options={[
            { value: "any", label: "Все пациенты" },
            { value: "with_active", label: "С активными/наблюдением" },
            { value: "without_active", label: "Без активных" },
          ]}
        />

        <span className="ml-auto text-[12px] text-muted-foreground">
          Найдено: <span className="text-foreground tabular-nums">{rows.length}</span>
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-surface p-10 text-center text-[13px] text-muted-foreground">
            Под текущие фильтры пациентов не найдено.
          </div>
        ) : (
          <>
            {/* Desktop таблица */}
            <div className="hidden overflow-hidden rounded-md border border-border bg-surface md:block">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[120px]">Код</th>
                      <th>ФИО</th>
                      <th className="w-[60px]">Возр.</th>
                      <th className="w-[50px]">Пол</th>
                      <th className="w-[80px]">Фототип</th>
                      <th className="w-[110px]">Факторы риска</th>
                      <th className="w-[130px]">Согласие на съёмку</th>
                      <th className="w-[100px]">Образования</th>
                      <th className="w-[120px]">Посл. визит</th>
                      <th className="w-[120px]">След. визит</th>
                      <th className="w-[60px]" aria-label="Действие" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.patient.id}>
                        <td className="font-mono text-[12px] text-muted-foreground">{r.patient.code}</td>
                        <td>
                          <Link to={`/patients/${r.patient.id}`} className="font-medium hover:underline">
                            {r.patient.fullName}
                          </Link>
                        </td>
                        <td className="tabular-nums">{r.age}</td>
                        <td>{sexShort(r.patient.sex)}</td>
                        <td>{r.patient.phototype}</td>
                        <td className="tabular-nums">{r.patient.riskFactors.length}</td>
                        <td>
                          <ConsentChip ok={r.patient.consents.imaging} />
                        </td>
                        <td className="tabular-nums">{r.lesionCount}</td>
                        <td className="text-[12px] text-muted-foreground">{formatDate(r.lastVisit)}</td>
                        <td className="text-[12px] text-muted-foreground">{formatDate(r.nextVisit)}</td>
                        <td>
                          <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
                            <Link to={`/patients/${r.patient.id}`} aria-label={`Открыть карточку ${r.patient.fullName}`}>
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile стек */}
            <ul className="space-y-2 md:hidden">
              {rows.map((r) => (
                <li key={r.patient.id}>
                  <Link
                    to={`/patients/${r.patient.id}`}
                    className="block rounded-md border border-border bg-surface p-3 active:bg-surface-muted"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{r.patient.fullName}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{r.patient.code}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {sexShort(r.patient.sex)} · {r.age} лет · фототип {r.patient.phototype} · образований {r.lesionCount}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <ConsentChip ok={r.patient.consents.imaging} />
                      <span>Посл. визит: {formatDate(r.lastVisit)}</span>
                      <span>След. визит: {formatDate(r.nextVisit)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-[160px] text-[12px]" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[12px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ConsentChip({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none"
      style={
        ok
          ? { background: "hsl(var(--success) / 0.1)", color: "hsl(var(--success))", borderColor: "hsl(var(--success) / 0.35)" }
          : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
      }
    >
      {ok ? "Есть" : "Нет"}
    </span>
  );
}
