import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RiskBadge } from "@/components/clinical/RiskBadge";
import { BodySilhouette, pickFigure, FIGURE_LABEL, type Figure } from "@/components/clinical/BodySilhouette";
import { calcAge, formatDate, formatDateTime } from "@/lib/format";
import {
  getAssessmentsByLesionId,
  getClinicById,
  getImagesByLesionId,
  getLesionById,
  getPatientById,
  getVisitsByPatientId,
} from "@/lib/mock-data";
import type { ClinicalImage, Lesion, Visit } from "@/lib/domain";

const LESION_STATUS: Record<Lesion["status"], string> = {
  active: "Активное",
  monitoring: "Наблюдение",
  removed: "Удалено",
  archived: "Архив",
};
const VISIT_STATUS: Record<Visit["status"], string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};
const IMAGE_KIND: Record<ClinicalImage["kind"], string> = {
  overview: "Обзорный",
  dermoscopy: "Дерматоскопия",
  macro: "Макро",
  body_map: "Карта тела",
};
const IMAGE_SOURCE: Record<ClinicalImage["source"], string> = {
  phone: "Телефон",
  file: "Файл",
  camera: "Камера",
  device_bridge: "Дерматоскоп",
  local_transfer: "Local transfer",
};
const VIEW_LABEL: Record<Lesion["mapPoint"]["view"], string> = {
  front: "перед",
  back: "спина",
  left: "лево",
  right: "право",
  scalp: "волосистая часть",
};
type ComparisonAction = "retake" | "excluded" | "report_limit";

const COMPARISON_ACTION_LABEL: Record<ComparisonAction, string> = {
  retake: "Переснимок запрошен",
  excluded: "Пара исключена из сравнения",
  report_limit: "Ограничение добавлено в черновик отчёта",
};

function imageQualityLabel(image: ClinicalImage) {
  if (image.quality.score >= 0.8 && image.quality.issues.length === 0) return "Готово";
  if (image.quality.score >= 0.72) return "С предупреждением";
  return "Нужен переснимок";
}

function imageQualityTone(image: ClinicalImage) {
  const label = imageQualityLabel(image);
  if (label === "Готово") return "border-risk-low/30 bg-risk-low-soft text-risk-low";
  if (label === "С предупреждением") return "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function comparisonRows(imageA: ClinicalImage, imageB: ClinicalImage) {
  const deviceA = imageA.deviceId ?? "без устройства";
  const deviceB = imageB.deviceId ?? "без устройства";
  const qualityA = `${imageQualityLabel(imageA)} · ${Math.round(imageA.quality.score * 100)}%`;
  const qualityB = `${imageQualityLabel(imageB)} · ${Math.round(imageB.quality.score * 100)}%`;
  const conditionsDiffer =
    imageA.deviceId !== imageB.deviceId || imageA.source !== imageB.source || imageA.kind !== imageB.kind;

  return [
    {
      label: "ID снимка",
      a: imageA.id,
      b: imageB.id,
      result: "Выбраны два снимка",
    },
    {
      label: "Дата",
      a: formatDateTime(imageA.capturedAt),
      b: formatDateTime(imageB.capturedAt),
      result: imageA.capturedAt === imageB.capturedAt ? "Та же дата и время" : "Разная точка времени",
    },
    {
      label: "Тип снимка",
      a: IMAGE_KIND[imageA.kind],
      b: IMAGE_KIND[imageB.kind],
      result: imageA.kind === imageB.kind ? "Тип совпадает" : "Разный тип снимка",
    },
    {
      label: "Источник",
      a: IMAGE_SOURCE[imageA.source],
      b: IMAGE_SOURCE[imageB.source],
      result: imageA.source === imageB.source ? "Источник совпадает" : "Разные источники",
    },
    {
      label: "Устройство",
      a: deviceA,
      b: deviceB,
      result: deviceA === deviceB ? "Устройство совпадает" : "Разные устройства",
    },
    {
      label: "Качество",
      a: qualityA,
      b: qualityB,
      result:
        imageA.quality.issues.length === 0 && imageB.quality.issues.length === 0
          ? "Без технических замечаний"
          : "Есть технические замечания",
    },
    {
      label: "Сопоставимость",
      a: conditionsDiffer ? "условия A отличаются" : "условия A совпадают",
      b: conditionsDiffer ? "условия B отличаются" : "условия B совпадают",
      result: conditionsDiffer ? "Разные условия съёмки" : "Сопоставимо по условиям",
    },
  ];
}

