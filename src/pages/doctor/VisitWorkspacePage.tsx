import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw, Images, MapPin } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  BODY_MAP_VIEWS,
  BODY_MAP_VIEW_BUTTON_LABEL,
  bodyMapSurfaceBadge,
  bodyMapSurfaceHint,
  bodyMapSurfaceLabel,
  bodyMapVariantLabel,
  bodyMapViewLabel,
  getBodyMapVariant,
  suggestBodyZone,
  type BodyMapVariant,
} from "@/pages/doctor/body-map-model";

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

type View = BodyMapPoint["view"];

interface PendingPoint {
  view: View;
  x: number;
  y: number;
  zone: string;
}

function BodyMapTab({ patient, visit, lesions }: { patient: Patient; visit: Visit; lesions: Lesion[] }) {
  const variant: BodyMapVariant = getBodyMapVariant(patient);
  const variantLabel = bodyMapVariantLabel(variant);

  const placedLesions = useMemo(() => {
    return lesions.map((l, i) => ({ lesion: l, point: resolvePoint(l), num: i + 1 }));
  }, [lesions]);

  const initialLesion = placedLesions[0] ?? null;
  const initialView: View = initialLesion?.point.view ?? "front";

  const [view, setView] = useState<View>(initialView);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(initialLesion?.lesion.id ?? null);
  const [pending, setPending] = useState<PendingPoint | null>(null);
  const [zoneDraft, setZoneDraft] = useState("");
  const [confirmedDemo, setConfirmedDemo] = useState<PendingPoint[]>([]);

  // Switch projection whenever the selected lesion lives on a different one.
  useEffect(() => {
    if (!selected) return;
    const p = placedLesions.find((x) => x.lesion.id === selected)?.point;
    if (!p) return;
    setView((current) => (current === p.view ? current : p.view));
  }, [selected, placedLesions]);

  // Drop pending placement when projection changes.
  useEffect(() => {
    setPending(null);
  }, [view]);

  const visiblePoints = placedLesions.filter((p) => p.point.view === view);
  const selectedLesion = selected ? lesions.find((l) => l.id === selected) ?? null : null;
  const visitAssessments = getAssessmentsByVisitId(visit.id);
  const selImageCount = selectedLesion ? getImagesByLesionId(selectedLesion.id).length : 0;
  const selAssessment = selectedLesion ? visitAssessments.find((a) => a.lesionId === selectedLesion.id) : undefined;

  const handlePlace = (np: { view: View; x: number; y: number }) => {
    const zone = suggestBodyZone(np.view, np.x, np.y);
    setPending({ view: np.view, x: np.x, y: np.y, zone });
    setZoneDraft(zone);
  };

  const confirmPending = () => {
    if (!pending) return;
    setConfirmedDemo((prev) => [...prev, { ...pending, zone: zoneDraft || pending.zone }]);
    setPending(null);
  };

  const localDemoForView = confirmedDemo.filter((p) => p.view === view);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-12">
      {/* Map pane */}
      <div className="flex min-h-0 flex-col border-b border-border lg:col-span-7 lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-1">
            {BODY_MAP_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`min-h-[44px] rounded-sm border px-2.5 text-[12px] sm:min-h-[32px] ${
                  view === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-foreground hover:bg-surface-muted"
                }`}
              >
                {BODY_MAP_VIEW_BUTTON_LABEL[v]}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">Тип карты: {variantLabel}</div>
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
        <div
          className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border bg-surface-muted px-3 py-1.5"
          aria-live="polite"
        >
          <span className="text-[13px] font-semibold text-foreground">
            {bodyMapSurfaceLabel(view)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {bodyMapSurfaceHint(view)}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-surface-muted p-3">
          <div className="mx-auto" style={{ width: `${320 * zoom}px` }}>
            <BodySvg
              variant={variant}
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
              pending={pending && pending.view === view ? { x: pending.x, y: pending.y } : null}
              demoPoints={localDemoForView}
              onPlace={handlePlace}
            />
          </div>
        </div>
      </div>

      {/* List + detail pane */}
      <div className="flex min-h-0 flex-col lg:col-span-5">
        <div className="border-b border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Образований у пациента: {lesions.length} · видно на проекции «{bodyMapViewLabel(view)}»: {visiblePoints.length}
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
                return (
                  <li
                    key={lesion.id}
                    className={`cursor-pointer px-3 py-2 text-[13px] ${isSel ? "bg-surface-muted" : "bg-surface hover:bg-surface-muted"}`}
                    onClick={() => {
                      setSelected(lesion.id);
                      setView(point.view);
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums ${isSel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground"}`}>
                          {num}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{lesion.label}</div>
                          <div className="truncate text-[12px] text-muted-foreground">
                            {lesion.bodyZone} · {bodyMapViewLabel(point.view)}
                          </div>
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

        {pending && (
          <div className="border-t border-border bg-surface p-3">
            <div className="text-[13px] font-semibold">Новая точка (демо)</div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              <Stat term="Проекция" value={bodyMapViewLabel(pending.view)} />
              <Stat term="X / Y" value={`${Math.round(pending.x * 100)}% / ${Math.round(pending.y * 100)}%`} />
            </dl>
            <label className="mt-2 block text-[11px] text-muted-foreground">
              Подсказанная зона
              <Input
                value={zoneDraft}
                onChange={(e) => setZoneDraft(e.target.value)}
                className="mt-1 h-8 text-[12px]"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={confirmPending}
              >
                Подтвердить демо-точку
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={() => setPending(null)}
              >
                Отменить
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Демо-точка не сохранена в мок-данные.
            </p>
          </div>
        )}

        {selectedLesion && (
          <div className="border-t border-border bg-surface p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{selectedLesion.label}</div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {selectedLesion.bodyZone} · проекция {bodyMapViewLabel(resolvePoint(selectedLesion).view)}
                </div>
              </div>
              <Button asChild size="sm" variant="secondary" className="min-h-[44px] text-[12px] sm:min-h-[32px]">
                <Link to={`/patients/${patient.id}/lesions/${selectedLesion.id}`}>
                  Открыть <ChevronRight className="ml-0.5 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-x-2 text-[11px]">
              <Stat term="X / Y" value={`${Math.round(resolvePoint(selectedLesion).x * 100)}% / ${Math.round(resolvePoint(selectedLesion).y * 100)}%`} />
              <Stat term="Снимков" value={selImageCount} />
              <Stat term="ABCD" value={selAssessment ? selAssessment.abcd.total.toFixed(1) : "—"} />
              <Stat term="7-point" value={selAssessment ? selAssessment.sevenPoint.total : "—"} />
            </dl>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Клинические значения ABCD и 7-point — данные из существующих мок-оценок этого визита, без AI-диагноза.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── SVG body silhouette (variant-aware) ─────────

interface PointProps {
  id: string;
  num: number;
  x: number;
  y: number;
  selected: boolean;
  label: string;
  onSelect: () => void;
}

interface BodySvgProps {
  variant: BodyMapVariant;
  view: View;
  points: PointProps[];
  pending: { x: number; y: number } | null;
  demoPoints: { x: number; y: number; view: View }[];
  onPlace: (np: { view: View; x: number; y: number }) => void;
}

function BodySvg({ variant, view, points, pending, demoPoints, onPlace }: BodySvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const ariaLabel = `Body map · ${bodyMapVariantLabel(variant)} · ${bodyMapSurfaceLabel(view)}`;
  const badge = bodyMapSurfaceBadge(view);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onPlace({ view, x: +x.toFixed(3), y: +y.toFixed(3) });
  };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 400"
      className="block h-auto w-full cursor-crosshair"
      role="img"
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      <VariantSilhouette variant={variant} view={view} />
      {/* Non-interactive surface badge, top-left */}
      <g pointerEvents="none">
        <rect
          x={4}
          y={4}
          rx={2}
          ry={2}
          width={badge.length * 5.4 + 10}
          height={14}
          fill="hsl(var(--primary))"
          opacity={0.9}
        />
        <text
          x={9}
          y={14}
          fontSize={9}
          fontWeight={700}
          letterSpacing="0.5"
          fill="hsl(var(--primary-foreground))"
          stroke="none"
        >
          {badge}
        </text>
      </g>
      {demoPoints.map((p, i) => (
        <circle
          key={`demo-${i}`}
          cx={p.x * 200}
          cy={p.y * 400}
          r={5}
          fill="hsl(var(--surface))"
          stroke="hsl(var(--primary))"
          strokeDasharray="2 2"
          strokeWidth={1.2}
        />
      ))}
      {points.map((p) => (
        <g key={p.id} onClick={(e) => { e.stopPropagation(); p.onSelect(); }} style={{ cursor: "pointer" }}>
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
      {pending && (
        <g pointerEvents="none">
          <circle
            cx={pending.x * 200}
            cy={pending.y * 400}
            r={9}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeDasharray="3 2"
            strokeWidth={1.4}
          />
          <text
            x={pending.x * 200}
            y={pending.y * 400 + 3}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="hsl(var(--primary))"
          >
            +
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * Neutral clinical silhouettes per variant and projection.
 * Same viewBox 0 0 200 400; normalized x/y stay anatomically meaningful.
 */
function VariantSilhouette({ variant, view }: { variant: BodyMapVariant; view: View }) {
  const stroke = "hsl(var(--border))";
  const fill = "hsl(var(--surface))";

  // Per-variant proportions (medically neutral).
  const G = {
    adult_female: { headR: 18, shoulderHalf: 32, waistHalf: 24, hipHalf: 38, headCy: 30 },
    adult_male:   { headR: 19, shoulderHalf: 40, waistHalf: 32, hipHalf: 34, headCy: 30 },
    child_girl:   { headR: 22, shoulderHalf: 26, waistHalf: 22, hipHalf: 28, headCy: 36 },
    child_boy:    { headR: 22, shoulderHalf: 28, waistHalf: 24, hipHalf: 28, headCy: 36 },
  }[variant];

  const cx = 100;
  const headCy = G.headCy;
  const shoulderY = headCy + G.headR + 14;
  const waistY = 160;
  const hipY = 210;
  const legBottom = 360;

  if (view === "scalp") {
    // Top-down view of head. Show scalp circle with parting line on female variants.
    const showParting = variant === "adult_female" || variant === "child_girl";
    return (
      <g fill={fill} stroke={stroke} strokeWidth={1}>
        <ellipse cx={cx} cy={200} rx={70} ry={90} />
        {/* Schematic ears */}
        <ellipse cx={cx - 70} cy={200} rx={6} ry={12} />
        <ellipse cx={cx + 70} cy={200} rx={6} ry={12} />
        {/* Forehead/back hint */}
        <line x1={cx} y1={110} x2={cx} y2={130} stroke={stroke} strokeDasharray="2 2" />
        <text x={cx} y={104} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" stroke="none">лоб</text>
        <text x={cx} y={302} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))" stroke="none">затылок</text>
        {showParting && (
          <line x1={cx} y1={130} x2={cx} y2={270} stroke={stroke} strokeDasharray="3 3" opacity={0.6} />
        )}
      </g>
    );
  }

  if (view === "left" || view === "right") {
    // Side profile: head, neck, torso column, arm hint, leg.
    const facing = view === "left" ? -1 : 1; // direction the nose points
    const noseX = cx + facing * 14;
    return (
      <g fill={fill} stroke={stroke} strokeWidth={1}>
        {/* Head with subtle nose bump */}
        <ellipse cx={cx} cy={headCy} rx={G.headR} ry={G.headR + 2} />
        <path d={`M${cx + facing * (G.headR - 1)},${headCy - 2} Q${noseX},${headCy + 2} ${cx + facing * (G.headR - 1)},${headCy + 6}`} />
        {/* Neck */}
        <rect x={cx - 7} y={headCy + G.headR} width={14} height={shoulderY - (headCy + G.headR)} />
        {/* Torso column */}
        <path d={`M${cx - 22},${shoulderY} L${cx + 22},${shoulderY} L${cx + 18},${waistY} L${cx + 22},${hipY} L${cx - 22},${hipY} L${cx - 18},${waistY} Z`} />
        {/* Arm hint, hanging on facing side */}
        <path d={`M${cx + facing * 18},${shoulderY + 4} L${cx + facing * 22},${hipY - 4} L${cx + facing * 14},${hipY - 4} L${cx + facing * 12},${shoulderY + 8} Z`} />
        {/* Leg */}
        <path d={`M${cx - 14},${hipY} L${cx + 14},${hipY} L${cx + 10},${legBottom - 8} L${cx - 10},${legBottom - 8} Z`} />
        {/* Foot */}
        <ellipse cx={cx + facing * 8} cy={legBottom} rx={14} ry={6} />
      </g>
    );
  }

  // front / back
  const sL = cx - G.shoulderHalf, sR = cx + G.shoulderHalf;
  const wL = cx - G.waistHalf, wR = cx + G.waistHalf;
  const hL = cx - G.hipHalf, hR = cx + G.hipHalf;

  const torso = `M${sL},${shoulderY} L${sR},${shoulderY} L${wR},${waistY} L${hR},${hipY} L${hL},${hipY} L${wL},${waistY} Z`;
  const armL = `M${sL},${shoulderY + 4} L${sL - 14},${waistY} L${sL - 18},${hipY + 28} L${sL - 8},${hipY + 30} L${sL - 6},${waistY + 4} L${sL + 6},${shoulderY + 8} Z`;
  const armR = `M${sR},${shoulderY + 4} L${sR + 14},${waistY} L${sR + 18},${hipY + 28} L${sR + 8},${hipY + 30} L${sR + 6},${waistY + 4} L${sR - 6},${shoulderY + 8} Z`;
  const legL = `M${hL},${hipY} L${cx - 22},${hipY + 60} L${cx - 16},${legBottom - 8} L${cx - 4},${legBottom - 8} L${cx - 4},${hipY} Z`;
  const legR = `M${hR},${hipY} L${cx + 22},${hipY + 60} L${cx + 16},${legBottom - 8} L${cx + 4},${legBottom - 8} L${cx + 4},${hipY} Z`;

  const isFemale = variant === "adult_female" || variant === "child_girl";
  const hairBack = view === "back" && isFemale;

  return (
    <g fill={fill} stroke={stroke} strokeWidth={1}>
      <ellipse cx={cx} cy={headCy} rx={G.headR} ry={G.headR + 2} />
      {hairBack && (
        <path
          d={`M${cx - G.headR + 1},${headCy + 2} q0,${G.headR + 14} ${G.headR - 1},${G.headR + 18} q${G.headR - 1},-6 ${G.headR - 1},-${G.headR + 18}`}
          fill="hsl(var(--surface-muted))"
        />
      )}
      <rect x={cx - 7} y={headCy + G.headR} width={14} height={shoulderY - (headCy + G.headR)} />
      <path d={armL} />
      <path d={armR} />
      <path d={torso} />
      <path d={legL} />
      <path d={legR} />
      <ellipse cx={sL - 14} cy={hipY + 36} rx={8} ry={11} />
      <ellipse cx={sR + 14} cy={hipY + 36} rx={8} ry={11} />
      <ellipse cx={cx - 14} cy={legBottom + 2} rx={12} ry={6} />
      <ellipse cx={cx + 14} cy={legBottom + 2} rx={12} ry={6} />
      {/* Schematic separators */}
      <g stroke={stroke} strokeDasharray="2 2" opacity={0.5} fill="none">
        <line x1={wL} y1={waistY} x2={wR} y2={waistY} />
        <line x1={cx} y1={shoulderY + 4} x2={cx} y2={hipY} />
      </g>
      {/* Anatomical markers — different for front vs back so the surface is unambiguous */}
      {view === "front" ? (
        <g fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} opacity={0.75}>
          {/* Eyes */}
          <circle cx={cx - 6} cy={headCy - 2} r={1.2} fill="hsl(var(--muted-foreground))" stroke="none" />
          <circle cx={cx + 6} cy={headCy - 2} r={1.2} fill="hsl(var(--muted-foreground))" stroke="none" />
          {/* Nose */}
          <path d={`M${cx},${headCy + 1} l-1.5,5 h3 z`} />
          {/* Mouth */}
          <line x1={cx - 4} y1={headCy + 9} x2={cx + 4} y2={headCy + 9} stroke="hsl(var(--muted-foreground))" />
          {/* Sternum / chest guide */}
          <line x1={cx} y1={shoulderY + 8} x2={cx} y2={waistY - 12} strokeDasharray="3 2" />
          {/* Navel */}
          <circle cx={cx} cy={(waistY + hipY) / 2} r={1.6} fill="hsl(var(--muted-foreground))" stroke="none" />
        </g>
      ) : view === "back" ? (
        <g fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} opacity={0.75}>
          {/* Spine line */}
          <line x1={cx} y1={shoulderY + 6} x2={cx} y2={hipY - 4} strokeDasharray="3 2" />
          {/* Shoulder blades */}
          <path d={`M${cx - 16},${shoulderY + 16} q-6,14 0,28`} />
          <path d={`M${cx + 16},${shoulderY + 16} q6,14 0,28`} />
          {/* Lumbar / lower-back guide */}
          <line x1={cx - 14} y1={waistY + 16} x2={cx + 14} y2={waistY + 16} />
          <text x={cx + 18} y={waistY + 19} fontSize={7} fill="hsl(var(--muted-foreground))" stroke="none">поясница</text>
        </g>
      ) : null}
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
