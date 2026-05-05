import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_USERS } from "@/lib/users";
import {
  getAssessmentsByVisitId,
  getClinicById,
  getImagesByLesionId,
  getLesionsByPatientId,
  getPatientById,
  getVisitById,
} from "@/lib/mock-data";
import { calcAge, formatDate, formatDateTime, sexShort } from "@/lib/format";
import type { BodyMapPoint, Lesion, Patient, Visit } from "@/lib/domain";
import { VisitImagingTab } from "@/pages/doctor/VisitImagingTab";
import { VisitAssessmentTab } from "@/pages/doctor/VisitAssessmentTab";
import { VisitConclusionTab } from "@/pages/doctor/VisitConclusionTab";
import { VisitReportTab } from "@/pages/doctor/VisitReportTab";
import { BodySilhouette, FIGURE_LABEL, pickFigure, type Figure } from "@/components/clinical/BodySilhouette";

const VISIT_STATUS: Record<Visit["status"], string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};

const LESION_STATUS: Record<Lesion["status"], string> = {
  active: "Активное",
  monitoring: "Наблюдение",
  removed: "Удалено",
  archived: "Архив",
};

function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return Object.values(DEMO_USERS).find((u) => u.id === id)?.fullName ?? id;
}

// Детерминированное размещение точек по bodyZone, если mapPoint некорректен.
// Используется как fallback, чтобы UI оставался стабильным.
const ZONE_FALLBACK: Record<string, { view: BodyMapPoint["view"]; x: number; y: number }> = {
  голова: { view: "front", x: 0.5, y: 0.07 },
  лоб: { view: "front", x: 0.5, y: 0.07 },
  шея: { view: "front", x: 0.5, y: 0.14 },
  щека: { view: "front", x: 0.55, y: 0.10 },
  висок: { view: "front", x: 0.42, y: 0.09 },
  грудь: { view: "front", x: 0.5, y: 0.30 },
  живот: { view: "front", x: 0.5, y: 0.48 },
  спина: { view: "back", x: 0.5, y: 0.32 },
  поясница: { view: "back", x: 0.5, y: 0.52 },
  плечо: { view: "front", x: 0.7, y: 0.22 },
  предплечье: { view: "front", x: 0.32, y: 0.45 },
  кисть: { view: "front", x: 0.78, y: 0.55 },
  бедро: { view: "front", x: 0.45, y: 0.62 },
  голень: { view: "front", x: 0.55, y: 0.82 },
  стопа: { view: "front", x: 0.55, y: 0.96 },
};

function resolvePoint(l: Lesion): BodyMapPoint {
  const p = l.mapPoint;
  if (p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) return p;
  const zoneKey = Object.keys(ZONE_FALLBACK).find((k) => l.bodyZone.toLowerCase().includes(k));
  const f = (zoneKey && ZONE_FALLBACK[zoneKey]) || { view: "front" as const, x: 0.5, y: 0.5 };
  return { view: f.view, x: f.x, y: f.y };
}