function BodyMapMini({ view, x, y }: { view: Lesion["mapPoint"]["view"]; x: number; y: number }) {
  const cx = Math.max(0, Math.min(1, x)) * 60;
  const cy = Math.max(0, Math.min(1, y)) * 88;
  const silhouette =
    view === "scalp" ? (
      <ellipse cx="30" cy="44" rx="22" ry="26" />
    ) : view === "left" || view === "right" ? (
      <path d="M30 4 c6 0 10 4 10 10 c0 4 -2 7 -4 9 l4 8 v34 c0 4 -2 6 -4 8 l-2 12 h-8 l-2 -12 c-2 -2 -4 -4 -4 -8 v-34 l4 -8 c-2 -2 -4 -5 -4 -9 c0 -6 4 -10 10 -10 z" />
    ) : (
      <path d="M30 4 c5 0 9 4 9 9 c0 5 -4 9 -9 9 c-5 0 -9 -4 -9 -9 c0 -5 4 -9 9 -9 z M18 24 h24 l4 18 l-4 2 l-2 -10 v22 h-6 v28 h-8 v-28 h-8 v-22 l-2 10 l-4 -2 z" />
    );
  return (
    <svg
      viewBox="0 0 60 88"
      width={44}
      height={64}
      role="img"
      aria-label={`Карта тела: ${VIEW_LABEL[view]}, x ${(x * 100).toFixed(0)}%, y ${(y * 100).toFixed(0)}%`}
      className="shrink-0 rounded border bg-muted/30"
    >
      <g fill="hsl(var(--muted-foreground) / 0.25)" stroke="hsl(var(--muted-foreground) / 0.6)" strokeWidth="1">
        {silhouette}
      </g>
      <circle cx={cx} cy={cy} r="3.5" fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth="1.2" />
    </svg>
  );
}

