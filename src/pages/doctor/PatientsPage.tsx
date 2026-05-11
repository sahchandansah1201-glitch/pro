import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Pencil, Search, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  APPOINTMENTS,
  LESIONS,
  PATIENTS,
  VISITS,
} from "@/lib/mock-data";
import { calcAge, formatDate, sexShort } from "@/lib/format";
import type { Patient, Phototype, Sex } from "@/lib/domain";

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

interface PatientEditDraft {
  id: string;
  fullName: string;
  birthDate: string;
  sex: Sex;
  phototype: Phototype;
  imagingConsent: boolean;
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

function patientToDraft(patient: Patient): PatientEditDraft {
  return {
    id: patient.id,
    fullName: patient.fullName,
    birthDate: patient.birthDate,
    sex: patient.sex,
    phototype: patient.phototype,
    imagingConsent: patient.consents.imaging,
  };
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>(() => PATIENTS);
  const [query, setQuery] = useState("");
  const [phototype, setPhototype] = useState<"any" | Phototype>("any");
  const [consent, setConsent] = useState<ConsentFilter>("any");
  const [lesionsFilter, setLesionsFilter] = useState<LesionsFilter>("any");
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PatientEditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.map(buildRow).filter(({ patient, hasActive }) => {
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
  }, [patients, query, phototype, consent, lesionsFilter]);

  function handleEditOpen(patient: Patient) {
    setCreateNotice(null);
    setEditError(null);
    setEditDraft(patientToDraft(patient));
  }

  function handleEditSave() {
    if (!editDraft) return;
    const fullName = editDraft.fullName.trim();
    if (!fullName) {
      setEditError("Укажите ФИО пациента.");
      return;
    }

    setPatients((current) =>
      current.map((patient) =>
        patient.id === editDraft.id
          ? {
              ...patient,
              fullName,
              birthDate: editDraft.birthDate,
              sex: editDraft.sex,
              phototype: editDraft.phototype,
              consents: {
                ...patient.consents,
                imaging: editDraft.imagingConsent,
              },
            }
          : patient,
      ),
    );
    setCreateNotice(`Изменения по пациенту ${fullName} сохранены локально в демо-режиме.`);
    setEditDraft(null);
    setEditError(null);
  }

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Пациенты"
        subtitle={`Всего в базе: ${patients.length}`}
        actions={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 gap-1.5 text-[12px]"
            onClick={() => {
              setCreateNotice(
                "Создание пациента пока недоступно в демо-режиме. Реальные данные пациентов не вводите.",
              );
            }}
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            Новый пациент
          </Button>
        }
      />

      {createNotice && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-border bg-warning/10 px-6 py-2 text-[12px] text-warning"
        >
          {createNotice}
        </div>
      )}