export default function VisitWorkspacePage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>();
  const patient = id ? getPatientById(id) : undefined;
  const visit = visitId ? getVisitById(visitId) : undefined;

  if (!patient || !visit || visit.patientId !== patient.id) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Визит не найден" subtitle="Карточка визита отсутствует в демо-данных." />
        <div className="p-4">
          <Button asChild size="sm" variant="secondary" className="h-8 text-[12px]">
            <Link to={id ? `/patients/${id}` : "/patients"}>К карточке пациента</Link>
          </Button>
        </div>
      </div>
    );
  }

  const lesions = getLesionsByPatientId(patient.id);
  const clinic = getClinicById(visit.clinicId);

  const headerMeta: Array<{ label: string; value: string }> = [
    { label: "Код", value: patient.code },
    { label: "Пол / возраст", value: `${sexShort(patient.sex)} · ${calcAge(patient.birthDate)} лет` },
    { label: "Фототип", value: String(patient.phototype) },
    { label: "Статус", value: VISIT_STATUS[visit.status] },
    { label: "Клиника", value: clinic?.name ?? "—" },
    { label: "Врач", value: userName(visit.doctorId) },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`${patient.fullName} · Визит ${formatDate(visit.startedAt)}`}
        subtitle={
          <>
            {/* Mobile: 2-column scannable grid */}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px] sm:hidden">
              {headerMeta.map((m) => (
                <div key={m.label} className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</dt>
                  <dd className="truncate text-foreground">{m.value}</dd>
                </div>
              ))}
            </dl>
            {/* Desktop: dense one-line */}
            <p className="hidden h-page-sub sm:block">
              {headerMeta.map((m) => m.value).join(" · ")}
            </p>
          </>
        }
        actions={
          <Button asChild size="sm" variant="secondary" className="h-8 text-[12px]">
            <Link to={`/patients/${patient.id}`}>К пациенту</Link>
          </Button>
        }
      />

      <Tabs defaultValue="intake" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border bg-surface px-3">
          <TabsList className="h-auto overflow-x-auto bg-transparent p-0 sm:h-9">
            <TabsTrigger value="intake" className="min-h-[44px] text-[13px] sm:min-h-0 sm:text-[12px]">Интейк</TabsTrigger>
            <TabsTrigger value="bodymap" className="min-h-[44px] text-[13px] sm:min-h-0 sm:text-[12px]">Body map</TabsTrigger>
            <TabsTrigger value="imaging" className="min-h-[44px] text-[13px] sm:min-h-0 sm:text-[12px]">Снимки</TabsTrigger>
            <TabsTrigger value="assessment" className="min-h-[44px] text-[13px] sm:min-h-0 sm:text-[12px]">Оценка</TabsTrigger>
            <TabsTrigger value="conclusion" className="min-h-[44px] text-[13px] sm:min-h-0 sm:text-[12px]">Заключение</TabsTrigger>
            <TabsTrigger value="report" className="min-h-[44px] text-[13px] sm:min-h-0 sm:text-[12px]">Отчёт</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="intake" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <IntakeTab patient={patient} visit={visit} />
        </TabsContent>

        <TabsContent value="bodymap" className="m-0 min-h-0 flex-1 overflow-hidden p-0">
          <BodyMapTab patient={patient} visit={visit} lesions={lesions} />
        </TabsContent>

        <TabsContent value="imaging" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <VisitImagingTab visit={visit} patientId={patient.id} lesions={lesions} />
        </TabsContent>

        <TabsContent value="assessment" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <VisitAssessmentTab visit={visit} lesions={lesions} />
        </TabsContent>

        <TabsContent value="conclusion" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <VisitConclusionTab patient={patient} visit={visit} lesions={lesions} />
        </TabsContent>

        <TabsContent value="report" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <VisitReportTab patient={patient} visit={visit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────── Intake ─────────

function IntakeTab({ patient, visit }: { patient: Patient; visit: Visit }) {
  const clinic = getClinicById(visit.clinicId);
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <Section title="Жалоба и параметры визита" className="lg:col-span-7">
        <Field term="Жалоба" value={visit.complaint} />
        <Field term="Статус" value={VISIT_STATUS[visit.status]} />
        <Field term="Начат" value={formatDateTime(visit.startedAt)} />
        <Field term="Закрыт" value={visit.closedAt ? formatDateTime(visit.closedAt) : "—"} />
        <Field term="Врач" value={userName(visit.doctorId)} />
        <Field term="Ассистент" value={userName(visit.assistantId)} />
        <Field term="Клиника" value={clinic ? `${clinic.name} · ${clinic.address}` : "—"} />
      </Section>

      <Section title="Демография" className="lg:col-span-5">
        <Field term="ФИО" value={patient.fullName} />
        <Field term="Код" value={<span className="font-mono">{patient.code}</span>} />
        <Field term="Дата рождения" value={`${formatDate(patient.birthDate)} (${calcAge(patient.birthDate)} лет)`} />
        <Field term="Пол" value={patient.sex === "male" ? "Мужской" : "Женский"} />
        <Field term="Фототип (Fitzpatrick)" value={patient.phototype} />
      </Section>

      <Section title="Факторы риска" className="lg:col-span-7">
        {patient.riskFactors.length === 0 ? (
          <div className="text-[12px] text-muted-foreground">Не указаны.</div>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {patient.riskFactors.map((rf) => (
              <li key={rf} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                <span>{rf}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Согласия" className="lg:col-span-5">
        <Field term="Обработка ПД" value={patient.consents.pdn ? "Есть" : "Нет"} />
        <Field term="Медицинская съёмка" value={patient.consents.imaging ? "Есть" : "Нет"} />
        <Field term="Телемедицина" value={patient.consents.telemed ? "Есть" : "Нет"} />
        {!patient.consents.imaging && (
          <div className="mt-2 rounded-sm border border-dashed border-border bg-surface-muted px-2 py-1.5 text-[11px] text-muted-foreground">
            Без согласия на медицинскую съёмку захват дерматоскопии заблокирован.
          </div>
        )}
      </Section>
    </div>
  );
}

// ───────── Body map ─────────

type View = "front" | "back";

function BodyMapTab({ patient, visit, lesions }: { patient: Patient; visit: Visit; lesions: Lesion[] }) {
  const figure: Figure = pickFigure(patient.sex, calcAge(patient.birthDate));
  // Resolved points keep view stable across renders.
  const placedLesions = useMemo(() => {
    const placed = lesions.map((l, i) => ({ lesion: l, point: resolvePoint(l), num: i + 1 }));
    return placed;
  }, [lesions]);

  // Body map must open on the projection of the initially-selected lesion,
  // otherwise users see an empty view (e.g., 3 back-side lesions but front shown).
  const initialLesion = placedLesions[0] ?? null;
  const initialView: View =
    initialLesion?.point.view === "back" ? "back" : "front";

  const [view, setView] = useState<View>(initialView);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(initialLesion?.lesion.id ?? null);

  // Switch projection whenever the selected lesion lives on a different one.
  useEffect(() => {
    if (!selected) return;
    const p = placedLesions.find((x) => x.lesion.id === selected)?.point;
    if (!p) return;
    const targetView: View = p.view === "back" ? "back" : "front";
    setView((current) => (current === targetView ? current : targetView));
  }, [selected, placedLesions]);

  const visiblePoints = placedLesions.filter((p) => {
    if (view === "front") return p.point.view === "front" || p.point.view === "left" || p.point.view === "right" || p.point.view === "scalp";
    return p.point.view === "back";
  });

  const selectedLesion = selected ? lesions.find((l) => l.id === selected) ?? null : null;
  const visitAssessments = getAssessmentsByVisitId(visit.id);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-12">
      {/* Map pane */}
      <div className="flex min-h-0 flex-col border-b border-border lg:col-span-7 lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
          <div className="inline-flex overflow-hidden rounded-sm border border-border">
            <button
              type="button"
              onClick={() => setView("front")}
              className={`px-2.5 py-1 text-[12px] ${view === "front" ? "bg-primary text-primary-foreground" : "bg-surface text-foreground hover:bg-surface-muted"}`}
            >
              Спереди
            </button>
            <button
              type="button"
              onClick={() => setView("back")}
              className={`border-l border-border px-2.5 py-1 text-[12px] ${view === "back" ? "bg-primary text-primary-foreground" : "bg-surface text-foreground hover:bg-surface-muted"}`}
            >
              Сзади
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))} aria-label="Уменьшить">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center text-[12px] tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))} aria-label="Увеличить">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom(1)} aria-label="Сбросить масштаб">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-surface-muted p-3">
          {/* No maxWidth: zoom must visually scale beyond container width.
              Pane itself scrolls (overflow-auto), so document scroll is unaffected. */}
          <div
            className="mx-auto"
            style={{ width: `${320 * zoom}px` }}
          >
            <BodySvg
              view={view}
              points={visiblePoints.map((p) => ({
                id: p.lesion.id,
                num: p.num,
                x: p.point.x,
                y: p.point.y,
                selected: p.lesion.id === selected,
                onSelect: () => setSelected(p.lesion.id),
                label: p.lesion.label,
              }))}
            />
          </div>
        </div>
      </div>

      {/* List + detail pane */}
      <div className="flex min-h-0 flex-col lg:col-span-5">
        <div className="border-b border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Образований у пациента: {lesions.length} · видно на проекции: {visiblePoints.length}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {lesions.length === 0 ? (
            <div className="p-6 text-[13px] text-muted-foreground">Образования у пациента не зарегистрированы.</div>
          ) : (
            <ul className="divide-y divide-border">
              {placedLesions.map(({ lesion, num, point }) => {
                const imageCount = getImagesByLesionId(lesion.id).length;
                const a = visitAssessments.find((x) => x.lesionId === lesion.id);
                const isSel = lesion.id === selected;
                const onView = point.view === "back" ? "back" : "front";
                return (
                  <li
                    key={lesion.id}
                    className={`cursor-pointer px-3 py-2 text-[13px] ${isSel ? "bg-surface-muted" : "bg-surface hover:bg-surface-muted"}`}
                    onClick={() => {
                      setSelected(lesion.id);
                      setView(onView);
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums ${isSel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"}`}>
                          {num}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{lesion.label}</div>
                          <div className="truncate text-[12px] text-muted-foreground">{lesion.bodyZone}</div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {LESION_STATUS[lesion.status]}
                      </span>
                    </div>
                    <dl className="mt-1.5 grid grid-cols-4 gap-x-2 text-[11px]">
                      <Stat term="Впервые" value={formatDate(lesion.firstSeenAt)} />
                      <Stat term="Снимков" value={imageCount} />
                      <Stat term="ABCD" value={a ? a.abcd.total.toFixed(1) : "—"} />
                      <Stat term="7-point" value={a ? a.sevenPoint.total : "—"} />
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedLesion && (
          <div className="border-t border-border bg-surface p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{selectedLesion.label}</div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {selectedLesion.bodyZone} · проекция {labelForView(resolvePoint(selectedLesion).view)}
                </div>
              </div>
              <Button asChild size="sm" variant="secondary" className="h-7 text-[12px]">
                <Link to={`/patients/${patient.id}/lesions/${selectedLesion.id}`}>
                  Открыть <ChevronRight className="ml-0.5 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Клинические значения ABCD и 7-point — данные из существующих мок-оценок этого визита, без AI-диагноза.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function labelForView(v: BodyMapPoint["view"]): string {
  switch (v) {
    case "front": return "спереди";
    case "back": return "сзади";
    case "left": return "слева";
    case "right": return "справа";
    case "scalp": return "волосистая часть";
  }
}

// ───────── SVG body silhouette ─────────

interface PointProps {
  id: string;
  num: number;
  x: number;
  y: number;
  selected: boolean;
  label: string;
  onSelect: () => void;
}

function BodySvg({ view, points }: { view: View; points: PointProps[] }) {
  return (
    <svg viewBox="0 0 200 400" className="block h-auto w-full" role="img" aria-label={`Body map · ${view === "front" ? "спереди" : "сзади"}`}>
      <Silhouette view={view} />
      {points.map((p) => (
        <g key={p.id} onClick={p.onSelect} style={{ cursor: "pointer" }}>
          <title>{`${p.num}. ${p.label}`}</title>
          <circle
            cx={p.x * 200}
            cy={p.y * 400}
            r={p.selected ? 8 : 6}
            fill={p.selected ? "hsl(var(--primary))" : "hsl(var(--surface))"}
            stroke={p.selected ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
            strokeWidth={1.2}
          />
          <text
            x={p.x * 200}
            y={p.y * 400 + 3}
            textAnchor="middle"
            fontSize={8}
            fontWeight={600}
            fill={p.selected ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"}
          >
            {p.num}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Silhouette({ view }: { view: View }) {
  // Schematic anterior/posterior silhouette with anatomical zone outlines.
  const stroke = "hsl(var(--border))";
  const fill = "hsl(var(--surface))";
  const zoneStroke = "hsl(var(--border))";
  return (
    <g fill={fill} stroke={stroke} strokeWidth={1}>
      {/* Head */}
      <ellipse cx={100} cy={28} rx={20} ry={24} />
      {/* Neck */}
      <rect x={92} y={50} width={16} height={12} />
      {/* Torso */}
      <path d="M70,62 L130,62 L138,110 L138,200 L62,200 L62,110 Z" />
      {/* Arms */}
      <path d="M70,66 L48,80 L40,160 L52,200 L62,200 L62,110 Z" />
      <path d="M130,66 L152,80 L160,160 L148,200 L138,200 L138,110 Z" />
      {/* Forearms / hands */}
      <path d="M40,160 L34,235 L46,238 L52,200 Z" />
      <path d="M160,160 L166,235 L154,238 L148,200 Z" />
      <ellipse cx={40} cy={250} rx={9} ry={12} />
      <ellipse cx={160} cy={250} rx={9} ry={12} />
      {/* Hips / legs */}
      <path d="M62,200 L138,200 L132,260 L108,260 L100,210 L92,260 L68,260 Z" />
      <path d="M68,260 L62,340 L86,340 L96,260 Z" />
      <path d="M132,260 L138,340 L114,340 L104,260 Z" />
      {/* Feet */}
      <ellipse cx={74} cy={356} rx={12} ry={8} />
      <ellipse cx={126} cy={356} rx={12} ry={8} />

      {/* Schematic zone separators (faint) */}
      <g stroke={zoneStroke} strokeDasharray="2 2" opacity={0.6} fill="none">
        {view === "front" ? (
          <>
            <line x1={62} y1={120} x2={138} y2={120} />
            <line x1={62} y1={170} x2={138} y2={170} />
            <line x1={100} y1={62} x2={100} y2={200} />
          </>
        ) : (
          <>
            <line x1={62} y1={130} x2={138} y2={130} />
            <line x1={62} y1={180} x2={138} y2={180} />
            <line x1={100} y1={62} x2={100} y2={200} />
          </>
        )}
      </g>
    </g>
  );
}


// ───────── Local primitives (mirrored from PatientDetailPage) ─────────

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-border bg-surface ${className ?? ""}`}>
      <div className="border-b border-border bg-surface-muted px-3 py-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
      </div>
      <div className="space-y-1.5 p-3 text-[13px]">{children}</div>
    </section>
  );
}

function Field({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1.5 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-[12px] text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  );
}

function Stat({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
