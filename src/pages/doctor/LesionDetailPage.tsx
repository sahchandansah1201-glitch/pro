import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Crosshair,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  Minus,
  MoveDown,
  MoveLeft,
  MoveRight,
  MoveUp,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  StickyNote,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
import {
  buildLesionComparisonDraftKey,
  clearLesionComparisonDraft,
  createLesionComparisonDecisionDraft,
  loadLesionComparisonDraft,
  saveLesionComparisonDraft,
  type LesionComparisonAction,
  type LesionComparisonDecisionDraft,
} from "@/lib/lesion-comparison-drafts";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import {
  downloadSelfHostedProtectedLesionImage,
  getSelfHostedLesionLongitudinalQa,
  reviewSelfHostedLesionComparisonMeasurementPolicy,
  reviewSelfHostedLesionComparisonProductionAnalysisPolicy,
  reviewSelfHostedLesionComparisonReviewerAssignment,
  reviewSelfHostedLesionComparisonViewerQaReviewerWorkflow,
  reviewSelfHostedLesionComparisonViewerQa,
  SAFE_LESION_LONGITUDINAL_QA_BOUNDARIES,
  saveSelfHostedLesionComparisonDraft,
  saveSelfHostedLesionComparisonViewerQa,
  type SelfHostedLesionLongitudinalQaAction,
  type SelfHostedLesionLongitudinalQaDTO,
} from "@/lib/self-hosted-clinical-workspace-api";
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
type ComparisonAction = LesionComparisonAction;
type ComparisonDraftStatus = "idle" | "loaded" | "saved" | "cleared";
type ComparisonBackendDraftStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type ViewerQaBackendStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type ViewerQaReviewBackendStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type ViewerQaReviewStatus = "technical_ready" | "needs_recapture" | "not_suitable_for_comparison";
type ViewerQaReviewerWorkflowBackendStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type ViewerQaReviewerWorkflowStatus = "ready_for_reviewer" | "reviewer_accepted" | "reviewer_rejected";
type MeasurementPolicyBackendStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type MeasurementPolicyStatus = "not_approved" | "review_required" | "approved_for_technical_review";
type ProductionAnalysisPolicyBackendStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type ProductionAnalysisPolicyStatus = "not_approved" | "review_required" | "approved_for_production_analysis";
type ReviewerAssignmentBackendStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type ReviewerAssignmentStatus =
  | "unassigned"
  | "assigned"
  | "second_review_required"
  | "second_review_assigned"
  | "second_review_completed"
  | "assignment_blocked";
type SecondReviewStatus = "not_required" | "required" | "assigned" | "completed" | "blocked";
type ProtectedRenderStatus = "idle" | "loading" | "ready" | "error";
type LongitudinalQaLoadStatus = "idle" | "loading" | "loaded" | "error";
type ProtectedRenderReadinessItem = {
  label: string;
  ready: boolean;
  detail: string;
};
type CaptureConditionCheck = {
  label: string;
  ready: boolean;
  detail: string;
};
type CalibrationReadinessCheck = {
  label: string;
  ready: boolean;
  detail: string;
};
type TechnicalGeometryMarker = {
  target: "A" | "B";
  x: number;
  y: number;
};
type ViewerQaSavePayload = {
  technicalMarkers: TechnicalGeometryMarker[];
  calibrationStatus: "ready" | "not_ready" | "limited";
  calibrationReasons: string[];
  captureMetadataStatus: "ready" | "needs_review" | "missing";
};
type ViewerQaReviewPayload = ViewerQaSavePayload & {
  reviewStatus: ViewerQaReviewStatus;
  reviewReasons: string[];
};
type ViewerQaReviewerWorkflowPayload = ViewerQaSavePayload & {
  workflowStatus: ViewerQaReviewerWorkflowStatus;
  workflowReasons: string[];
};
type MeasurementPolicyPayload = ViewerQaSavePayload & {
  measurementPolicyStatus: MeasurementPolicyStatus;
  measurementPolicyReasons: string[];
};
type ProductionAnalysisPolicyPayload = ViewerQaSavePayload & {
  productionAnalysisPolicyStatus: ProductionAnalysisPolicyStatus;
  productionAnalysisPolicyReasons: string[];
};
type ReviewerAssignmentPayload = ViewerQaSavePayload & {
  assignmentStatus: ReviewerAssignmentStatus;
  assignmentReasons: string[];
  assignedReviewerUserId: string | null;
  secondReviewStatus: SecondReviewStatus;
  secondReviewReasons: string[];
  secondReviewerUserId: string | null;
};
type ComparisonOverlay = "grid" | "center" | "off";
type ComparisonViewport = {
  zoom: number;
  panX: number;
  panY: number;
  overlay: ComparisonOverlay;
};
type ComparisonWorkflowStep = {
  key: string;
  label: string;
  done: boolean;
  statusLabel: string;
  nextActionLabel: string;
  actionLabel: string;
  actionHref: string;
};
type LongitudinalVisitGroup = {
  visitId: string;
  visit: Visit | null;
  date: string;
  images: ClinicalImage[];
  assessmentCount: number;
  bestQuality: number;
  devices: string[];
  kinds: string[];
  sources: string[];
};
type LongitudinalPairStatus = "ready" | "warning" | "blocked";
type LongitudinalPair = {
  id: string;
  previous: LongitudinalVisitGroup;
  current: LongitudinalVisitGroup;
  previousImage: ClinicalImage;
  currentImage: ClinicalImage;
  status: LongitudinalPairStatus;
  reasons: string[];
};

const COMPARISON_ACTION_LABEL: Record<ComparisonAction, string> = {
  retake: "Переснимок запрошен",
  excluded: "Пара исключена из сравнения",
  report_limit: "Ограничение добавлено в черновик отчёта",
};

const COMPARISON_ACTIONS: Array<{
  action: ComparisonAction;
  label: string;
  icon: typeof RefreshCw;
  variant: "outline" | "secondary";
}> = [
  { action: "retake", label: "Запросить переснимок", icon: RefreshCw, variant: "outline" },
  { action: "excluded", label: "Исключить из сравнения", icon: XCircle, variant: "outline" },
  { action: "report_limit", label: "Добавить ограничение в отчёт", icon: FileText, variant: "secondary" },
];

const COMPARISON_OVERLAY_LABEL: Record<ComparisonOverlay, string> = {
  grid: "сетка",
  center: "центр",
  off: "скрыта",
};
const TECHNICAL_GEOMETRY_PRESETS: Record<TechnicalGeometryMarker["target"], TechnicalGeometryMarker> = {
  A: { target: "A", x: 48, y: 52 },
  B: { target: "B", x: 52, y: 52 },
};
const LONGITUDINAL_PAIR_LABEL: Record<LongitudinalPairStatus, string> = {
  ready: "Сопоставимо",
  warning: "Сопоставимо с предупреждением",
  blocked: "Не сопоставимо",
};
const VIEWER_QA_REVIEW_LABEL: Record<ViewerQaReviewStatus, string> = {
  technical_ready: "Технически готово",
  needs_recapture: "Нужен переснимок",
  not_suitable_for_comparison: "Не использовать для динамики",
};
const VIEWER_QA_REVIEWER_WORKFLOW_LABEL: Record<ViewerQaReviewerWorkflowStatus, string> = {
  ready_for_reviewer: "Готово к reviewer workflow",
  reviewer_accepted: "Reviewer workflow принят",
  reviewer_rejected: "Reviewer workflow отклонён",
};
const MEASUREMENT_POLICY_LABEL: Record<MeasurementPolicyStatus, string> = {
  not_approved: "Policy не утверждена",
  review_required: "Нужен разбор policy",
  approved_for_technical_review: "Policy утверждена для техreview",
};
const PRODUCTION_ANALYSIS_POLICY_LABEL: Record<ProductionAnalysisPolicyStatus, string> = {
  not_approved: "Analysis policy не утверждена",
  review_required: "Нужен разбор analysis policy",
  approved_for_production_analysis: "Analysis policy утверждена",
};
const REVIEWER_ASSIGNMENT_LABEL: Record<ReviewerAssignmentStatus, string> = {
  unassigned: "Reviewer не назначен",
  assigned: "Reviewer назначен",
  second_review_required: "Нужен второй review",
  second_review_assigned: "Second reviewer назначен",
  second_review_completed: "Second review закрыт",
  assignment_blocked: "Назначение заблокировано",
};
const SECOND_REVIEW_LABEL: Record<SecondReviewStatus, string> = {
  not_required: "Second review не требуется",
  required: "Second review требуется",
  assigned: "Second reviewer назначен",
  completed: "Second review завершён",
  blocked: "Second review заблокирован",
};
const REVIEWER_ASSIGNMENT_PRIMARY_ID = "10000000-0000-4000-8000-000000000201";
const REVIEWER_ASSIGNMENT_SECOND_ID = "10000000-0000-4000-8000-000000000202";
const LONGITUDINAL_QA_STATUS_LABEL: Record<SelfHostedLesionLongitudinalQaDTO["readiness"]["status"], string> = {
  blocked: "Динамика заблокирована",
  needs_review: "Нужен технический review",
  technical_ready: "Технический gate готов",
};
const LONGITUDINAL_QA_ACTION_LABEL: Record<SelfHostedLesionLongitudinalQaAction, string> = {
  review_queue: "Разобрать очередь viewer QA",
  request_recapture: "Запросить переснимок",
  exclude_from_dynamic_review: "Исключить из динамического разбора",
  verify_production_asset: "Проверить production assets",
  complete_capture_metadata: "Дозаполнить metadata съёмки",
  complete_device_metadata: "Дозаполнить device metadata",
  check_device_bridge: "Проверить Device Bridge",
  complete_capture_protocol: "Дозаполнить протокол съёмки",
  complete_calibration: "Закрыть калибровку",
  place_markers: "Поставить технические маркеры",
  approve_measurement_policy: "Утвердить policy измерений",
  approve_production_analysis_policy: "Утвердить analysis policy",
  assign_reviewer: "Назначить reviewer",
  complete_second_review: "Закрыть second review",
  continue_review: "Продолжить врачебный разбор",
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const formatPan = (value: number) => (value > 0 ? `+${value}` : `${value}`);
const compactList = (values: string[]) => (values.length > 0 ? values.join(", ") : "—");
const formatGeometryMarker = (marker: TechnicalGeometryMarker) => `${marker.target} x${marker.x} y${marker.y}`;
const imageDisplayLabel = (image: ClinicalImage, marker?: "A" | "B") =>
  marker ? `Снимок ${marker}` : `Снимок ${formatDate(image.capturedAt)}`;
const imageDisplayMeta = (image: ClinicalImage) =>
  `${formatDateTime(image.capturedAt)} · ${IMAGE_KIND[image.kind]} · ${image.deviceId ?? "без устройства"}`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | null | undefined) => UUID_PATTERN.test(String(value || ""));
const createPreviewObjectUrl = (blob: Blob) =>
  typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : "";
const revokePreviewUrls = (urls: Record<string, string>) => {
  if (typeof URL.revokeObjectURL !== "function") return;
  Object.values(urls).forEach((url) => {
    if (url) URL.revokeObjectURL(url);
  });
};

function uniqueReasons(reasons: string[]) {
  return Array.from(new Set(reasons.filter(Boolean)));
}

function viewerQaReviewReasons({
  status,
  captureReady,
  calibrationReady,
  markerCount,
}: {
  status: ViewerQaReviewStatus;
  captureReady: boolean;
  calibrationReady: boolean;
  markerCount: number;
}) {
  if (status === "technical_ready") return ["technical_review_ready"];
  const blockers = [
    !captureReady ? "repeat_capture_required" : null,
    !calibrationReady ? "calibration_not_ready" : null,
    markerCount < 2 ? "technical_markers_missing" : null,
  ].filter((item): item is string => Boolean(item));
  if (status === "needs_recapture") return uniqueReasons(blockers.length > 0 ? blockers : ["repeat_capture_required"]);
  return uniqueReasons(["dynamic_comparison_disabled", ...blockers]);
}

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