function BodyMapDialog({
  open, onOpenChange, figure, view, x, y, bodyZone, label,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  figure: Figure;
  view: Lesion["mapPoint"]["view"];
  x: number;
  y: number;
  bodyZone: string;
  label: string;
}) {
  // BodySilhouette поддерживает только front/back. left/right/scalp проецируем на front
  // и подсвечиваем словом-подсказкой ниже карты.
  const projected: "front" | "back" = view === "back" ? "back" : "front";
  const note =
    view === "left" || view === "right"
      ? `Боковая проекция (${VIEW_LABEL[view]}) показана на фронтальном силуэте.`
      : view === "scalp"
        ? "Локализация на волосистой части головы — точка отнесена к зоне головы фронтального силуэта."
        : null;

  // Координаты в системе viewBox 200x400 у BodySilhouette.
  const cx = Math.max(0, Math.min(1, x)) * 200;
  const cy = Math.max(0, Math.min(1, y)) * 400;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Карта тела · {label}</DialogTitle>
          <DialogDescription className="text-[12px]">
            {bodyZone} · проекция {VIEW_LABEL[view]} · координаты x{(x * 100).toFixed(0)}% / y{(y * 100).toFixed(0)}% · силуэт: {FIGURE_LABEL[figure]}
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-full max-w-[360px]">
          <svg
            viewBox="0 0 200 400"
            role="img"
            aria-label={`Увеличенная карта тела: ${VIEW_LABEL[view]}, x ${(x * 100).toFixed(0)}%, y ${(y * 100).toFixed(0)}%`}
            className="block h-auto w-full"
          >
            <BodySilhouette view={projected} figure={figure} />
            {/* Прицельные линии X/Y */}
            <g stroke="hsl(var(--destructive) / 0.45)" strokeDasharray="3 3" strokeWidth={0.8}>
              <line x1={0} y1={cy} x2={200} y2={cy} />
              <line x1={cx} y1={0} x2={cx} y2={400} />
            </g>
            {/* Пульсирующее кольцо */}
            <circle
              cx={cx}
              cy={cy}
              r={14}
              fill="hsl(var(--destructive) / 0.15)"
              stroke="hsl(var(--destructive) / 0.5)"
              strokeWidth={0.8}
            />
            <circle
              cx={cx}
              cy={cy}
              r={6}
              fill="hsl(var(--destructive))"
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
            />
          </svg>
          {note && (
            <p className="mt-2 text-center text-[11px] italic text-muted-foreground">{note}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const NotFound = ({ title, hint }: { title: string; hint: string }) => (
  <div className="flex h-full flex-col">
    <PageHeader title={title} subtitle={hint} />
    <div className="p-4">
      <Button asChild size="sm" variant="secondary" className="min-h-[44px] text-[12px] sm:min-h-[32px]">
        <Link to="/patients">К списку пациентов</Link>
      </Button>
    </div>
  </div>
);

export default function LesionDetailPage() {
  const { id = "", lesionId = "" } = useParams<{ id: string; lesionId: string }>();
  const patient = getPatientById(id);
  const lesion = getLesionById(lesionId);

  // Локальный UI-state для демо-действий (не сетевой и не storage).
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparisonAction, setComparisonAction] = useState<ComparisonAction | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const images = useMemo(
    () => [...getImagesByLesionId(lesionId)].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    [lesionId],
  );
  const assessments = useMemo(
    () => [...getAssessmentsByLesionId(lesionId)].sort((a, b) => a.decidedAt.localeCompare(b.decidedAt)),
    [lesionId],
  );
  const visits = useMemo(() => (patient ? getVisitsByPatientId(patient.id) : []), [patient]);

  if (!patient) {
    return <NotFound title="Пациент не найден" hint="Карточка пациента отсутствует в демо-данных." />;
  }
  if (!lesion || lesion.patientId !== patient.id) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Образование не найдено" subtitle="Запись отсутствует или не принадлежит пациенту." />
        <div className="p-4">
          <Button asChild size="sm" variant="secondary" className="min-h-[44px] text-[12px] sm:min-h-[32px]">
            <Link to={`/patients/${patient.id}`}>К карточке пациента</Link>
          </Button>
        </div>
      </div>
    );
  }

  const visitById = (vid: string) => visits.find((v) => v.id === vid);

  const needReview = images.filter((i) => i.quality.score < 0.75 || i.quality.issues.length > 0).length;

  // Визиты, в которых были снимки этого образования, но нет структурированной оценки.
  const visitsWithImages = Array.from(new Set(images.map((i) => i.visitId)));
  const visitsWithAssessment = new Set(assessments.map((a) => a.visitId));
  const orphanVisits = visitsWithImages.filter((v) => !visitsWithAssessment.has(v));

  const latestVisit = visits.find((v) => visitsWithImages.includes(v.id))
    ?? visits.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const bodyMapHref = latestVisit
    ? `/patients/${patient.id}/visits/${latestVisit.id}?tab=bodymap&lesion=${lesion.id}`
    : `/patients/${patient.id}`;

  const toggleCompare = (imgId: string) => {
    setComparisonAction(null);
    setCompareIds((prev) => {
      if (prev.includes(imgId)) return prev.filter((x) => x !== imgId);
      const next = [...prev, imgId];
      return next.slice(-2); // максимум 2 для сравнения
    });
  };

  const compareImages = compareIds
    .map((imgId) => images.find((img) => img.id === imgId))
    .filter((img): img is ClinicalImage => Boolean(img));
  const hasComparablePair = compareImages.length === 2;
  const captureConditionsDiffer = hasComparablePair
    ? compareImages[0].deviceId !== compareImages[1].deviceId
      || compareImages[0].source !== compareImages[1].source
      || compareImages[0].kind !== compareImages[1].kind
    : false;
  const matrixRows = hasComparablePair ? comparisonRows(compareImages[0], compareImages[1]) : [];
  const selectedPairHasQualityIssues = hasComparablePair
    ? compareImages.some((img) => img.quality.score < 0.75 || img.quality.issues.length > 0)
    : false;
  const selectedPairIsComparable = hasComparablePair && !captureConditionsDiffer && !selectedPairHasQualityIssues;
  const comparisonReasons = [
    captureConditionsDiffer ? "Разные условия съёмки" : null,
    selectedPairHasQualityIssues ? "Есть технические замечания" : null,
  ].filter((reason): reason is string => Boolean(reason));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`${lesion.label} · ${lesion.bodyZone}`}
        subtitle={`${patient.fullName} · ${patient.code} · с ${formatDate(lesion.firstSeenAt)} · ${LESION_STATUS[lesion.status]}`}
      />

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="min-h-[44px] sm:min-h-[32px]">
            <Link to={`/patients/${patient.id}`}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> К карточке пациента
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary" className="min-h-[44px] sm:min-h-[32px]">
            <Link to={bodyMapHref}>
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Открыть на карте тела
            </Link>
          </Button>
          {latestVisit && (
            <Button asChild size="sm" variant="outline" className="min-h-[44px] sm:min-h-[32px]">
              <Link to={`/patients/${patient.id}/visits/${latestVisit.id}`}>
                Открыть визит {formatDate(latestVisit.startedAt)} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </Button>
          )}
        </div>

        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> Локализация
              </div>
              <div className="mt-1 flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  aria-label="Открыть увеличенную карту тела"
                  className="group relative shrink-0 rounded border bg-muted/30 p-0 transition hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BodyMapMini view={lesion.mapPoint.view} x={lesion.mapPoint.x} y={lesion.mapPoint.y} />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 rounded-b bg-background/85 py-0.5 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Maximize2 className="h-2.5 w-2.5" aria-hidden /> увеличить
                  </span>
                </button>
                <div className="min-w-0">
                  <div className="text-[13px]">{lesion.bodyZone}</div>
                  <div className="text-[12px] text-muted-foreground">
                    Проекция: {VIEW_LABEL[lesion.mapPoint.view]}
                  </div>
                  <div className="text-[12px] text-muted-foreground tabular-nums">
                    x{(lesion.mapPoint.x * 100).toFixed(0)}% / y{(lesion.mapPoint.y * 100).toFixed(0)}%
                  </div>
                  <button
                    type="button"
                    onClick={() => setMapOpen(true)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline focus:outline-none focus-visible:underline"
                  >
                    <Maximize2 className="h-3 w-3" aria-hidden /> Открыть карту
                  </button>
                </div>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">ID очага</div>
              <div className="mt-1 font-mono text-[13px]">{lesion.id}</div>
              <div className="text-[12px] text-muted-foreground">Один ID: карта, снимки, отчёт</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Статус</div>
              <div className="mt-1 text-[13px]">{LESION_STATUS[lesion.status]}</div>
              <div className="text-[12px] text-muted-foreground">Первое появление: {formatDate(lesion.firstSeenAt)}</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Снимки
              </div>
              <div className="mt-1 text-[13px] tabular-nums">{images.length}</div>
              <div className="text-[12px] text-muted-foreground">Требуют пересмотра: {needReview}</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Оценки
              </div>
              <div className="mt-1 text-[13px] tabular-nums">{assessments.length}</div>
              <div className="text-[12px] text-muted-foreground">Визитов с этим очагом: {visitsWithImages.length}</div>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold">Лента дат очага</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Один очаг, даты съёмки, устройство, источник и техническое качество снимков.
              </p>
            </div>
            {compareImages.length > 0 && (
              <span className="rounded-sm border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                Выбрано для сравнения: {compareImages.length}/2
              </span>
            )}
          </div>

          {images.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">Лента появится после привязки снимков к очагу.</p>
          ) : (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Лента дат очага">
              {images.map((img) => {
                const isActive = activeImageId === img.id;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImageId((prev) => (prev === img.id ? null : img.id))}
                    aria-pressed={isActive}
                    className={`min-w-[180px] rounded-md border p-2 text-left text-[12px] transition ${
                      isActive ? "border-primary bg-[hsl(var(--primary-soft))]" : "border-border bg-background hover:bg-muted/30"
                    }`}
                  >
                    <div className="font-medium tabular-nums">{formatDate(img.capturedAt)}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {IMAGE_KIND[img.kind]} · {IMAGE_SOURCE[img.source]}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {img.deviceId ?? "без устройства"}
                    </div>
                    <span className={`mt-1 inline-flex rounded-sm border px-1.5 py-0.5 text-[11px] ${imageQualityTone(img)}`}>
                      {imageQualityLabel(img)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {compareImages.length > 0 && (
            <div className="mt-3 rounded-md border border-border bg-muted/20 p-2">
              <div className="text-[12px] font-semibold">Сравнение по датам</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                {compareImages.map((img) => (
                  <span key={img.id} className="rounded-sm border border-border bg-background px-1.5 py-0.5">
                    {formatDate(img.capturedAt)} · {img.deviceId ?? "без устройства"} · {IMAGE_KIND[img.kind]}
                  </span>
                ))}
              </div>
              {hasComparablePair ? (
                <div className="mt-2 overflow-x-auto">
                  <div className="mb-1 text-[12px] font-semibold text-foreground">Матрица сравнения</div>
                  <table aria-label="Матрица сравнения" className="w-full min-w-[680px] border-collapse text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="px-2 py-1 font-medium">Параметр</th>
                        <th scope="col" className="px-2 py-1 font-medium">Снимок A</th>
                        <th scope="col" className="px-2 py-1 font-medium">Снимок B</th>
                        <th scope="col" className="px-2 py-1 font-medium">Вывод</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixRows.map((row) => (
                        <tr key={row.label} className="border-b border-border/70 last:border-0">
                          <th scope="row" className="px-2 py-1.5 font-medium text-foreground">{row.label}</th>
                          <td className="px-2 py-1.5 text-muted-foreground">{row.a}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{row.b}</td>
                          <td className="px-2 py-1.5 text-foreground">{row.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Выберите второй снимок, чтобы собрать матрицу условий съёмки.
                </p>
              )}
              {captureConditionsDiffer && (
                <p className="mt-2 flex items-start gap-2 rounded-md border px-2 py-1.5 text-[12px]"
                  style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.30)", color: "hsl(var(--warning))" }}>
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Условия съёмки не сопоставимы: разные устройства, источник или тип снимка. Нельзя оценивать динамику без врачебной проверки.
                  </span>
                </p>
              )}
              {hasComparablePair && (
                <section
                  aria-label="Рабочий разбор пары"
                  className="mt-2 rounded-md border border-border bg-background p-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold">Рабочий разбор пары</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className="text-muted-foreground">Техническая сопоставимость:</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${
                            selectedPairIsComparable
                              ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                          }`}
                        >
                          {selectedPairIsComparable ? (
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                          ) : (
                            <ShieldAlert className="h-3 w-3" aria-hidden />
                          )}
                          {selectedPairIsComparable ? "Сопоставимо" : "Не сопоставимо"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                        onClick={() => setComparisonAction("retake")}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Запросить переснимок
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                        onClick={() => setComparisonAction("excluded")}
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden /> Исключить из сравнения
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                        onClick={() => setComparisonAction("report_limit")}
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden /> Добавить ограничение в отчёт
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 text-[12px] sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)]">
                    <div className="min-w-0 rounded-sm border border-border bg-muted/20 p-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Причины</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(comparisonReasons.length > 0 ? comparisonReasons : ["Условия повторяемы"]).map((reason) => (
                          <span key={reason} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px]">
                            {reason}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Не оценивайте динамику по этой паре без врачебной проверки и повторяемых условий съёмки.
                      </p>
                    </div>
                    <div className="min-w-0 rounded-sm border border-border bg-muted/20 p-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Следующее действие</div>
                      <p className="mt-1 text-[12px]">
                        {selectedPairIsComparable
                          ? "Можно использовать пару для врачебного сравнения."
                          : "Сначала закройте техническое ограничение или запросите переснимок."}
                      </p>
                      {comparisonAction && (
                        <p className="mt-1.5 text-[12px] font-medium text-primary" role="status">
                          {COMPARISON_ACTION_LABEL[comparisonAction]}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </Card>

        <Card className="p-3 sm:p-4">
          <h2 className="text-[13px] font-semibold">Снимки (хронология)</h2>
          {images.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">Снимков по образованию пока нет.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {images.map((img) => {
                const v = visitById(img.visitId);
                const isActive = activeImageId === img.id;
                const isCompare = compareIds.includes(img.id);
                return (
                  <li key={img.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                        <span className="font-medium tabular-nums">{img.id}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{IMAGE_KIND[img.kind]}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{IMAGE_SOURCE[img.source]}</span>
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {formatDateTime(img.capturedAt)}
                        {img.deviceId && <> · устройство {img.deviceId}</>}
                        {v && <> · визит {formatDate(v.startedAt)} ({VISIT_STATUS[v.status]})</>}
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        Качество: {(img.quality.score * 100).toFixed(0)}%
                        {img.quality.issues.length > 0 && (
                          <> · замечания: {img.quality.issues.join(", ")}</>
                        )}
                      </div>
                      {(isActive || isCompare) && (
                        <div className="mt-1 text-[11px]" style={{ color: "hsl(var(--info))" }}>
                          {isActive && "Открыт в просмотрщике (демо). "}
                          {isCompare && "Добавлен к сравнению (демо)."}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        aria-pressed={isActive}
                        className="min-h-[44px] sm:min-h-[32px]"
                        onClick={() => setActiveImageId((prev) => (prev === img.id ? null : img.id))}
                      >
                        Открыть снимок (демо)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={isCompare ? "default" : "outline"}
                        aria-pressed={isCompare}
                        className="min-h-[44px] sm:min-h-[32px]"
                        onClick={() => toggleCompare(img.id)}
                      >
                        Сравнить (демо)
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {orphanVisits.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
              style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.30)", color: "hsl(var(--warning))" }}>
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Структурированная оценка не зафиксирована для визитов:{" "}
                {orphanVisits
                  .map((vid) => {
                    const v = visitById(vid);
                    return v ? formatDate(v.startedAt) : vid;
                  })
                  .join(", ")}.
              </span>
            </p>
          )}
        </Card>

        <Card className="p-3 sm:p-4">
          <h2 className="text-[13px] font-semibold">Оценки (хронология)</h2>
          {assessments.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">Оценок по образованию пока нет.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {assessments.map((a) => {
                const v = visitById(a.visitId);
                const clinic = v ? getClinicById(v.clinicId)?.name ?? "—" : "—";
                return (
                  <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="font-medium tabular-nums">{a.id}</span>
                        <span className="text-muted-foreground">{formatDateTime(a.decidedAt)}</span>
                        <RiskBadge level={a.aiSupport.riskLevel} />
                        <span className="text-[11px] text-muted-foreground">
                          AI · уверенность {(a.aiSupport.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        ABCD/TDS: <span className="tabular-nums">{a.abcd.total.toFixed(1)}</span>
                        {" · "}7-point: <span className="tabular-nums">{a.sevenPoint.total}</span>
                        {v && <> · {clinic} · {VISIT_STATUS[v.status]}</>}
                      </div>
                      <p className="mt-1 text-[13px]">{a.doctorConclusion}</p>
                      <p className="text-[12px] text-muted-foreground">План: {a.followUpPlan}</p>
                      <p className="mt-1 text-[11px] italic text-muted-foreground">{a.aiSupport.disclaimer}</p>
                    </div>
                    {v && (
                      <Button asChild size="sm" variant="outline" className="shrink-0 min-h-[44px] sm:min-h-[32px]">
                        <Link to={`/patients/${patient.id}/visits/${v.id}`}>К визиту</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <BodyMapDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        figure={pickFigure(patient.sex, calcAge(patient.birthDate))}
        view={lesion.mapPoint.view}
        x={lesion.mapPoint.x}
        y={lesion.mapPoint.y}
        bodyZone={lesion.bodyZone}
        label={lesion.label}
      />
    </div>
  );
}