      {/* Тулбар фильтров */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-6 py-2.5">
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

        <span className="ml-auto text-meta">
          Найдено: <span className="text-foreground tabular-nums">{rows.length}</span>
        </span>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {rows.length === 0 ? (
          <div className="surface-card p-12 text-center text-row text-muted-foreground">
            Под текущие фильтры пациентов не найдено.
          </div>
        ) : (
          <>
            {/* Desktop таблица */}
            <div className="surface-card hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[120px]">Код</th>
                      <th>ФИО</th>
                      <th className="w-[60px]">Возр.</th>
                      <th className="w-[50px]">Пол</th>
                      <th className="w-[80px]">Фототип</th>
                      <th className="w-[110px]">Факторы</th>
                      <th className="w-[130px]">Согласие</th>
                      <th className="w-[100px]">Образ.</th>
                      <th className="w-[120px]">Посл. визит</th>
                      <th className="w-[120px]">След. визит</th>
                      <th className="w-[80px]" aria-label="Действия" />
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
                        <td className="text-[12px] text-muted-foreground tabular-nums">{formatDate(r.lastVisit)}</td>
                        <td className="text-[12px] text-muted-foreground tabular-nums">{formatDate(r.nextVisit)}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              aria-label={`Редактировать пациента ${r.patient.fullName}`}
                              onClick={() => handleEditOpen(r.patient)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </Button>
                            <Link
                              to={`/patients/${r.patient.id}`}
                              aria-label={`Открыть карточку ${r.patient.fullName}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                            >
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </Link>
                          </div>
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
                  <div className="surface-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/patients/${r.patient.id}`}
                        className="min-w-0 flex-1 active:bg-surface-muted"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-row font-medium">{r.patient.fullName}</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{r.patient.code}</span>
                        </div>
                        <div className="mt-0.5 text-meta">
                          {sexShort(r.patient.sex)} · {r.age} лет · фототип {r.patient.phototype} · образований {r.lesionCount}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <ConsentChip ok={r.patient.consents.imaging} />
                          <span className="tabular-nums">Посл. {formatDate(r.lastVisit)}</span>
                          <span className="tabular-nums">След. {formatDate(r.nextVisit)}</span>
                        </div>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Редактировать пациента ${r.patient.fullName}`}
                        onClick={() => handleEditOpen(r.patient)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Dialog
        open={!!editDraft}
        onOpenChange={(open) => {
          if (!open) {
            setEditDraft(null);
            setEditError(null);
          }
        }}
      >
        {editDraft && (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Редактировать пациента</DialogTitle>
              <DialogDescription>
                Изменения сохраняются только локально в демо-режиме.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleEditSave();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="patient-edit-full-name">ФИО</Label>
                <Input
                  id="patient-edit-full-name"
                  value={editDraft.fullName}
                  onChange={(e) => {
                    setEditError(null);
                    setEditDraft((draft) =>
                      draft ? { ...draft, fullName: e.target.value } : draft,
                    );
                  }}
                  className="h-9 text-[13px]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="patient-edit-birth-date">Дата рождения</Label>
                  <Input
                    id="patient-edit-birth-date"
                    type="date"
                    value={editDraft.birthDate}
                    onChange={(e) =>
                      setEditDraft((draft) =>
                        draft ? { ...draft, birthDate: e.target.value } : draft,
                      )
                    }
                    className="h-9 text-[13px]"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Пол</Label>
                  <Select
                    value={editDraft.sex}
                    onValueChange={(value) =>
                      setEditDraft((draft) =>
                        draft ? { ...draft, sex: value as Sex } : draft,
                      )
                    }
                  >
                    <SelectTrigger className="h-9 text-[13px]" aria-label="Пол пациента">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Женский</SelectItem>
                      <SelectItem value="male">Мужской</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Фототип</Label>
                  <Select
                    value={editDraft.phototype}
                    onValueChange={(value) =>
                      setEditDraft((draft) =>
                        draft ? { ...draft, phototype: value as Phototype } : draft,
                      )
                    }
                  >
                    <SelectTrigger className="h-9 text-[13px]" aria-label="Фототип пациента">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHOTOTYPES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md border border-border bg-surface-muted p-3">
                <Checkbox
                  id="patient-edit-imaging-consent"
                  checked={editDraft.imagingConsent}
                  onCheckedChange={(checked) =>
                    setEditDraft((draft) =>
                      draft ? { ...draft, imagingConsent: checked === true } : draft,
                    )
                  }
                />
                <div className="grid gap-1">
                  <Label htmlFor="patient-edit-imaging-consent" className="text-[13px]">
                    Согласие на медицинскую съёмку
                  </Label>
                  <p className="text-[12px] text-muted-foreground">
                    В демо-режиме меняется только отображение на текущей странице.
                  </p>
                </div>
              </div>

              {editError && (
                <div role="alert" className="text-[12px] text-destructive">
                  {editError}
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Отмена
                  </Button>
                </DialogClose>
                <Button type="submit">Сохранить изменения</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
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