function minutesBetween(imageA: ClinicalImage, imageB: ClinicalImage) {
  const a = Date.parse(imageA.capturedAt);
  const b = Date.parse(imageB.capturedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round(Math.abs(a - b) / 60000);
}

function captureConditionChecks(imageA: ClinicalImage, imageB: ClinicalImage): CaptureConditionCheck[] {
  const deviceA = imageA.deviceId ?? "без устройства";
  const deviceB = imageB.deviceId ?? "без устройства";
  const minQuality = Math.min(imageA.quality.score, imageB.quality.score);
  const qualityIssues = Array.from(new Set([...imageA.quality.issues, ...imageB.quality.issues]));
  const intervalMinutes = minutesBetween(imageA, imageB);

  return [
    {
      label: "Тип снимка",
      ready: imageA.kind === imageB.kind,
      detail: imageA.kind === imageB.kind
        ? `один тип снимка: ${IMAGE_KIND[imageA.kind]}`
        : `разный тип снимка: ${IMAGE_KIND[imageA.kind]} / ${IMAGE_KIND[imageB.kind]}`,
    },
    {
      label: "Источник",
      ready: imageA.source === imageB.source,
      detail: imageA.source === imageB.source
        ? `один источник: ${IMAGE_SOURCE[imageA.source]}`
        : `разные источники: ${IMAGE_SOURCE[imageA.source]} / ${IMAGE_SOURCE[imageB.source]}`,
    },
    {
      label: "Устройство",
      ready: deviceA === deviceB,
      detail: deviceA === deviceB ? `одно устройство: ${deviceA}` : `${deviceA} / ${deviceB}`,
    },
    {
      label: "Интервал",
      ready: intervalMinutes !== null && intervalMinutes <= 10,
      detail: intervalMinutes === null ? "нет времени съёмки" : `${intervalMinutes} мин между снимками`,
    },
    {
      label: "Качество",
      ready: minQuality >= 0.8,
      detail: `минимум ${Math.round(minQuality * 100)}%`,
    },
    {
      label: "Замечания качества",
      ready: qualityIssues.length === 0,
      detail: qualityIssues.length === 0 ? "нет замечаний качества" : qualityIssues.join(", "),
    },
  ];
}

const imageFrameSize = (image: ClinicalImage) => `${image.exifMeta.width}×${image.exifMeta.height}`;

function calibrationReadinessChecks(imageA: ClinicalImage, imageB: ClinicalImage): CalibrationReadinessCheck[] {
  const deviceA = imageA.deviceId ?? "без устройства";
  const deviceB = imageB.deviceId ?? "без устройства";
  const sameDevice = Boolean(imageA.deviceId && imageB.deviceId && imageA.deviceId === imageB.deviceId);
  const frameSizeA = imageFrameSize(imageA);
  const frameSizeB = imageFrameSize(imageB);
  const sameFrameSize = frameSizeA === frameSizeB;
  const scaleMarkerReady = imageA.viewerCalibration?.scaleMarkerDetected === true
    && imageB.viewerCalibration?.scaleMarkerDetected === true;
  const millimetersReady = imageA.viewerCalibration?.millimetersAvailable === true
    && imageB.viewerCalibration?.millimetersAvailable === true
    && scaleMarkerReady;

  return [
    {
      label: "Профиль устройства",
      ready: sameDevice,
      detail: sameDevice ? `одно устройство: ${deviceA}` : `${deviceA} / ${deviceB}`,
    },
    {
      label: "Размер кадра",
      ready: sameFrameSize,
      detail: sameFrameSize ? `один размер: ${frameSizeA}` : `${frameSizeA} / ${frameSizeB}`,
    },
    {
      label: "Масштабная шкала",
      ready: scaleMarkerReady,
      detail: scaleMarkerReady ? "шкала обнаружена" : "шкала не обнаружена",
    },
    {
      label: "Миллиметры",
      ready: millimetersReady,
      detail: millimetersReady ? "мм доступны для viewer QA" : "мм недоступны",
    },
  ];
}

function calibrationReasonCode(item: CalibrationReadinessCheck): string {
  if (item.label === "Профиль устройства") return "device_profile_mismatch";
  if (item.label === "Размер кадра") return "frame_size_mismatch";
  if (item.label === "Масштабная шкала") return "scale_marker_missing";
  if (item.label === "Миллиметры") return "millimeters_unavailable";
  return "calibration_limited";
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
      label: "Снимок",
      a: imageDisplayLabel(imageA, "A"),
      b: imageDisplayLabel(imageB, "B"),
      result: "Внутренний ID скрыт",
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

function buildLongitudinalVisitGroups(
  images: ClinicalImage[],
  visits: Visit[],
  assessments: ReturnType<typeof getAssessmentsByLesionId>,
): LongitudinalVisitGroup[] {
  const visitMap = new Map(visits.map((visit) => [visit.id, visit]));
  const assessmentCounts = new Map<string, number>();
  for (const assessment of assessments) {
    assessmentCounts.set(assessment.visitId, (assessmentCounts.get(assessment.visitId) ?? 0) + 1);
  }

  const byVisit = new Map<string, ClinicalImage[]>();
  for (const image of images) {
    const group = byVisit.get(image.visitId) ?? [];
    group.push(image);
    byVisit.set(image.visitId, group);
  }

  return Array.from(byVisit.entries())
    .map(([visitId, groupImages]) => {
      const visit = visitMap.get(visitId) ?? null;
      const sortedImages = [...groupImages].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      const date = visit?.startedAt ?? sortedImages[0]?.capturedAt ?? "";
      const bestQuality = sortedImages.reduce((best, image) => Math.max(best, image.quality.score), 0);
      return {
        visitId,
        visit,
        date,
        images: sortedImages,
        assessmentCount: assessmentCounts.get(visitId) ?? 0,
        bestQuality,
        devices: Array.from(new Set(sortedImages.map((image) => image.deviceId ?? "без устройства"))),
        kinds: Array.from(new Set(sortedImages.map((image) => IMAGE_KIND[image.kind]))),
        sources: Array.from(new Set(sortedImages.map((image) => IMAGE_SOURCE[image.source]))),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildLongitudinalPairs(groups: LongitudinalVisitGroup[]): LongitudinalPair[] {
  const pairs: LongitudinalPair[] = [];
  for (let index = 1; index < groups.length; index += 1) {
    const previous = groups[index - 1];
    const current = groups[index];
    for (const currentImage of current.images) {
      const previousImage = previous.images.find(
        (candidate) =>
          candidate.kind === currentImage.kind
          && candidate.source === currentImage.source
          && (candidate.deviceId ?? "без устройства") === (currentImage.deviceId ?? "без устройства"),
      );
      if (!previousImage) continue;

      const comparedImages = [previousImage, currentImage];
      const lowQuality = comparedImages.some((image) => image.quality.score < 0.75);
      const hasQualityIssues = comparedImages.some((image) => image.quality.issues.length > 0);
      const status: LongitudinalPairStatus = lowQuality ? "blocked" : hasQualityIssues ? "warning" : "ready";
      const reasons = [
        lowQuality ? "Качество ниже порога" : null,
        hasQualityIssues ? "Есть технические замечания" : null,
        status === "ready" ? "Условия повторяемы" : null,
      ].filter((reason): reason is string => Boolean(reason));

      pairs.push({
        id: `${previousImage.id}:${currentImage.id}`,
        previous,
        current,
        previousImage,
        currentImage,
        status,
        reasons,
      });
    }
  }
  return pairs;
}

function buildLocalLongitudinalQaGate({
  patientId,
  lesion,
  groups,
  pairs,
}: {
  patientId: string;
  lesion: Lesion;
  groups: LongitudinalVisitGroup[];
  pairs: LongitudinalPair[];
}): SelfHostedLesionLongitudinalQaDTO {
  const imageCount = groups.reduce((sum, group) => sum + group.images.length, 0);
  const technicalReadyPairCount = pairs.filter((pair) => pair.status === "ready").length;
  const needsRecaptureCount = pairs.filter((pair) => pair.status === "warning" || pair.status === "blocked").length;
  const notSuitableForComparisonCount = pairs.filter((pair) => pair.status === "blocked").length;
  const unreviewedPairCount = pairs.filter((pair) => pair.status === "warning").length;
  const candidatePairCount = pairs.length;
  const calibrationBlockedCount = needsRecaptureCount;
  const markerMissingCount = needsRecaptureCount;
  const status: SelfHostedLesionLongitudinalQaDTO["readiness"]["status"] =
    candidatePairCount === 0 || needsRecaptureCount > 0 || calibrationBlockedCount > 0 || markerMissingCount > 0
      ? "blocked"
      : unreviewedPairCount > 0
        ? "needs_review"
        : "technical_ready";
  const technicalRolloutReady = status === "technical_ready" && candidatePairCount > 0;
  const blockers: SelfHostedLesionLongitudinalQaDTO["blockers"] = [
    candidatePairCount === 0
      ? { code: "no_candidate_pairs", label: "Нет пар для продольного QA", count: 1, nextAction: "review_queue" }
      : null,
    needsRecaptureCount > 0
      ? { code: "recapture_required", label: "Нужен переснимок", count: needsRecaptureCount, nextAction: "request_recapture" }
      : null,
    notSuitableForComparisonCount > 0
      ? {
        code: "not_suitable_for_comparison",
        label: "Не использовать для динамики",
        count: notSuitableForComparisonCount,
        nextAction: "exclude_from_dynamic_review",
      }
      : null,
    unreviewedPairCount > 0
      ? { code: "unreviewed_pairs", label: "Нужен технический review", count: unreviewedPairCount, nextAction: "review_queue" }
      : null,
    calibrationBlockedCount > 0
      ? { code: "calibration_not_ready", label: "Калибровка не готова", count: calibrationBlockedCount, nextAction: "complete_calibration" }
      : null,
    markerMissingCount > 0
      ? { code: "technical_markers_missing", label: "Не хватает технических маркеров", count: markerMissingCount, nextAction: "place_markers" }
      : null,
  ].filter((item): item is SelfHostedLesionLongitudinalQaDTO["blockers"][number] => Boolean(item));
  const nextActions = blockers.length > 0
    ? Array.from(new Set(blockers.map((blocker) => blocker.nextAction)))
    : (["continue_review"] as SelfHostedLesionLongitudinalQaAction[]);

  return {
    clinicId: null,
    patientId,
    lesionId: lesion.id,
    label: lesion.label,
    readiness: {
      status,
      visitCount: groups.length,
      imageCount,
      candidatePairCount,
      reviewedPairCount: candidatePairCount,
      technicalReadyPairCount,
      needsRecaptureCount,
      notSuitableForComparisonCount,
      unreviewedPairCount,
      productionAssetNotReadyCount: 0,
      missingCaptureMetadataCount: 0,
      deviceEvidenceNotReadyCount: 0,
      deviceBridgeQualityNotReadyCount: 0,
      captureProtocolNotReadyCount: 0,
      calibrationBlockedCount,
      markerMissingCount,
      measurementPolicyNotReadyCount: 0,
      productionAnalysisPolicyNotReadyCount: 0,
      reviewerAssignmentNotReadyCount: 0,
      secondReviewNotReadyCount: 0,
      technicalRolloutReady,
      dynamicConclusionAllowed: false,
    },
    blockers,
    nextActions,
    boundaries: SAFE_LESION_LONGITUDINAL_QA_BOUNDARIES,
  };
}

function LongitudinalHistorySection({
  groups,
  pairs,
}: {
  groups: LongitudinalVisitGroup[];
  pairs: LongitudinalPair[];
}) {
  const totalImages = groups.reduce((count, group) => count + group.images.length, 0);
  const comparablePairs = pairs.filter((pair) => pair.status !== "blocked").length;
  const blockedPairs = pairs.filter((pair) => pair.status === "blocked").length;

  return (
    <Card className="p-3 sm:p-4">
      <section aria-label="Продольная история очага">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold">Продольная история очага</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Технический обзор снимков одного ID между визитами. Не является оценкой динамики или клиническим выводом.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
            Выдача пациенту: выключена
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Визиты</div>
            <div className="mt-1 font-medium">Визитов с фото: {groups.length}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Снимки</div>
            <div className="mt-1 font-medium">Снимков: {totalImages}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Пары</div>
            <div className="mt-1 font-medium">Сопоставимых пар: {comparablePairs}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Ограничения</div>
            <div className="mt-1 font-medium">Ограничений: {blockedPairs}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
          <div className="min-w-0 rounded-md border border-border bg-background p-2">
            <h3 className="text-[12px] font-semibold">Визиты с фото</h3>
            <ul className="mt-2 divide-y divide-border">
              {groups.map((group) => (
                <li key={group.visitId} className="grid gap-1 py-2 text-[12px] sm:grid-cols-[120px_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <div className="font-mono text-[12px]">{group.visitId}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDate(group.date)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5">
                        Снимков: {group.images.length}
                      </span>
                      <span className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5">
                        Оценок: {group.assessmentCount}
                      </span>
                      <span className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5">
                        Лучшее качество: {Math.round(group.bestQuality * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {compactList(group.kinds)} · {compactList(group.sources)} · {compactList(group.devices)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 rounded-md border border-border bg-background p-2">
            <h3 className="text-[12px] font-semibold">Пары между визитами</h3>
            {pairs.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Недостаточно повторяемых условий, чтобы собрать техническую пару.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {pairs.map((pair) => (
                  <li key={pair.id} className="rounded-sm border border-border bg-muted/20 p-2 text-[12px]">
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium">
                          {imageDisplayLabel(pair.previousImage)} → {imageDisplayLabel(pair.currentImage)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDate(pair.previous.date)} → {formatDate(pair.current.date)} · {IMAGE_KIND[pair.currentImage.kind]} · {pair.currentImage.deviceId ?? "без устройства"}
                        </div>
                      </div>
                      <span
                        className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${
                          pair.status === "ready"
                            ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                            : pair.status === "warning"
                              ? "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {LONGITUDINAL_PAIR_LABEL[pair.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pair.reasons.map((reason) => (
                        <span key={reason} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px]">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p
          className="mt-3 flex items-start gap-2 rounded-md border px-2 py-1.5 text-[12px]"
          style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.30)", color: "hsl(var(--warning))" }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Техническая история помогает выбрать пары для врачебного разбора. Не оценивайте динамику без повторяемых условий съёмки и врачебной проверки.
          </span>
        </p>
      </section>
    </Card>
  );
}

function LongitudinalQaGateSection({
  qa,
  canRefresh,
  loadStatus,
  message,
  onRefresh,
}: {
  qa: SelfHostedLesionLongitudinalQaDTO;
  canRefresh: boolean;
  loadStatus: LongitudinalQaLoadStatus;
  message: string;
  onRefresh: () => void;
}) {
  const readiness = qa.readiness;

  return (
    <Card className="p-3 sm:p-4">
      <section aria-label="Готовность продольного QA">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold">Готовность продольного QA</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Metadata-only gate перед любым разбором динамики. Не создаёт вывод о динамике.
            </p>
          </div>
          <span
            className={`rounded-sm border px-2 py-1 text-[11px] ${
              readiness.status === "technical_ready"
                ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                : readiness.status === "needs_review"
                  ? "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {LONGITUDINAL_QA_STATUS_LABEL[readiness.status]}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-10">
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Пары</div>
            <div className="mt-1 font-medium">Пар: {readiness.candidatePairCount}</div>
            <div className="text-[11px] text-muted-foreground">Визитов: {readiness.visitCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Готовые пары</div>
            <div className="mt-1 font-medium">Технически готово: {readiness.technicalReadyPairCount}</div>
            <div className="text-[11px] text-muted-foreground">Снимков: {readiness.imageCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Пересъёмка</div>
            <div className="mt-1 font-medium">Переснять: {readiness.needsRecaptureCount}</div>
            <div className="text-[11px] text-muted-foreground">Не использовать: {readiness.notSuitableForComparisonCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Metadata</div>
            <div className="mt-1 font-medium">Не хватает: {readiness.missingCaptureMetadataCount}</div>
            <div className="text-[11px] text-muted-foreground">Device: {readiness.deviceEvidenceNotReadyCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Assets</div>
            <div className="mt-1 font-medium">Проверить: {readiness.productionAssetNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Proxy-ready gate</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Bridge</div>
            <div className="mt-1 font-medium">Проверить: {readiness.deviceBridgeQualityNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Review: {readiness.unreviewedPairCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Protocol</div>
            <div className="mt-1 font-medium">Проверить: {readiness.captureProtocolNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Протокол съёмки</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Policy</div>
            <div className="mt-1 font-medium">Проверить: {readiness.measurementPolicyNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Измерения выключены</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Analysis</div>
            <div className="mt-1 font-medium">Проверить: {readiness.productionAnalysisPolicyNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Динамика выключена</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Калибровка</div>
            <div className="mt-1 font-medium">Ограничений: {readiness.calibrationBlockedCount}</div>
            <div className="text-[11px] text-muted-foreground">Маркеры: {readiness.markerMissingCount}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
          <div className="min-w-0 rounded-md border border-border bg-background p-2">
            <h3 className="text-[12px] font-semibold">Блокеры production QA</h3>
            {qa.blockers.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">Блокеров technical gate нет. Клинический вывод всё равно не создаётся.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {qa.blockers.map((blocker) => (
                  <li key={blocker.code} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-muted/20 px-2 py-1.5 text-[12px]">
                    <span className="font-medium">{blocker.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {blocker.count} · {LONGITUDINAL_QA_ACTION_LABEL[blocker.nextAction]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 rounded-md border border-border bg-background p-2">
            <h3 className="text-[12px] font-semibold">Действия</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {qa.nextActions.map((action) => (
                <span key={action} className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5 text-[11px]">
                  {LONGITUDINAL_QA_ACTION_LABEL[action]}
                </span>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 min-h-[44px] text-[12px] sm:min-h-[32px]"
              onClick={onRefresh}
              disabled={!canRefresh || loadStatus === "loading"}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Обновить production QA
            </Button>
            {message && <p className="mt-2 text-[12px] text-muted-foreground">{message}</p>}
          </div>
        </div>

        <p
          className="mt-3 flex items-start gap-2 rounded-md border px-2 py-1.5 text-[12px]"
          style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.30)", color: "hsl(var(--warning))" }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Вывод о динамике: выключен. Выдача пациенту: выключена. Медицинские измерения и клинические заключения доступны только после отдельного врачебного workflow.
          </span>
        </p>
      </section>
    </Card>
  );
}

function ComparisonImagePanel({
  image,
  marker,
  viewport,
  protectedImageUrl,
  geometryMarker,
}: {
  image: ClinicalImage;
  marker: "A" | "B";
  viewport: ComparisonViewport;
  protectedImageUrl?: string | null;
  geometryMarker?: TechnicalGeometryMarker;
}) {
  return (
    <section aria-label={`Снимок ${marker}`} className="min-w-0 rounded-md border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold">Снимок {marker}</div>
          <div className="text-[11px] text-muted-foreground">{imageDisplayMeta(image)}</div>
        </div>
        <span className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${imageQualityTone(image)}`}>
          {imageQualityLabel(image)} · {(image.quality.score * 100).toFixed(0)}%
        </span>
      </div>
      <div className="p-3">
        <div
          aria-label={`Панель просмотра ${marker}`}
          className="relative flex aspect-[4/3] min-h-[220px] items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30"
        >
          <div
            className="absolute inset-0 transition-transform duration-150"
            style={{
              transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
            }}
          >
            {protectedImageUrl ? (
              <img
                src={protectedImageUrl}
                alt={`Защищённый снимок ${marker}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:32px_32px]" />
                <div className="absolute inset-8 rounded-md border border-border/70 bg-background/75" />
                <div className="absolute left-[24%] top-[24%] h-[38%] w-[42%] rounded-[45%] border border-primary/40 bg-primary/10" />
                <div className="absolute right-[22%] top-[34%] h-10 w-10 rounded-full border border-risk-moderate/50 bg-risk-moderate-soft/60" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative z-10 flex max-w-[260px] flex-col items-center gap-2 rounded-md bg-background/90 px-3 py-2 text-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
                    <div className="text-[12px] font-medium">{IMAGE_KIND[image.kind]}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Исходный файл скрыт; доступны параметры снимка.
                    </div>
                  </div>
                </div>
              </>
            )}
            {geometryMarker && (
              <div
                aria-label={`Технический маркер ${geometryMarker.target} · x${geometryMarker.x} y${geometryMarker.y}`}
                className="pointer-events-none absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background/80 shadow-sm"
                style={{
                  left: `${geometryMarker.x}%`,
                  top: `${geometryMarker.y}%`,
                }}
              >
                <span className="absolute left-1/2 top-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 bg-primary/70" />
                <span className="absolute left-1/2 top-1/2 h-px w-10 -translate-x-1/2 -translate-y-1/2 bg-primary/70" />
                <span className="absolute -right-1 -top-1 rounded-sm bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {geometryMarker.target}
                </span>
              </div>
            )}
          </div>
          {viewport.overlay === "grid" && (
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--primary)/0.18)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--primary)/0.18)_1px,transparent_1px)] bg-[size:48px_48px]"
            />
          )}
          {viewport.overlay === "center" && (
            <div aria-hidden className="absolute inset-0">
              <div className="absolute left-1/2 top-0 h-full border-l border-primary/45" />
              <div className="absolute left-0 top-1/2 w-full border-t border-primary/45" />
              <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/45" />
            </div>
          )}
          <div className="absolute left-2 top-2 rounded-sm bg-background/90 px-1.5 py-0.5 text-[11px] font-semibold">
            {marker}
          </div>
          <div className="absolute bottom-2 right-2 rounded-sm bg-background/90 px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {Math.round(viewport.zoom * 100)}% · x{formatPan(viewport.panX)} / y{formatPan(viewport.panY)}
          </div>
        </div>
        <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Дата</dt>
            <dd className="mt-0.5 tabular-nums">{formatDateTime(image.capturedAt)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Источник</dt>
            <dd className="mt-0.5">{IMAGE_SOURCE[image.source]}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Устройство</dt>
            <dd className="mt-0.5">{image.deviceId ?? "без устройства"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Размер</dt>
            <dd className="mt-0.5 tabular-nums">
              {image.exifMeta.width}×{image.exifMeta.height}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function ComparisonActionButtons({
  onAction,
}: {
  onAction: (action: ComparisonAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COMPARISON_ACTIONS.map(({ action, label, icon: Icon, variant }) => (
        <Button
          key={action}
          type="button"
          size="sm"
          variant={variant}
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          onClick={() => onAction(action)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
        </Button>
      ))}
    </div>
  );
}

function ComparisonFullScreenDialog({
  open,
  onOpenChange,
  images,
  reasons,
  isComparable,
  action,
  onAction,
  onSaveDraft,
  canSaveDraft,
  draftStatus,
  onSaveViewerQa,
  viewerQaStatus,
  viewerQaMessage,
  onReviewViewerQa,
  viewerQaReviewStatus,
  viewerQaReviewMessage,
  technicalReviewReady,
  measurementPolicyStatus,
  onReviewMeasurementPolicy,
  measurementPolicyBackendStatus,
  measurementPolicyMessage,
  productionAnalysisPolicyStatus,
  onReviewProductionAnalysisPolicy,
  productionAnalysisPolicyBackendStatus,
  productionAnalysisPolicyMessage,
  reviewerAssignmentStatus,
  secondReviewStatus,
  onAssignReviewer,
  reviewerAssignmentBackendStatus,
  reviewerAssignmentMessage,
  onReviewViewerWorkflow,
  viewerQaReviewerWorkflowStatus,
  viewerQaReviewerWorkflowMessage,
  canLoadProtectedImages,
  protectedReadiness,
  protectedRenderStatus,
  protectedRenderMessage,
  protectedImageUrls,
  onLoadProtectedImages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: [ClinicalImage, ClinicalImage] | null;
  reasons: string[];
  isComparable: boolean;
  action: ComparisonAction | null;
  onAction: (action: ComparisonAction) => void;
  onSaveDraft: () => void;
  canSaveDraft: boolean;
  draftStatus: ComparisonDraftStatus;
  onSaveViewerQa: (payload: ViewerQaSavePayload) => void;
  viewerQaStatus: ViewerQaBackendStatus;
  viewerQaMessage: string;
  onReviewViewerQa: (payload: ViewerQaReviewPayload) => void;
  viewerQaReviewStatus: ViewerQaReviewBackendStatus;
  viewerQaReviewMessage: string;
  technicalReviewReady: boolean;
  measurementPolicyStatus: MeasurementPolicyStatus;
  onReviewMeasurementPolicy: (payload: MeasurementPolicyPayload) => void;
  measurementPolicyBackendStatus: MeasurementPolicyBackendStatus;
  measurementPolicyMessage: string;
  productionAnalysisPolicyStatus: ProductionAnalysisPolicyStatus;
  onReviewProductionAnalysisPolicy: (payload: ProductionAnalysisPolicyPayload) => void;
  productionAnalysisPolicyBackendStatus: ProductionAnalysisPolicyBackendStatus;
  productionAnalysisPolicyMessage: string;
  reviewerAssignmentStatus: ReviewerAssignmentStatus;
  secondReviewStatus: SecondReviewStatus;
  onAssignReviewer: (payload: ReviewerAssignmentPayload) => void;
  reviewerAssignmentBackendStatus: ReviewerAssignmentBackendStatus;
  reviewerAssignmentMessage: string;
  onReviewViewerWorkflow: (payload: ViewerQaReviewerWorkflowPayload) => void;
  viewerQaReviewerWorkflowStatus: ViewerQaReviewerWorkflowBackendStatus;
  viewerQaReviewerWorkflowMessage: string;
  canLoadProtectedImages: boolean;
  protectedReadiness: ProtectedRenderReadinessItem[];
  protectedRenderStatus: ProtectedRenderStatus;
  protectedRenderMessage: string;
  protectedImageUrls: Record<string, string>;
  onLoadProtectedImages: () => void;
}) {
  const [viewport, setViewport] = useState<ComparisonViewport>({ zoom: 1, panX: 0, panY: 0, overlay: "grid" });
  const [technicalNote, setTechnicalNote] = useState("");
  const [savedTechnicalNote, setSavedTechnicalNote] = useState("");
  const [geometryMarkers, setGeometryMarkers] = useState<TechnicalGeometryMarker[]>([]);
  const [calibrationLimitSaved, setCalibrationLimitSaved] = useState(false);
  const imageAId = images?.[0].id ?? "";
  const imageBId = images?.[1].id ?? "";

  useEffect(() => {
    setGeometryMarkers([]);
    setCalibrationLimitSaved(false);
  }, [imageAId, imageBId]);

  const updateZoom = (delta: number) => {
    setViewport((current) => ({ ...current, zoom: clamp(current.zoom + delta, 1, 3) }));
  };
  const updatePan = (panX: number, panY: number) => {
    setViewport((current) => ({
      ...current,
      panX: clamp(current.panX + panX, -72, 72),
      panY: clamp(current.panY + panY, -72, 72),
    }));
  };
  const resetViewport = () => {
    setViewport({ zoom: 1, panX: 0, panY: 0, overlay: "grid" });
  };
  const saveTechnicalNote = () => {
    const next = technicalNote.trim();
    if (!next) return;
    setSavedTechnicalNote(next);
  };
  const setGeometryMarker = (target: TechnicalGeometryMarker["target"]) => {
    const marker = TECHNICAL_GEOMETRY_PRESETS[target];
    setGeometryMarkers((current) => [...current.filter((item) => item.target !== target), marker]);
  };
  const currentViewerQaPayload = (): ViewerQaSavePayload => ({
      technicalMarkers: geometryMarkers,
      calibrationStatus: calibrationReady ? "ready" : "not_ready",
      calibrationReasons: calibrationChecks
        .filter((item) => !item.ready)
        .map(calibrationReasonCode),
      captureMetadataStatus: captureReady ? "ready" : "needs_review",
  });
  const saveViewerQa = () => {
    setCalibrationLimitSaved(true);
    onSaveViewerQa(currentViewerQaPayload());
  };
  const reviewViewerQa = (reviewStatus: ViewerQaReviewStatus) => {
    setCalibrationLimitSaved(true);
    onReviewViewerQa({
      ...currentViewerQaPayload(),
      reviewStatus,
      reviewReasons: viewerQaReviewReasons({
        status: reviewStatus,
        captureReady,
        calibrationReady,
        markerCount: geometryMarkers.length,
      }),
    });
  };
  const reviewViewerWorkflow = (workflowStatus: ViewerQaReviewerWorkflowStatus) => {
    setCalibrationLimitSaved(true);
    onReviewViewerWorkflow({
      ...currentViewerQaPayload(),
      workflowStatus,
      workflowReasons: workflowStatus === "reviewer_rejected"
        ? ["reviewer_workflow_rejected"]
        : ["calibrated_reviewer_workflow_ready"],
    });
  };
  const reviewMeasurementPolicy = (policyStatus: MeasurementPolicyStatus) => {
    setCalibrationLimitSaved(true);
    onReviewMeasurementPolicy({
      ...currentViewerQaPayload(),
      measurementPolicyStatus: policyStatus,
      measurementPolicyReasons: policyStatus === "approved_for_technical_review"
        ? ["technical_measurement_policy_approved_no_mm_output"]
        : ["measurement_policy_requires_review"],
    });
  };
  const reviewProductionAnalysisPolicy = (policyStatus: ProductionAnalysisPolicyStatus) => {
    setCalibrationLimitSaved(true);
    onReviewProductionAnalysisPolicy({
      ...currentViewerQaPayload(),
      productionAnalysisPolicyStatus: policyStatus,
      productionAnalysisPolicyReasons: policyStatus === "approved_for_production_analysis"
        ? ["production_analysis_policy_approved_no_dynamic_conclusion"]
        : ["production_analysis_policy_requires_review"],
    });
  };
  const assignReviewer = (mode: "primary" | "second_required" | "second_completed") => {
    setCalibrationLimitSaved(true);
    onAssignReviewer({
      ...currentViewerQaPayload(),
      assignmentStatus: mode === "primary" ? "assigned" : mode === "second_required" ? "second_review_required" : "second_review_completed",
      assignmentReasons: mode === "primary"
        ? ["primary_reviewer_assigned"]
        : ["second_review_required_for_clinical_grade_workflow"],
      assignedReviewerUserId: REVIEWER_ASSIGNMENT_PRIMARY_ID,
      secondReviewStatus: mode === "primary" ? "not_required" : mode === "second_required" ? "required" : "completed",
      secondReviewReasons: mode === "second_completed" ? ["second_review_completed_metadata_only"] : [],
      secondReviewerUserId: mode === "primary" ? null : REVIEWER_ASSIGNMENT_SECOND_ID,
    });
  };
  const markerFor = (target: TechnicalGeometryMarker["target"]) =>
    geometryMarkers.find((item) => item.target === target);
  if (!images) return null;
  const [imageA, imageB] = images;
  const captureChecks = captureConditionChecks(imageA, imageB);
  const captureReady = captureChecks.every((item) => item.ready);
  const calibrationChecks = calibrationReadinessChecks(imageA, imageB);
  const calibrationReady = calibrationChecks.every((item) => item.ready);
  const measurementPolicyApproved = measurementPolicyStatus === "approved_for_technical_review";
  const productionAnalysisPolicyApproved =
    productionAnalysisPolicyStatus === "approved_for_production_analysis";
  const reviewerAssigned =
    reviewerAssignmentStatus === "assigned"
    || reviewerAssignmentStatus === "second_review_assigned"
    || reviewerAssignmentStatus === "second_review_completed";
  const secondReviewReady = secondReviewStatus === "not_required" || secondReviewStatus === "completed";
  const reviewerWorkflowReady =
    technicalReviewReady
    && captureReady
    && calibrationReady
    && geometryMarkers.length === 2
    && measurementPolicyApproved
    && reviewerAssigned
    && secondReviewReady
    && productionAnalysisPolicyApproved;
  const protectedPreviewReady = !canLoadProtectedImages || protectedRenderStatus === "ready";
  const comparisonWorkflowSteps: ComparisonWorkflowStep[] = [
    {
      key: "protected-preview",
      label: "Превью",
      done: protectedPreviewReady,
      statusLabel: canLoadProtectedImages
        ? protectedRenderStatus === "ready" ? "готово" : "подготовить"
        : "не требуется",
      nextActionLabel: "Подготовить защищённые превью",
      actionLabel: "Открыть защищённые превью",
      actionHref: "#comparison-protected-preview",
    },
    {
      key: "capture",
      label: "Условия",
      done: captureReady,
      statusLabel: captureReady ? "повторяемы" : "нужен контроль",
      nextActionLabel: "Закрыть условия съёмки",
      actionLabel: "Открыть контроль условий",
      actionHref: "#comparison-capture-qa",
    },
    {
      key: "geometry",
      label: "Геометрия",
      done: geometryMarkers.length === 2,
      statusLabel: `маркеры ${geometryMarkers.length}/2`,
      nextActionLabel: "Поставить технические маркеры",
      actionLabel: "Открыть геометрию",
      actionHref: "#comparison-geometry",
    },
    {
      key: "calibration",
      label: "Калибровка",
      done: calibrationReady,
      statusLabel: calibrationReady ? "готова" : "не готова",
      nextActionLabel: "Закрыть калибровку viewer",
      actionLabel: "Открыть калибровку",
      actionHref: "#comparison-calibration",
    },
    {
      key: "technical-review",
      label: "Тех. review",
      done: technicalReviewReady,
      statusLabel: technicalReviewReady ? "готово" : "нужен review",
      nextActionLabel: "Зафиксировать технический review",
      actionLabel: "Открыть technical review",
      actionHref: "#comparison-technical-review",
    },
    {
      key: "measurement-policy",
      label: "Измерения",
      done: measurementPolicyApproved,
      statusLabel: measurementPolicyApproved ? "утверждена" : "ожидает",
      nextActionLabel: "Утвердить policy измерений",
      actionLabel: "Открыть policy измерений",
      actionHref: "#comparison-measurement-policy",
    },
    {
      key: "reviewer",
      label: "Reviewer",
      done: reviewerAssigned && secondReviewReady,
      statusLabel: reviewerAssigned ? "назначен" : "ожидает",
      nextActionLabel: "Назначить reviewer",
      actionLabel: "Открыть назначение reviewer",
      actionHref: "#comparison-reviewer-assignment",
    },
    {
      key: "analysis-policy",
      label: "Анализ",
      done: productionAnalysisPolicyApproved,
      statusLabel: productionAnalysisPolicyApproved ? "утверждена" : "выключена",
      nextActionLabel: "Закрыть analysis policy",
      actionLabel: "Открыть analysis policy",
      actionHref: "#comparison-analysis-policy",
    },
  ];
  const completedComparisonSteps = comparisonWorkflowSteps.filter((step) => step.done).length;
  const currentComparisonStepIndex = comparisonWorkflowSteps.findIndex((step) => !step.done);
  const currentComparisonStep =
    currentComparisonStepIndex >= 0
      ? comparisonWorkflowSteps[currentComparisonStepIndex]
      : {
          key: "workflow-ready",
          label: "Итог",
          done: reviewerWorkflowReady,
          statusLabel: reviewerWorkflowReady ? "готов" : "проверьте workflow",
          nextActionLabel: "Проверить итог reviewer workflow",
          actionLabel: "Открыть итог workflow",
          actionHref: "#comparison-workflow-gate",
        };
  const firstCaptureBlocker = captureChecks.find((item) => !item.ready);
  const firstCalibrationBlocker = calibrationChecks.find((item) => !item.ready);
  const firstComparisonBlocker =
    !protectedPreviewReady
      ? "Защищённые превью · подготовьте превью врача"
      : firstCaptureBlocker
        ? `${firstCaptureBlocker.label} · ${firstCaptureBlocker.detail}`
        : geometryMarkers.length < 2
          ? `Технические маркеры · осталось ${2 - geometryMarkers.length}`
          : firstCalibrationBlocker
            ? `${firstCalibrationBlocker.label} · ${firstCalibrationBlocker.detail}`
            : !technicalReviewReady
              ? "Технический review · нажмите «Технически готово»"
              : !measurementPolicyApproved
                ? "Policy измерений · нужна technical policy"
                : !reviewerAssigned
                  ? "Reviewer · назначьте reviewer"
                  : !secondReviewReady
                    ? "Second review · закройте второй просмотр"
                    : !productionAnalysisPolicyApproved
                      ? "Analysis policy · вывод о динамике остаётся выключен"
                      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-24px)] w-[calc(100vw-24px)] max-w-[1240px] overflow-y-auto p-3 sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-[14px]">Полноэкранное сравнение</DialogTitle>
          <DialogDescription className="text-[12px]">
            Крупное A/B-сравнение выбранной пары очага. Это технический режим проверки условий съёмки.
          </DialogDescription>
        </DialogHeader>

        <section
          role="region"
          aria-label="Рабочий шаг сравнения"
          className="mb-3 rounded-md border border-border bg-muted/20 p-2.5"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Что делать сейчас</p>
              <h3 className="mt-1 text-[13px] font-semibold">
                Следующий шаг: {currentComparisonStep.nextActionLabel}
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Ближайшее действие: <span className="font-medium text-foreground">{currentComparisonStep.actionLabel}</span>.
                Динамический вывод выключен, измерения выключены, выдача пациенту выключена.
              </p>
              {firstComparisonBlocker && (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Первое ограничение: {firstComparisonBlocker}
                </p>
              )}
            </div>
            <div className="flex min-w-[180px] flex-col items-start gap-2 lg:items-end">
              <span className="rounded-sm border border-border bg-background px-2 py-1 text-[12px] font-medium">
                Прогресс проверки: {completedComparisonSteps}/{comparisonWorkflowSteps.length}
              </span>
              <Button asChild size="sm" className="h-8 text-[12px]">
                <a href={currentComparisonStep.actionHref}>{currentComparisonStep.actionLabel}</a>
              </Button>
            </div>
          </div>
          <ol className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8" aria-label="Этапы сравнения снимков">
            {comparisonWorkflowSteps.map((step, index) => {
              const state = step.done ? "done" : index === currentComparisonStepIndex ? "current" : "locked";
              const stateLabel = step.done ? "закрыто" : state === "current" ? "текущий шаг" : "ожидает";
              const stateClass = step.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : state === "current"
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-border bg-background text-muted-foreground";
              return (
                <li key={step.key} className={`min-w-0 rounded-sm border px-2 py-1.5 ${stateClass}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px]">
                      {index + 1}
                    </span>
                    <span className="truncate text-[12px] font-medium">{step.label}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px]">{stateLabel}</p>
                  <p className="mt-0.5 truncate text-[11px] opacity-80">{step.statusLabel}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <ComparisonImagePanel
              image={imageA}
              marker="A"
              viewport={viewport}
              protectedImageUrl={protectedImageUrls[imageA.id] ?? null}
              geometryMarker={markerFor("A")}
            />
            <ComparisonImagePanel
              image={imageB}
              marker="B"
              viewport={viewport}
              protectedImageUrl={protectedImageUrls[imageB.id] ?? null}
              geometryMarker={markerFor("B")}
            />
          </div>

          <aside aria-label="Условия съёмки" className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
            <section aria-label="Инструменты просмотра" className="mb-3 rounded-md border border-border bg-background p-2">
              <div className="flex items-center gap-1 text-[12px] font-semibold">
                <Maximize2 className="h-3.5 w-3.5" aria-hidden /> Инструменты просмотра
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => updateZoom(-0.25)}
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden /> Уменьшить
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={resetViewport}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Сбросить
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => updateZoom(0.25)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Увеличить
                </Button>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1">
                <span aria-hidden />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Сместить вверх"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => updatePan(0, -12)}
                >
                  <MoveUp className="h-3.5 w-3.5" aria-hidden /> Вверх
                </Button>
                <span aria-hidden />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Сместить влево"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => updatePan(-12, 0)}
                >
                  <MoveLeft className="h-3.5 w-3.5" aria-hidden /> Влево
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Сместить вниз"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => updatePan(0, 12)}
                >
                  <MoveDown className="h-3.5 w-3.5" aria-hidden /> Вниз
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Сместить вправо"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => updatePan(12, 0)}
                >
                  <MoveRight className="h-3.5 w-3.5" aria-hidden /> Вправо
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={viewport.overlay === "grid" ? "secondary" : "outline"}
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => setViewport((current) => ({ ...current, overlay: "grid" }))}
                >
                  <Grid3X3 className="h-3.5 w-3.5" aria-hidden /> Показать сетку
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewport.overlay === "center" ? "secondary" : "outline"}
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => setViewport((current) => ({ ...current, overlay: "center" }))}
                >
                  <Crosshair className="h-3.5 w-3.5" aria-hidden /> Показать центр
                </Button>
              </div>
              <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                <span>Масштаб {Math.round(viewport.zoom * 100)}%</span>
                <span>
                  Смещение x{formatPan(viewport.panX)} / y{formatPan(viewport.panY)}
                </span>
                <span>Разметка: {COMPARISON_OVERLAY_LABEL[viewport.overlay]}</span>
                <span>Измерения отключены: разметка не является медицинским измерением.</span>
              </div>
              <section
                role="region"
                id="comparison-geometry"
                aria-label="Техническая геометрия"
                className="mt-2 rounded-md border border-border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Техническая геометрия
                    </div>
                    <div className="text-[12px] font-medium">Маркеры: {geometryMarkers.length}/2</div>
                  </div>
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    normalized
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    onClick={() => setGeometryMarker("A")}
                  >
                    <Crosshair className="h-3.5 w-3.5" aria-hidden /> Поставить маркер A
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    onClick={() => setGeometryMarker("B")}
                  >
                    <Crosshair className="h-3.5 w-3.5" aria-hidden /> Поставить маркер B
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={geometryMarkers.length === 0}
                    onClick={() => setGeometryMarkers([])}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Очистить маркеры
                  </Button>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <span>Координаты нормализованы: проценты кадра</span>
                  <span>
                    {geometryMarkers.length > 0
                      ? geometryMarkers.map((item) => formatGeometryMarker(item)).join(" · ")
                      : "Нет активных маркеров"}
                  </span>
                  <span>Не является медицинским измерением</span>
                  <span>Выдача пациенту: выключена</span>
                </div>
              </section>
              <section
                role="region"
                id="comparison-calibration"
                aria-label="Калибровка viewer"
                className="mt-2 rounded-md border border-border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Калибровка viewer
                    </div>
                    <div className="text-[12px] font-medium">
                      Калибровка: {calibrationReady ? "готова" : "не готова"}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${
                      calibrationReady
                        ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                        : "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
                    }`}
                  >
                    {calibrationReady ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    ) : (
                      <ShieldAlert className="h-3 w-3" aria-hidden />
                    )}
                    {calibrationReady ? "Готово" : "Ограничено"}
                  </span>
                </div>
                <div className="mt-2 grid gap-1.5">
                  {calibrationChecks.map((item) => (
                    <div key={item.label} className="flex min-w-0 items-start gap-1.5 text-[11px]">
                      {item.ready ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-low" aria-hidden />
                      ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-moderate" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-muted-foreground"> · {item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <span>Измерения в мм недоступны</span>
                  <span>Не используйте маркеры как размер очага</span>
                  <span>Выдача пациенту: выключена</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={viewerQaStatus === "saving"}
                    onClick={saveViewerQa}
                  >
                    <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Зафиксировать ограничение калибровки
                  </Button>
                  {(viewerQaMessage || calibrationLimitSaved) && (
                    <span className="text-[12px] font-medium text-primary" role="status">
                      {viewerQaMessage || "Ограничение калибровки зафиксировано локально"}
                    </span>
                  )}
                </div>
              </section>
              <section
                role="region"
                id="comparison-technical-review"
                aria-label="Технический review viewer QA"
                className="mt-2 rounded-md border border-border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Технический review viewer QA
                    </div>
                    <div className="text-[12px] font-medium">Решение по паре снимков</div>
                  </div>
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    metadata-only
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={viewerQaReviewStatus === "saving" || !(captureReady && calibrationReady && geometryMarkers.length === 2)}
                    onClick={() => reviewViewerQa("technical_ready")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {VIEWER_QA_REVIEW_LABEL.technical_ready}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={viewerQaReviewStatus === "saving"}
                    onClick={() => reviewViewerQa("needs_recapture")}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {VIEWER_QA_REVIEW_LABEL.needs_recapture}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={viewerQaReviewStatus === "saving"}
                    onClick={() => reviewViewerQa("not_suitable_for_comparison")}
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden /> {VIEWER_QA_REVIEW_LABEL.not_suitable_for_comparison}
                  </Button>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <span>Решение техническое: не диагноз, не динамика, не измерение.</span>
                  <span>Сначала сохраняется viewer QA draft, затем review audit.</span>
                  <span>Выдача пациенту: выключена</span>
                </div>
                {viewerQaReviewMessage && (
                  <p
                    className={`mt-2 text-[12px] font-medium ${
                      viewerQaReviewStatus === "error" ? "text-destructive" : "text-primary"
                    }`}
                    role="status"
                  >
                    {viewerQaReviewMessage}
                  </p>
                )}
              </section>
              <section
                role="region"
                id="comparison-measurement-policy"
                aria-label="Политика измерений"
                className="mt-2 rounded-md border border-border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Политика измерений
                    </div>
                    <div className="text-[12px] font-medium">
                      {MEASUREMENT_POLICY_LABEL[measurementPolicyStatus]}
                    </div>
                  </div>
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    mm disabled
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <span>Policy разрешает только technical reviewer workflow.</span>
                  <span>Измерения остаются выключены: нет мм, площади, клинического размера или вывода о динамике.</span>
                  <span>Выдача пациенту: выключена</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={
                      measurementPolicyBackendStatus === "saving"
                      || !(technicalReviewReady && captureReady && calibrationReady && geometryMarkers.length === 2)
                    }
                    onClick={() => reviewMeasurementPolicy("approved_for_technical_review")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Утвердить technical policy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={measurementPolicyBackendStatus === "saving"}
                    onClick={() => reviewMeasurementPolicy("review_required")}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Нужен разбор policy
                  </Button>
                </div>
                {measurementPolicyMessage && (
                  <p
                    className={`mt-2 text-[12px] font-medium ${
                      measurementPolicyBackendStatus === "error" ? "text-destructive" : "text-primary"
                    }`}
                    role="status"
                  >
                    {measurementPolicyMessage}
                  </p>
                )}
              </section>
              <section
                role="region"
                id="comparison-reviewer-assignment"
                aria-label="Назначение reviewer"
                className="mt-2 rounded-md border border-border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Назначение reviewer
                    </div>
                    <div className="text-[12px] font-medium">
                      {REVIEWER_ASSIGNMENT_LABEL[reviewerAssignmentStatus]} · {SECOND_REVIEW_LABEL[secondReviewStatus]}
                    </div>
                  </div>
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    identity hidden
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <span>UUID reviewer используется только backend как write-only payload.</span>
                  <span>Имена, контакты reviewer и идентификаторы пары не выводятся в UI/audit.</span>
                  <span>Выдача пациенту: выключена · medical measurement: выключен</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={reviewerAssignmentBackendStatus === "saving" || !measurementPolicyApproved}
                    onClick={() => assignReviewer("primary")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Назначить reviewer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={reviewerAssignmentBackendStatus === "saving" || !measurementPolicyApproved}
                    onClick={() => assignReviewer("second_required")}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Потребовать second review
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={reviewerAssignmentBackendStatus === "saving" || !measurementPolicyApproved}
                    onClick={() => assignReviewer("second_completed")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Second review завершён
                  </Button>
                </div>
                {reviewerAssignmentMessage && (
                  <p
                    className={`mt-2 text-[12px] font-medium ${
                      reviewerAssignmentBackendStatus === "error" ? "text-destructive" : "text-primary"
                    }`}
                    role="status"
                  >
                    {reviewerAssignmentMessage}
                  </p>
                )}
              </section>
              <section
                role="region"
                id="comparison-analysis-policy"
                aria-label="Production analysis policy"
                className="mt-2 rounded-md border border-border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Production analysis policy
                    </div>
                    <div className="text-[12px] font-medium">
                      {PRODUCTION_ANALYSIS_POLICY_LABEL[productionAnalysisPolicyStatus]}
                    </div>
                  </div>
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    no dynamic output
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <span>Policy разрешает только production-readiness gate, не вывод о динамике.</span>
                  <span>Clinical dynamic conclusion: выключен · выдача пациенту: выключена</span>
                  <span>Сначала должны быть закрыты technical policy, reviewer assignment и second review.</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={
                      productionAnalysisPolicyBackendStatus === "saving"
                      || !(measurementPolicyApproved && reviewerAssigned && secondReviewReady)
                    }
                    onClick={() => reviewProductionAnalysisPolicy("approved_for_production_analysis")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Утвердить analysis policy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={productionAnalysisPolicyBackendStatus === "saving"}
                    onClick={() => reviewProductionAnalysisPolicy("review_required")}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Нужен разбор analysis policy
                  </Button>
                </div>
                {productionAnalysisPolicyMessage && (
                  <p
                    className={`mt-2 text-[12px] font-medium ${
                      productionAnalysisPolicyBackendStatus === "error" ? "text-destructive" : "text-primary"
                    }`}
                    role="status"
                  >
                    {productionAnalysisPolicyMessage}
                  </p>
                )}
              </section>
              <section
                role="region"
                id="comparison-workflow-gate"
                aria-label="Clinical-grade reviewer workflow"
                className="mt-2 rounded-md border border-border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Clinical-grade reviewer workflow
                    </div>
                    <div className="text-[12px] font-medium">
                      Reviewer gate: {reviewerWorkflowReady ? "готов" : "заблокирован"}
                    </div>
                  </div>
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    no patient delivery
                  </span>
                </div>
                <div className="mt-2 grid gap-1.5">
                  {[
                    {
                      label: "Технический review",
                      ready: technicalReviewReady,
                      detail: technicalReviewReady ? "technical_ready сохранён" : "сначала нажмите «Технически готово»",
                    },
                    {
                      label: "Калибровка",
                      ready: calibrationReady,
                      detail: calibrationReady ? "calibrated viewer QA готов" : "нужна шкала и mm availability",
                    },
                    {
                      label: "Metadata съёмки",
                      ready: captureReady,
                      detail: captureReady ? "условия повторяемы" : "нужна повторяемая съёмка",
                    },
                    {
                      label: "Технические маркеры",
                      ready: geometryMarkers.length === 2,
                      detail: `маркеры ${geometryMarkers.length}/2`,
                    },
                    {
                      label: "Policy измерений",
                      ready: measurementPolicyApproved,
                      detail: measurementPolicyApproved ? "technical policy утверждена" : "измерения остаются выключены",
                    },
                    {
                      label: "Reviewer assignment",
                      ready: reviewerAssigned,
                      detail: reviewerAssigned ? "reviewer назначен; identity hidden" : "назначьте reviewer",
                    },
                    {
                      label: "Second review",
                      ready: secondReviewReady,
                      detail: secondReviewReady ? "не требуется или закрыт" : "нужен second review",
                    },
                    {
                      label: "Analysis policy",
                      ready: productionAnalysisPolicyApproved,
                      detail: productionAnalysisPolicyApproved
                        ? "production policy утверждена"
                        : "вывод о динамике остаётся выключен",
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex min-w-0 items-start gap-1.5 text-[11px]">
                      {item.ready ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-low" aria-hidden />
                      ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-moderate" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-muted-foreground"> · {item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={
                      viewerQaReviewerWorkflowStatus === "saving"
                      || !reviewerWorkflowReady
                    }
                    onClick={() => reviewViewerWorkflow("reviewer_accepted")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {VIEWER_QA_REVIEWER_WORKFLOW_LABEL.reviewer_accepted}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={viewerQaReviewerWorkflowStatus === "saving"}
                    onClick={() => reviewViewerWorkflow("reviewer_rejected")}
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden /> {VIEWER_QA_REVIEWER_WORKFLOW_LABEL.reviewer_rejected}
                  </Button>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                  <span>Workflow подтверждает только готовность к врачебному просмотру.</span>
                  <span>Не диагноз, не динамика, не медицинское измерение.</span>
                  <span>Выдача пациенту: выключена</span>
                </div>
                {viewerQaReviewerWorkflowMessage && (
                  <p
                    className={`mt-2 text-[12px] font-medium ${
                      viewerQaReviewerWorkflowStatus === "error" ? "text-destructive" : "text-primary"
                    }`}
                    role="status"
                  >
                    {viewerQaReviewerWorkflowMessage}
                  </p>
                )}
              </section>
              <div className="mt-2">
                <div id="comparison-protected-preview" className="mb-2 rounded-md border border-border bg-muted/20 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Protected image proxy
                      </div>
                      <div className="text-[12px] font-medium">Защищённые превью врача</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                      disabled={!canLoadProtectedImages || protectedRenderStatus === "loading"}
                      onClick={onLoadProtectedImages}
                    >
                      <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                      {protectedRenderStatus === "loading" ? "Загрузка" : "Подготовить защищённые превью"}
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Только backend proxy: без signed URL, пути хранилища и выдачи пациенту.
                  </p>
                  <div
                    role="region"
                    aria-label="Готовность protected rendering"
                    className="mt-2 grid gap-1 rounded-sm border border-border bg-background p-2"
                  >
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Готовность protected rendering
                    </div>
                    {protectedReadiness.map((item) => (
                      <div key={item.label} className="flex min-w-0 items-start gap-1.5 text-[11px]">
                        {item.ready ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-low" aria-hidden />
                        ) : (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-muted-foreground"> · {item.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {protectedRenderMessage && (
                    <p
                      className={`mt-1 text-[12px] ${
                        protectedRenderStatus === "ready" ? "text-primary" : "text-muted-foreground"
                      }`}
                      role="status"
                    >
                      {protectedRenderMessage}
                    </p>
                  )}
                </div>
                <label htmlFor="comparison-technical-note" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Техническая заметка
                </label>
                <Textarea
                  id="comparison-technical-note"
                  value={technicalNote}
                  maxLength={160}
                  rows={3}
                  className="mt-1 text-[12px]"
                  placeholder="Например: разный угол, мягкий фокус, нужна повторяемая съёмка"
                  onChange={(event) => setTechnicalNote(event.target.value)}
                />
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    disabled={technicalNote.trim().length === 0}
                    onClick={saveTechnicalNote}
                  >
                    <StickyNote className="h-3.5 w-3.5" aria-hidden /> Зафиксировать техническую заметку
                  </Button>
                  <span className="text-[11px] text-muted-foreground">Выдача пациенту: выключена</span>
                </div>
                {savedTechnicalNote && (
                  <p className="mt-1 text-[12px] font-medium text-primary" role="status">
                    Техническая заметка зафиксирована локально
                  </p>
                )}
              </div>
            </section>

            <div className="text-[12px] font-semibold">Условия съёмки</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="text-muted-foreground">Техническая сопоставимость:</span>
              <span
                className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${
                  isComparable
                    ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {isComparable ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                ) : (
                  <ShieldAlert className="h-3 w-3" aria-hidden />
                )}
                {isComparable ? "Сопоставимо" : "Не сопоставимо"}
              </span>
            </div>

            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Причины</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(reasons.length > 0 ? reasons : ["Условия повторяемы"]).map((reason) => (
                  <span key={reason} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px]">
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            <section
              id="comparison-capture-qa"
              aria-label="Контроль условий съёмки"
              className="mt-3 rounded-md border border-border bg-background p-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Контроль условий съёмки
                  </div>
                  <p className="mt-1 text-[12px] font-medium">
                    Итог: {captureReady ? "условия технически повторяемы" : "нужна повторяемая съёмка"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${
                    captureReady
                      ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                      : "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
                  }`}
                >
                  {captureReady ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                  ) : (
                    <ShieldAlert className="h-3 w-3" aria-hidden />
                  )}
                  {captureReady ? "Готово к техсравнению" : "Нужен контроль"}
                </span>
              </div>
              <div className="mt-2 grid gap-1.5">
                {captureChecks.map((item) => (
                  <div key={item.label} className="flex min-w-0 items-start gap-1.5 text-[11px]">
                    {item.ready ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-low" aria-hidden />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-moderate" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground"> · {item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Не является клинической оценкой динамики; показывает только повторяемость условий съёмки.
              </p>
            </section>

            <dl className="mt-3 space-y-2 text-[12px]">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Типы</dt>
                <dd>{IMAGE_KIND[imageA.kind]} / {IMAGE_KIND[imageB.kind]}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Источники</dt>
                <dd>{IMAGE_SOURCE[imageA.source]} / {IMAGE_SOURCE[imageB.source]}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Устройства</dt>
                <dd>{imageA.deviceId ?? "без устройства"} / {imageB.deviceId ?? "без устройства"}</dd>
              </div>
            </dl>

            <p
              className="mt-3 rounded-md border px-2 py-1.5 text-[12px]"
              style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.30)", color: "hsl(var(--warning))" }}
            >
              Не оценивайте динамику по этой паре без врачебной проверки и повторяемых условий съёмки.
            </p>

            <div className="mt-3">
              <ComparisonActionButtons onAction={onAction} />
              {action && (
                <p className="mt-2 text-[12px] font-medium text-primary" role="status">
                  {COMPARISON_ACTION_LABEL[action]}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2 min-h-[44px] text-[12px] sm:min-h-[32px]"
                disabled={!canSaveDraft}
                onClick={onSaveDraft}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden /> Сохранить черновик решения
              </Button>
              {draftStatus === "saved" && (
                <p className="mt-2 text-[12px] font-medium text-primary" role="status">
                  Черновик решения сохранён
                </p>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const selfHostedSession = useSelfHostedApiSession();
  const selfHostedConfigured = isSelfHostedApiConfigured(selfHostedSession);
  const patient = getPatientById(id);
  const lesion = getLesionById(lesionId);

  // Локальный UI-state для демо-действий (не сетевой и не storage).
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparisonAction, setComparisonAction] = useState<ComparisonAction | null>(null);
  const [comparisonDraft, setComparisonDraft] = useState<LesionComparisonDecisionDraft | null>(null);
  const [comparisonDraftStatus, setComparisonDraftStatus] = useState<ComparisonDraftStatus>("idle");
  const [comparisonBackendStatus, setComparisonBackendStatus] = useState<ComparisonBackendDraftStatus>("idle");
  const [comparisonBackendMessage, setComparisonBackendMessage] = useState("");
  const [viewerQaStatus, setViewerQaStatus] = useState<ViewerQaBackendStatus>("idle");
  const [viewerQaMessage, setViewerQaMessage] = useState("");
  const [viewerQaReviewStatus, setViewerQaReviewStatus] = useState<ViewerQaReviewBackendStatus>("idle");
  const [viewerQaReviewMessage, setViewerQaReviewMessage] = useState("");
  const [viewerQaLatestReviewStatus, setViewerQaLatestReviewStatus] = useState<ViewerQaReviewStatus | null>(null);
  const [viewerQaReviewerWorkflowStatus, setViewerQaReviewerWorkflowStatus] =
    useState<ViewerQaReviewerWorkflowBackendStatus>("idle");
  const [viewerQaReviewerWorkflowMessage, setViewerQaReviewerWorkflowMessage] = useState("");
  const [measurementPolicyBackendStatus, setMeasurementPolicyBackendStatus] =
    useState<MeasurementPolicyBackendStatus>("idle");
  const [measurementPolicyMessage, setMeasurementPolicyMessage] = useState("");
  const [measurementPolicyStatus, setMeasurementPolicyStatus] = useState<MeasurementPolicyStatus>("not_approved");
  const [productionAnalysisPolicyBackendStatus, setProductionAnalysisPolicyBackendStatus] =
    useState<ProductionAnalysisPolicyBackendStatus>("idle");
  const [productionAnalysisPolicyMessage, setProductionAnalysisPolicyMessage] = useState("");
  const [productionAnalysisPolicyStatus, setProductionAnalysisPolicyStatus] =
    useState<ProductionAnalysisPolicyStatus>("not_approved");
  const [reviewerAssignmentBackendStatus, setReviewerAssignmentBackendStatus] =
    useState<ReviewerAssignmentBackendStatus>("idle");
  const [reviewerAssignmentMessage, setReviewerAssignmentMessage] = useState("");
  const [reviewerAssignmentStatus, setReviewerAssignmentStatus] = useState<ReviewerAssignmentStatus>("unassigned");
  const [secondReviewStatus, setSecondReviewStatus] = useState<SecondReviewStatus>("not_required");
  const [protectedRenderStatus, setProtectedRenderStatus] = useState<ProtectedRenderStatus>("idle");
  const [protectedRenderMessage, setProtectedRenderMessage] = useState("");
  const [protectedImageUrls, setProtectedImageUrls] = useState<Record<string, string>>({});
  const [productionLongitudinalQa, setProductionLongitudinalQa] = useState<SelfHostedLesionLongitudinalQaDTO | null>(null);
  const [longitudinalQaLoadStatus, setLongitudinalQaLoadStatus] = useState<LongitudinalQaLoadStatus>("idle");
  const [longitudinalQaMessage, setLongitudinalQaMessage] = useState("");
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
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
  const comparePair = hasComparablePair ? ([compareImages[0], compareImages[1]] as [ClinicalImage, ClinicalImage]) : null;
  const selectedPairHasQualityIssues = hasComparablePair
    ? compareImages.some((img) => img.quality.score < 0.75 || img.quality.issues.length > 0)
    : false;
  const selectedPairIsComparable = hasComparablePair && !captureConditionsDiffer && !selectedPairHasQualityIssues;
  const comparisonReasons = [
    captureConditionsDiffer ? "Разные условия съёмки" : null,
    selectedPairHasQualityIssues ? "Есть технические замечания" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const selectedPairDraftKey = hasComparablePair
    ? buildLesionComparisonDraftKey(lesionId, compareImages.map((img) => img.id))
    : null;
  const canLoadProtectedImages = Boolean(
    comparePair
      && selfHostedConfigured
      && isUuid(patient?.id)
      && isUuid(lesion?.id)
      && comparePair.every((image) => isUuid(image.id)),
  );
  const protectedReadiness: ProtectedRenderReadinessItem[] = [
    {
      label: "Self-hosted вход",
      ready: selfHostedConfigured,
      detail: selfHostedConfigured ? "сессия настроена" : "нужен вход в self-hosted backend",
    },
    {
      label: "Production UUID",
      ready: Boolean(comparePair && isUuid(patient?.id) && isUuid(lesion?.id) && comparePair.every((image) => isUuid(image.id))),
      detail: "patient, lesion и оба image ID должны быть UUID",
    },
    {
      label: "Backend proxy",
      ready: true,
      detail: "рендер идёт через `/images/{assetId}/render`",
    },
    {
      label: "Выдача пациенту",
      ready: true,
      detail: "выключено; только врачебный просмотр",
    },
  ];

  useEffect(() => {
    setProtectedRenderStatus("idle");
    setProtectedRenderMessage("");
    setViewerQaStatus("idle");
    setViewerQaMessage("");
    setViewerQaReviewStatus("idle");
    setViewerQaReviewMessage("");
    setViewerQaLatestReviewStatus(null);
    setViewerQaReviewerWorkflowStatus("idle");
    setViewerQaReviewerWorkflowMessage("");
    setMeasurementPolicyBackendStatus("idle");
    setMeasurementPolicyMessage("");
    setMeasurementPolicyStatus("not_approved");
    setProductionAnalysisPolicyBackendStatus("idle");
    setProductionAnalysisPolicyMessage("");
    setProductionAnalysisPolicyStatus("not_approved");
    setReviewerAssignmentBackendStatus("idle");
    setReviewerAssignmentMessage("");
    setReviewerAssignmentStatus("unassigned");
    setSecondReviewStatus("not_required");
    setProtectedImageUrls((current) => {
      revokePreviewUrls(current);
      return {};
    });
    if (!selectedPairDraftKey) {
      setComparisonDraft(null);
      setComparisonDraftStatus("idle");
      setComparisonBackendStatus("idle");
      setComparisonBackendMessage("");
      return;
    }
    const draft = loadLesionComparisonDraft(selectedPairDraftKey);
    setComparisonDraft(draft);
    if (draft) {
      setComparisonAction(draft.action);
      setComparisonDraftStatus("loaded");
    } else {
      setComparisonDraftStatus("idle");
    }
  }, [selectedPairDraftKey]);

  useEffect(() => () => revokePreviewUrls(protectedImageUrls), [protectedImageUrls]);

  useEffect(() => {
    setProductionLongitudinalQa(null);
    setLongitudinalQaLoadStatus("idle");
    setLongitudinalQaMessage("");
  }, [id, lesionId]);

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
  const longitudinalGroups = buildLongitudinalVisitGroups(images, visits, assessments);
  const longitudinalPairs = buildLongitudinalPairs(longitudinalGroups);
  const localLongitudinalQa = buildLocalLongitudinalQaGate({
    patientId: patient.id,
    lesion,
    groups: longitudinalGroups,
    pairs: longitudinalPairs,
  });
  const activeLongitudinalQa = productionLongitudinalQa ?? localLongitudinalQa;
  const canRefreshLongitudinalQa = Boolean(selfHostedConfigured && isUuid(patient.id) && isUuid(lesion.id));

  const latestVisit = visits.find((v) => visitsWithImages.includes(v.id))
    ?? visits.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const bodyMapHref = latestVisit
    ? `/patients/${patient.id}/visits/${latestVisit.id}?tab=bodymap&lesion=${lesion.id}`
    : `/patients/${patient.id}`;

  const toggleCompare = (imgId: string) => {
    setComparisonAction(null);
    setComparisonDraft(null);
    setComparisonDraftStatus("idle");
    setComparisonBackendStatus("idle");
    setComparisonBackendMessage("");
    setCompareDialogOpen(false);
    setCompareIds((prev) => {
      if (prev.includes(imgId)) return prev.filter((x) => x !== imgId);
      const next = [...prev, imgId];
      return next.slice(-2); // максимум 2 для сравнения
    });
  };

  const handleComparisonAction = (action: ComparisonAction) => {
    setComparisonAction(action);
    setComparisonDraftStatus("idle");
    setComparisonBackendStatus("idle");
    setComparisonBackendMessage("");
    setViewerQaReviewStatus("idle");
    setViewerQaReviewMessage("");
    setViewerQaLatestReviewStatus(null);
    setViewerQaReviewerWorkflowStatus("idle");
    setViewerQaReviewerWorkflowMessage("");
    setProductionAnalysisPolicyBackendStatus("idle");
    setProductionAnalysisPolicyMessage("");
    setProductionAnalysisPolicyStatus("not_approved");
  };

  const viewerQaApiPayload = (payload: ViewerQaSavePayload) => {
    if (!comparePair || !selectedPairDraftKey) return null;
    return {
      lesionId,
      pairKey: selectedPairDraftKey,
      imageIds: [comparePair[0].id, comparePair[1].id] as [string, string],
      technicalMarkers: payload.technicalMarkers.map((marker) => ({
        target: marker.target,
        xPercent: marker.x,
        yPercent: marker.y,
      })),
      calibrationStatus: payload.calibrationStatus,
      calibrationReasons: payload.calibrationReasons,
      captureMetadataStatus: payload.captureMetadataStatus,
    };
  };

  const saveViewerQa = async (payload: ViewerQaSavePayload) => {
    if (!selectedPairDraftKey || !comparePair || !latestVisit) {
      setViewerQaStatus("local_only");
      setViewerQaMessage("Ограничение калибровки зафиксировано локально");
      return;
    }
    if (!selfHostedConfigured) {
      setViewerQaStatus("local_only");
      setViewerQaMessage("Ограничение калибровки зафиксировано локально");
      return;
    }

    setViewerQaStatus("saving");
    setViewerQaMessage("Viewer QA сохраняется в self-hosted backend.");
    const apiPayload = viewerQaApiPayload(payload);
    if (!apiPayload) {
      setViewerQaStatus("local_only");
      setViewerQaMessage("Ограничение калибровки зафиксировано локально");
      return;
    }
    const result = await saveSelfHostedLesionComparisonViewerQa({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: apiPayload,
    });
    if (result.ok) {
      setViewerQaStatus("saved");
      setViewerQaMessage("Viewer QA сохранён в self-hosted backend. Выдача пациенту: выключена.");
    } else {
      setViewerQaStatus("error");
      setViewerQaMessage(result.error?.message ?? "Viewer QA не сохранён.");
    }
  };

	  const reviewViewerQa = async (payload: ViewerQaReviewPayload) => {
    if (!selectedPairDraftKey || !comparePair || !latestVisit) {
      setViewerQaReviewStatus("local_only");
      setViewerQaReviewMessage("Viewer QA review зафиксирован локально. Выдача пациенту: выключена.");
      setViewerQaLatestReviewStatus(payload.reviewStatus);
      return;
    }
    if (!selfHostedConfigured) {
      setViewerQaReviewStatus("local_only");
      setViewerQaReviewMessage("Viewer QA review зафиксирован локально. Выдача пациенту: выключена.");
      setViewerQaLatestReviewStatus(payload.reviewStatus);
      return;
    }
    const apiPayload = viewerQaApiPayload(payload);
    if (!apiPayload) {
      setViewerQaReviewStatus("local_only");
      setViewerQaReviewMessage("Viewer QA review зафиксирован локально. Выдача пациенту: выключена.");
      setViewerQaLatestReviewStatus(payload.reviewStatus);
      return;
    }

    setViewerQaReviewStatus("saving");
    setViewerQaReviewMessage("Viewer QA review сохраняется в self-hosted backend.");
    const saveResult = await saveSelfHostedLesionComparisonViewerQa({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: apiPayload,
    });
    if (!saveResult.ok) {
      setViewerQaReviewStatus("error");
      setViewerQaReviewMessage(saveResult.error?.message ?? "Viewer QA draft не сохранён перед review.");
      return;
    }
    const reviewResult = await reviewSelfHostedLesionComparisonViewerQa({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: {
        lesionId,
        pairKey: selectedPairDraftKey,
        imageIds: [comparePair[0].id, comparePair[1].id],
        reviewStatus: payload.reviewStatus,
        reviewReasons: payload.reviewReasons,
      },
    });
    if (reviewResult.ok) {
      setViewerQaReviewStatus("saved");
      setViewerQaReviewMessage("Viewer QA review сохранён в self-hosted backend. Выдача пациенту: выключена.");
      const persistedReviewStatus = reviewResult.value?.review.status;
      setViewerQaLatestReviewStatus(
        persistedReviewStatus === "technical_ready"
          || persistedReviewStatus === "needs_recapture"
          || persistedReviewStatus === "not_suitable_for_comparison"
          ? persistedReviewStatus
          : payload.reviewStatus,
      );
    } else {
      setViewerQaReviewStatus("error");
      setViewerQaReviewMessage(reviewResult.error?.message ?? "Viewer QA review не сохранён.");
    }
	  };

  const reviewMeasurementPolicy = async (payload: MeasurementPolicyPayload) => {
    if (!selectedPairDraftKey || !comparePair || !latestVisit) {
      setMeasurementPolicyBackendStatus("local_only");
      setMeasurementPolicyMessage("Policy измерений зафиксирована локально. Измерения остаются выключены.");
      setMeasurementPolicyStatus(payload.measurementPolicyStatus);
      return;
    }
    if (!selfHostedConfigured) {
      setMeasurementPolicyBackendStatus("local_only");
      setMeasurementPolicyMessage("Policy измерений зафиксирована локально. Измерения остаются выключены.");
      setMeasurementPolicyStatus(payload.measurementPolicyStatus);
      return;
    }
    const apiPayload = viewerQaApiPayload(payload);
    if (!apiPayload) {
      setMeasurementPolicyBackendStatus("local_only");
      setMeasurementPolicyMessage("Policy измерений зафиксирована локально. Измерения остаются выключены.");
      setMeasurementPolicyStatus(payload.measurementPolicyStatus);
      return;
    }

    setMeasurementPolicyBackendStatus("saving");
    setMeasurementPolicyMessage("Policy измерений сохраняется в self-hosted backend.");
    const saveResult = await saveSelfHostedLesionComparisonViewerQa({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: apiPayload,
    });
    if (!saveResult.ok) {
      setMeasurementPolicyBackendStatus("error");
      setMeasurementPolicyMessage(saveResult.error?.message ?? "Viewer QA draft не сохранён перед policy review.");
      return;
    }
    const result = await reviewSelfHostedLesionComparisonMeasurementPolicy({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: {
        lesionId,
        pairKey: selectedPairDraftKey,
        imageIds: [comparePair[0].id, comparePair[1].id],
        measurementPolicyStatus: payload.measurementPolicyStatus,
        measurementPolicyReasons: payload.measurementPolicyReasons,
      },
    });
    if (result.ok) {
      setMeasurementPolicyBackendStatus("saved");
      setMeasurementPolicyStatus(result.value?.measurementPolicy.status ?? payload.measurementPolicyStatus);
      setMeasurementPolicyMessage("Policy измерений сохранена в self-hosted backend. Медицинские измерения выключены.");
    } else {
      setMeasurementPolicyBackendStatus("error");
      setMeasurementPolicyMessage(result.error?.message ?? "Policy измерений не сохранена.");
    }
  };

  const reviewProductionAnalysisPolicy = async (payload: ProductionAnalysisPolicyPayload) => {
    const applyLocal = (message: string) => {
      setProductionAnalysisPolicyBackendStatus("local_only");
      setProductionAnalysisPolicyMessage(message);
      setProductionAnalysisPolicyStatus(payload.productionAnalysisPolicyStatus);
    };
    if (!selectedPairDraftKey || !comparePair || !latestVisit) {
      applyLocal("Analysis policy зафиксирована локально. Вывод о динамике выключен.");
      return;
    }
    if (!selfHostedConfigured) {
      applyLocal("Analysis policy зафиксирована локально. Вывод о динамике выключен.");
      return;
    }
    const apiPayload = viewerQaApiPayload(payload);
    if (!apiPayload) {
      applyLocal("Analysis policy зафиксирована локально. Вывод о динамике выключен.");
      return;
    }

    setProductionAnalysisPolicyBackendStatus("saving");
    setProductionAnalysisPolicyMessage("Analysis policy сохраняется в self-hosted backend.");
    const saveResult = await saveSelfHostedLesionComparisonViewerQa({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: apiPayload,
    });
    if (!saveResult.ok) {
      setProductionAnalysisPolicyBackendStatus("error");
      setProductionAnalysisPolicyMessage(
        saveResult.error?.message ?? "Viewer QA draft не сохранён перед analysis policy.",
      );
      return;
    }
    const result = await reviewSelfHostedLesionComparisonProductionAnalysisPolicy({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: {
        lesionId,
        pairKey: selectedPairDraftKey,
        imageIds: [comparePair[0].id, comparePair[1].id],
        productionAnalysisPolicyStatus: payload.productionAnalysisPolicyStatus,
        productionAnalysisPolicyReasons: payload.productionAnalysisPolicyReasons,
      },
    });
    if (result.ok) {
      setProductionAnalysisPolicyBackendStatus("saved");
      setProductionAnalysisPolicyStatus(
        result.value?.productionAnalysisPolicy.status ?? payload.productionAnalysisPolicyStatus,
      );
      setProductionAnalysisPolicyMessage(
        "Analysis policy сохранена в self-hosted backend. Clinical dynamic conclusion выключен.",
      );
    } else {
      setProductionAnalysisPolicyBackendStatus("error");
      setProductionAnalysisPolicyMessage(result.error?.message ?? "Analysis policy не сохранена.");
    }
  };

  const assignReviewer = async (payload: ReviewerAssignmentPayload) => {
    const applyLocal = (message: string) => {
      setReviewerAssignmentBackendStatus("local_only");
      setReviewerAssignmentMessage(message);
      setReviewerAssignmentStatus(payload.assignmentStatus);
      setSecondReviewStatus(payload.secondReviewStatus);
    };
    if (!selectedPairDraftKey || !comparePair || !latestVisit) {
      applyLocal("Назначение reviewer зафиксировано локально. Identity скрыта.");
      return;
    }
    if (!selfHostedConfigured) {
      applyLocal("Назначение reviewer зафиксировано локально. Identity скрыта.");
      return;
    }
    const apiPayload = viewerQaApiPayload(payload);
    if (!apiPayload) {
      applyLocal("Назначение reviewer зафиксировано локально. Identity скрыта.");
      return;
    }

    setReviewerAssignmentBackendStatus("saving");
    setReviewerAssignmentMessage("Назначение reviewer сохраняется в self-hosted backend.");
    const saveResult = await saveSelfHostedLesionComparisonViewerQa({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: apiPayload,
    });
    if (!saveResult.ok) {
      setReviewerAssignmentBackendStatus("error");
      setReviewerAssignmentMessage(saveResult.error?.message ?? "Viewer QA draft не сохранён перед reviewer assignment.");
      return;
    }
    const result = await reviewSelfHostedLesionComparisonReviewerAssignment({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: {
        lesionId,
        pairKey: selectedPairDraftKey,
        imageIds: [comparePair[0].id, comparePair[1].id],
        assignmentStatus: payload.assignmentStatus,
        assignmentReasons: payload.assignmentReasons,
        assignedReviewerUserId: payload.assignedReviewerUserId,
        secondReviewStatus: payload.secondReviewStatus,
        secondReviewReasons: payload.secondReviewReasons,
        secondReviewerUserId: payload.secondReviewerUserId,
      },
    });
    if (result.ok) {
      setReviewerAssignmentBackendStatus("saved");
      setReviewerAssignmentStatus(result.value?.reviewerAssignment.status ?? payload.assignmentStatus);
      setSecondReviewStatus(result.value?.secondReview.status ?? payload.secondReviewStatus);
      setReviewerAssignmentMessage("Reviewer assignment сохранён в self-hosted backend. Identity скрыта.");
    } else {
      setReviewerAssignmentBackendStatus("error");
      setReviewerAssignmentMessage(result.error?.message ?? "Reviewer assignment не сохранён.");
    }
  };

  const reviewReviewerWorkflow = async (payload: ViewerQaReviewerWorkflowPayload) => {
    if (!selectedPairDraftKey || !comparePair || !latestVisit) {
      setViewerQaReviewerWorkflowStatus("local_only");
      setViewerQaReviewerWorkflowMessage("Reviewer workflow зафиксирован локально. Выдача пациенту: выключена.");
      return;
    }
    if (!selfHostedConfigured) {
      setViewerQaReviewerWorkflowStatus("local_only");
      setViewerQaReviewerWorkflowMessage("Reviewer workflow зафиксирован локально. Выдача пациенту: выключена.");
      return;
    }
    const apiPayload = viewerQaApiPayload(payload);
    if (!apiPayload) {
      setViewerQaReviewerWorkflowStatus("local_only");
      setViewerQaReviewerWorkflowMessage("Reviewer workflow зафиксирован локально. Выдача пациенту: выключена.");
      return;
    }

    setViewerQaReviewerWorkflowStatus("saving");
    setViewerQaReviewerWorkflowMessage("Reviewer workflow сохраняется в self-hosted backend.");
    const result = await reviewSelfHostedLesionComparisonViewerQaReviewerWorkflow({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: {
        lesionId,
        pairKey: selectedPairDraftKey,
        imageIds: [comparePair[0].id, comparePair[1].id],
        workflowStatus: payload.workflowStatus,
        workflowReasons: payload.workflowReasons,
      },
    });
    if (result.ok) {
      setViewerQaReviewerWorkflowStatus("saved");
      setViewerQaReviewerWorkflowMessage(
        result.value?.reviewerWorkflow.status === "technical_gate_blocked"
          ? "Reviewer workflow заблокирован backend gate. Выдача пациенту: выключена."
          : "Reviewer workflow сохранён в self-hosted backend. Выдача пациенту: выключена.",
      );
    } else {
      setViewerQaReviewerWorkflowStatus("error");
      setViewerQaReviewerWorkflowMessage(result.error?.message ?? "Reviewer workflow не сохранён.");
    }
  };

  const saveComparisonDraft = async () => {
    if (!selectedPairDraftKey || !comparePair || !comparisonAction) return;
    const draft = createLesionComparisonDecisionDraft({
      lesionId,
      pairKey: selectedPairDraftKey,
      imageIds: [comparePair[0].id, comparePair[1].id],
      action: comparisonAction,
      isComparable: selectedPairIsComparable,
      reasons: comparisonReasons,
    });
    if (saveLesionComparisonDraft(draft)) {
      setComparisonDraft(draft);
      setComparisonDraftStatus("saved");
    }
    if (!latestVisit || !selfHostedConfigured) {
      setComparisonBackendStatus("local_only");
      setComparisonBackendMessage("Backend audit не отправлен: self-hosted backend не подключён.");
      return;
    }

    setComparisonBackendStatus("saving");
    setComparisonBackendMessage("Backend audit сохраняется.");
    const result = await saveSelfHostedLesionComparisonDraft({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      visitId: latestVisit.id,
      payload: {
        lesionId,
        pairKey: selectedPairDraftKey,
        imageIds: [comparePair[0].id, comparePair[1].id],
        action: comparisonAction,
        comparability: draft.comparability,
        reasons: draft.reasons,
      },
    });
    if (result.ok) {
      setComparisonBackendStatus("saved");
      setComparisonBackendMessage("Backend audit сохранён в self-hosted backend.");
    } else {
      setComparisonBackendStatus("error");
      setComparisonBackendMessage(result.error?.message ?? "Backend audit не сохранён.");
    }
  };

  const clearComparisonDraft = () => {
    if (!selectedPairDraftKey) return;
    if (clearLesionComparisonDraft(selectedPairDraftKey)) {
      setComparisonDraft(null);
      setComparisonDraftStatus("cleared");
      setComparisonBackendStatus("idle");
      setComparisonBackendMessage("");
    }
  };

  const loadProtectedImagePreviews = async () => {
    if (!comparePair) return;
    if (!selfHostedConfigured) {
      setProtectedRenderStatus("error");
      setProtectedRenderMessage("Self-hosted backend не подключён.");
      return;
    }
    if (!canLoadProtectedImages) {
      setProtectedRenderStatus("error");
      setProtectedRenderMessage("Защищённые превью доступны только для production self-hosted UUID-снимков.");
      return;
    }

    setProtectedRenderStatus("loading");
    setProtectedRenderMessage("Загрузка через backend proxy.");
    const results = await Promise.all(comparePair.map((image) =>
      downloadSelfHostedProtectedLesionImage({
        apiBaseUrl: selfHostedSession.apiBaseUrl,
        apiToken: selfHostedSession.apiToken,
        patientId: patient.id,
        lesionId: lesion.id,
        assetId: image.id,
      }),
    ));
    const failed = results.find((result) => !result.ok || !result.value);
    if (failed) {
      setProtectedRenderStatus("error");
      setProtectedRenderMessage(failed.error?.message ?? "Защищённые превью не загружены.");
      return;
    }

    setProtectedImageUrls((current) => {
      revokePreviewUrls(current);
      const next: Record<string, string> = {};
      comparePair.forEach((image, index) => {
        const value = results[index]?.value;
        if (value?.bytes) next[image.id] = createPreviewObjectUrl(value.bytes);
      });
      return next;
    });
    setProtectedRenderStatus("ready");
    setProtectedRenderMessage("Защищённые превью загружены через backend proxy. Выдача пациенту: выключена.");
  };

  const refreshProductionLongitudinalQa = async () => {
    if (!canRefreshLongitudinalQa) {
      setLongitudinalQaLoadStatus("error");
      setLongitudinalQaMessage("Production QA доступен только для self-hosted UUID-карточки.");
      return;
    }

    setLongitudinalQaLoadStatus("loading");
    setLongitudinalQaMessage("Production QA обновляется из self-hosted backend.");
    const result = await getSelfHostedLesionLongitudinalQa({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      patientId: patient.id,
      lesionId: lesion.id,
    });
    if (result.ok && result.value) {
      setProductionLongitudinalQa(result.value);
      setLongitudinalQaLoadStatus("loaded");
      setLongitudinalQaMessage("Production QA обновлён. Выдача пациенту: выключена.");
    } else {
      setLongitudinalQaLoadStatus("error");
      setLongitudinalQaMessage(result.error?.message ?? "Production QA не обновлён.");
    }
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

        {longitudinalGroups.length > 0 && (
          <>
            <LongitudinalHistorySection groups={longitudinalGroups} pairs={longitudinalPairs} />
            <LongitudinalQaGateSection
              qa={activeLongitudinalQa}
              canRefresh={canRefreshLongitudinalQa}
              loadStatus={longitudinalQaLoadStatus}
              message={longitudinalQaMessage}
              onRefresh={refreshProductionLongitudinalQa}
            />
          </>
        )}

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
                        variant="default"
                        className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                        onClick={() => setCompareDialogOpen(true)}
                      >
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden /> Открыть полноэкранное сравнение
                      </Button>
                      <ComparisonActionButtons onAction={handleComparisonAction} />
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

                  <section
                    aria-label="Черновик решения врача"
                    className="mt-2 rounded-sm border border-border bg-muted/20 p-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Черновик решения врача
                        </div>
                        <p className="mt-1 text-[12px]">
                          Сохраняется локально: ID пары, технический статус, причины и выбранное действие.
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Выдача пациенту: выключена · backend audit: только self-hosted metadata · защищённые поля скрыты.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                          disabled={!comparisonAction}
                          onClick={saveComparisonDraft}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden /> Сохранить черновик решения
                        </Button>
                        {comparisonDraft && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                            onClick={clearComparisonDraft}
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden /> Удалить черновик
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">
                        Пара: {imageDisplayLabel(compareImages[0], "A")} + {imageDisplayLabel(compareImages[1], "B")}
                      </span>
                      <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">
                        Внутренние ID снимков скрыты
                      </span>
                      <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">
                        {selectedPairIsComparable ? "Сопоставимо" : "Не сопоставимо"}
                      </span>
                      {comparisonAction && (
                        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">
                          {COMPARISON_ACTION_LABEL[comparisonAction]}
                        </span>
                      )}
                    </div>
                    {comparisonDraft && (
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        Сохранено: {formatDateTime(comparisonDraft.savedAt)} · действие:{" "}
                        {COMPARISON_ACTION_LABEL[comparisonDraft.action]}
                      </p>
                    )}
                    {comparisonDraftStatus === "saved" && (
                      <p className="mt-1 text-[12px] font-medium text-primary" role="status">
                        Черновик решения сохранён
                      </p>
                    )}
                    {comparisonDraftStatus === "loaded" && (
                      <p className="mt-1 text-[12px] font-medium text-primary" role="status">
                        Черновик решения загружен
                      </p>
                    )}
                    {comparisonDraftStatus === "cleared" && (
                      <p className="mt-1 text-[12px] font-medium text-primary" role="status">
                        Черновик решения удалён
                      </p>
                    )}
                    {comparisonBackendStatus !== "idle" && (
                      <p
                        className={`mt-1 text-[12px] font-medium ${
                          comparisonBackendStatus === "error" ? "text-destructive" : "text-primary"
                        }`}
                        role="status"
                      >
                        {comparisonBackendMessage}
                      </p>
                    )}
                  </section>
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
                  <li
                    key={img.id}
                    data-image-id={img.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                        <span className="font-medium tabular-nums">{imageDisplayLabel(img)}</span>
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
      <ComparisonFullScreenDialog
        open={compareDialogOpen && hasComparablePair}
        onOpenChange={setCompareDialogOpen}
        images={comparePair}
        reasons={comparisonReasons}
        isComparable={selectedPairIsComparable}
        action={comparisonAction}
        onAction={handleComparisonAction}
        onSaveDraft={saveComparisonDraft}
        canSaveDraft={Boolean(comparisonAction)}
        draftStatus={comparisonDraftStatus}
        onSaveViewerQa={saveViewerQa}
        viewerQaStatus={viewerQaStatus}
        viewerQaMessage={viewerQaMessage}
        onReviewViewerQa={reviewViewerQa}
        viewerQaReviewStatus={viewerQaReviewStatus}
        viewerQaReviewMessage={viewerQaReviewMessage}
        technicalReviewReady={viewerQaLatestReviewStatus === "technical_ready"}
        measurementPolicyStatus={measurementPolicyStatus}
        onReviewMeasurementPolicy={reviewMeasurementPolicy}
        measurementPolicyBackendStatus={measurementPolicyBackendStatus}
        measurementPolicyMessage={measurementPolicyMessage}
        productionAnalysisPolicyStatus={productionAnalysisPolicyStatus}
        onReviewProductionAnalysisPolicy={reviewProductionAnalysisPolicy}
        productionAnalysisPolicyBackendStatus={productionAnalysisPolicyBackendStatus}
        productionAnalysisPolicyMessage={productionAnalysisPolicyMessage}
        reviewerAssignmentStatus={reviewerAssignmentStatus}
        secondReviewStatus={secondReviewStatus}
        onAssignReviewer={assignReviewer}
        reviewerAssignmentBackendStatus={reviewerAssignmentBackendStatus}
        reviewerAssignmentMessage={reviewerAssignmentMessage}
        onReviewViewerWorkflow={reviewReviewerWorkflow}
        viewerQaReviewerWorkflowStatus={viewerQaReviewerWorkflowStatus}
        viewerQaReviewerWorkflowMessage={viewerQaReviewerWorkflowMessage}
        canLoadProtectedImages={canLoadProtectedImages}
        protectedReadiness={protectedReadiness}
        protectedRenderStatus={protectedRenderStatus}
        protectedRenderMessage={
          protectedRenderMessage ||
          (selfHostedConfigured
            ? "Для mock ID превью недоступны; production UUID-снимки рендерятся через backend proxy."
            : "Self-hosted backend не подключён; доступны только параметры снимка.")
        }
        protectedImageUrls={protectedImageUrls}
        onLoadProtectedImages={loadProtectedImagePreviews}
      />
    </div>
  );
}
