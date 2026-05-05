import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Image as ImageIcon, ClipboardList, MapPin, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/clinical/RiskBadge";
import { formatDate, formatDateTime } from "@/lib/format";
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

const NotFound = ({ title, hint }: { title: string; hint: string }) => (
  <div className="flex h-full flex-col">
    <PageHeader title={title} subtitle={hint} />
    <div className="p-4">
      <Button asChild size="sm" variant="secondary" className="h-8 text-[12px]">
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

  if (!patient) {
    return <NotFound title="Пациент не найден" hint="Карточка пациента отсутствует в демо-данных." />;
  }
  if (!lesion || lesion.patientId !== patient.id) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Образование не найдено" subtitle="Запись отсутствует или не принадлежит пациенту." />
        <div className="p-4">
          <Button asChild size="sm" variant="secondary" className="h-8 text-[12px]">
            <Link to={`/patients/${patient.id}`}>К карточке пациента</Link>
          </Button>
        </div>
      </div>
    );
  }

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
          <Button asChild size="sm" variant="secondary" className="h-8 text-[12px]">
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

  const toggleCompare = (imgId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(imgId)) return prev.filter((x) => x !== imgId);
      const next = [...prev, imgId];
      return next.slice(-2); // максимум 2 для сравнения
    });
  };

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
              <div className="mt-1 text-[13px]">{lesion.bodyZone}</div>
              <div className="text-[12px] text-muted-foreground">
                Проекция: {VIEW_LABEL[lesion.mapPoint.view]} · x{(lesion.mapPoint.x * 100).toFixed(0)}% / y{(lesion.mapPoint.y * 100).toFixed(0)}%
              </div>
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
    </div>
  );
}
