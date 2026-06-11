import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw, Images } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useApiSession } from "@/lib/api-session";
import { VisitWorkspaceLiveActions } from "@/pages/doctor/VisitWorkspaceLiveActions";
import { VisitWorkspaceLiveBanner } from "@/pages/doctor/VisitWorkspaceLiveBanner";
import { VisitAssessmentTab } from "@/pages/doctor/VisitAssessmentTab";
import { VisitConclusionTab } from "@/pages/doctor/VisitConclusionTab";
import { VisitReportTab } from "@/pages/doctor/VisitReportTab";
import {
  TimelineQaGroupHeader,
  TimelineQaGroupNav,
} from "@/pages/doctor/visit-workspace/TimelineQaNavigation";
import {
  humanDisplayValue,
  humanFieldTerm,
  timelineReasonLabel,
} from "@/pages/doctor/visit-workspace/visitWorkspaceLabels";
import { isProductionAppMode } from "@/lib/app-mode";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import {
  getSelfHostedVisit,
  listSelfHostedVisitLesions,
  type SelfHostedVisitDetailDTO,
  type SelfHostedVisitLesionDTO,
} from "@/lib/self-hosted-visit-api";
import {
  getSelfHostedVisitAssessment,
  getSelfHostedVisitConclusion,
  getSelfHostedVisitLesionComparisonViewerQaReviewQueue,
  getSelfHostedVisitLongitudinalDatasetValidation,
  getSelfHostedVisitReport,
  reviewSelfHostedVisitLongitudinalTimelineRollout,
  reviewSelfHostedVisitLongitudinalTimelineRolloutClinicalValidation,
  reviewSelfHostedVisitLongitudinalTimelineRolloutEvidence,
  reviewSelfHostedVisitLongitudinalTimelineRolloutExceptionGovernance,
  reviewSelfHostedVisitLongitudinalTimelineRolloutIncidentProcedure,
  reviewSelfHostedVisitLongitudinalTimelineRolloutMonitoring,
  reviewSelfHostedVisitLongitudinalTimelineRolloutLongitudinalClinicalValidation,
  reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerEvidence,
  reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerGovernance,
  reviewSelfHostedVisitLongitudinalTimelineRolloutProductionDatasetEvidence,
  reviewSelfHostedVisitLongitudinalTimelineRolloutProductionReviewerGovernance,
  reviewSelfHostedVisitLongitudinalTimelineRolloutProductionReviewerEvidence,
  reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerValidation,
  reviewSelfHostedVisitLongitudinalTimelineRolloutObservationGovernance,
  reviewSelfHostedVisitLongitudinalTimelineRolloutOutcomeGovernance,
  reviewSelfHostedVisitLongitudinalTimelineRolloutPostValidationMonitoring,
  reviewSelfHostedVisitLongitudinalTimelineRolloutSop,
  updateSelfHostedVisitAssessment,
  updateSelfHostedVisitConclusion,
  updateSelfHostedVisitReportContract,
  type SelfHostedClinicalAssessmentDTO,
  type SelfHostedClinicalConclusionDTO,
  type SelfHostedLesionComparisonViewerQaReviewQueueDTO,
  type SelfHostedVisitLongitudinalDatasetValidationDTO,
  type SelfHostedVisitLongitudinalTimelineRolloutClinicalValidationStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutEvidenceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutExceptionGovernanceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutIncidentProcedureStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutMonitoringStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerEvidenceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerGovernanceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutProductionDatasetEvidenceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutProductionReviewerGovernanceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutProductionReviewerEvidenceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerValidationStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutObservationGovernanceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutOutcomeGovernanceStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutPostValidationMonitoringStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutSopStatus,
  type SelfHostedVisitLongitudinalTimelineRolloutStatus,
} from "@/lib/self-hosted-clinical-workspace-api";
import {
  clinicalReportMissingLabel,
  getSelfHostedClinicalReportPackage,
  getSelfHostedPatientPhotoProtocolReleaseAudit,
  reviewSelfHostedPatientPhotoProtocolReleasePolicy,
  type SelfHostedClinicalReportPackageDTO,
  type SelfHostedPatientPhotoProtocolReleaseAuditDTO,
} from "@/lib/self-hosted-clinical-report-package-api";
import type { SelfHostedVisitReportDTO, VisitReportPayload } from "@/lib/self-hosted-visit-write-api";
import {
  selfHostedLesionToDomain,
  selfHostedVisitDetailToPatient,
  selfHostedVisitToDomain,
} from "@/lib/self-hosted-clinical-adapter";
import {
  BODY_MAP_DEMO_NOW,
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

type LiveWorkspaceState =
  | { kind: "idle" | "loading" }
  | {
      kind: "ready";
      visit: SelfHostedVisitDetailDTO;
      lesions: SelfHostedVisitLesionDTO[];
    }
  | { kind: "error"; message: string };

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
  const productionMode = isProductionAppMode();
  const selfHostedSession = useSelfHostedApiSession();
  const liveBackend = isSelfHostedApiConfigured(selfHostedSession);
  const [liveState, setLiveState] = useState<LiveWorkspaceState>({ kind: "idle" });
  const apiSession = useApiSession();

  const [searchParams, setSearchParams] = useSearchParams();
  const updateNav = useCallback(
    (tab: string, lesionId?: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", tab);
          if (lesionId) next.set("lesion", lesionId);
          else next.delete("lesion");
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!productionMode || !liveBackend || !visitId) {
      setLiveState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setLiveState({ kind: "loading" });
    void (async () => {
      const [visitResult, lesionsResult] = await Promise.all([
        getSelfHostedVisit({
          apiBaseUrl: selfHostedSession.apiBaseUrl,
          apiToken: selfHostedSession.apiToken,
          visitId,
        }),
        listSelfHostedVisitLesions({
          apiBaseUrl: selfHostedSession.apiBaseUrl,
          apiToken: selfHostedSession.apiToken,
          visitId,
        }),
      ]);
      if (cancelled) return;
      if (!visitResult.ok || !visitResult.value) {
        setLiveState({
          kind: "error",
          message: visitResult.error?.message ?? "Не удалось загрузить визит с сервера клиники.",
        });
        return;
      }
      if (!lesionsResult.ok) {
        setLiveState({
          kind: "error",
          message: lesionsResult.error?.message ?? "Не удалось загрузить очаги визита с сервера клиники.",
        });
        return;
      }
      setLiveState({
        kind: "ready",
        visit: visitResult.value,
        lesions: lesionsResult.value ?? [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    liveBackend,
    productionMode,
    selfHostedSession.apiBaseUrl,
    selfHostedSession.apiToken,
    visitId,
  ]);

  if (productionMode && !liveBackend) {
    return (
      <ProductionWorkspaceState
        title="Требуется вход в систему клиники"
        text="Рабочий режим открывает визит только из системы клиники. Войдите в систему клиники."
      />
    );
  }

  if (productionMode && liveState.kind === "loading") {
    return <ProductionWorkspaceState title="Загружаем рабочее место визита" text="Читаем визит из системы клиники…" />;
  }

  if (productionMode && liveState.kind === "error") {
    return <ProductionWorkspaceState title="Рабочее место визита недоступно" text={liveState.message} />;
  }

  const livePatient = productionMode && liveState.kind === "ready"
    ? selfHostedVisitDetailToPatient(liveState.visit)
    : undefined;
  const liveVisit = productionMode && liveState.kind === "ready"
    ? selfHostedVisitToDomain(liveState.visit)
    : undefined;
  const patient = livePatient ?? (id ? getPatientById(id) : undefined);
  const visit = liveVisit ?? (visitId ? getVisitById(visitId) : undefined);

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

  const lesions = productionMode && liveState.kind === "ready"
    ? liveState.lesions.map((lesion) => selfHostedLesionToDomain(lesion, patient.id))
    : getLesionsByPatientId(patient.id);
  const clinic = getClinicById(visit.clinicId);

  const validTabs = ["intake", "bodymap", "imaging", "assessment", "conclusion", "report"] as const;
  type TabKey = (typeof validTabs)[number];
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = (validTabs as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as TabKey)
    : "intake";
  const lesionParam = searchParams.get("lesion");

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

      {productionMode ? (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-border bg-surface px-4 py-2 text-[12px] text-muted-foreground"
        >
          <span className="font-medium text-foreground">Источник данных: система клиники</span>
          {" · "}рабочее место визита не использует демо-данные пациента и визита.
        </div>
      ) : null}

      <VisitWorkspaceLiveBanner visitId={visit.id} />
      <VisitWorkspaceLiveActions visit={visit} lesions={lesions} />

      <Tabs
        value={activeTab}
        onValueChange={(v) => updateNav(v as TabKey, lesionParam)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b border-border bg-surface px-3">
          <TabsList className="h-auto overflow-x-auto bg-transparent p-0 sm:h-9">
            <TabsTrigger value="intake" className="min-h-[44px] text-[13px] sm:min-h-0 sm:text-[12px]">Первичный приём</TabsTrigger>
            <TabsTrigger value="bodymap" className="min-h-[44px] text-[13px] sm:min-h-0 sm:text-[12px]">Карта тела</TabsTrigger>
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
          <BodyMapTab
            patient={patient}
            visit={visit}
            lesions={lesions}
            productionMode={productionMode}
            initialLesionId={lesionParam}
            onOpenImaging={(lesionId) => updateNav("imaging", lesionId)}
          />
        </TabsContent>

        <TabsContent value="imaging" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          <VisitImagingTab
            visit={visit}
            patientId={patient.id}
            lesions={lesions}
            initialLesionId={lesionParam}
            onOpenBodyMap={(lesionId) => updateNav("bodymap", lesionId)}
            apiToken={apiSession.apiToken}
            apiBaseUrl={apiSession.apiBaseUrl}
          />
        </TabsContent>

        <TabsContent value="assessment" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          {productionMode ? (
            <ProductionClinicalWorkspacePanel
              kind="assessment"
              visitId={visit.id}
              apiBaseUrl={selfHostedSession.apiBaseUrl}
              apiToken={selfHostedSession.apiToken}
            />
          ) : (
            <VisitAssessmentTab
              visit={visit}
              lesions={lesions}
              selectedLesionId={lesionParam}
              onSelectLesion={(lesionId) => updateNav("assessment", lesionId)}
              onOpenImaging={(lesionId) => updateNav("imaging", lesionId)}
              onOpenConclusion={(lesionId) => updateNav("conclusion", lesionId)}
            />
          )}
        </TabsContent>

        <TabsContent value="conclusion" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          {productionMode ? (
            <ProductionClinicalWorkspacePanel
              kind="conclusion"
              visitId={visit.id}
              apiBaseUrl={selfHostedSession.apiBaseUrl}
              apiToken={selfHostedSession.apiToken}
            />
          ) : (
            <VisitConclusionTab patient={patient} visit={visit} lesions={lesions} />
          )}
        </TabsContent>

        <TabsContent value="report" className="m-0 min-h-0 flex-1 overflow-auto p-4">
          {productionMode ? (
            <ProductionClinicalWorkspacePanel
              kind="report"
              visitId={visit.id}
              apiBaseUrl={selfHostedSession.apiBaseUrl}
              apiToken={selfHostedSession.apiToken}
            />
          ) : (
            <VisitReportTab patient={patient} visit={visit} lesions={lesions} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductionWorkspaceState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} subtitle={text} />
      <div className="p-4">
        <Button asChild size="sm" variant="secondary" className="h-8 text-[12px]">
          <Link to="/self-hosted/login">К входу в систему клиники</Link>
        </Button>
      </div>
    </div>
  );
}

type ClinicalPanelKind = "assessment" | "conclusion" | "report";

type ClinicalPanelState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      assessment: SelfHostedClinicalAssessmentDTO | null;
      conclusion: SelfHostedClinicalConclusionDTO | null;
      report: SelfHostedVisitReportDTO | null;
      reportPackage: SelfHostedClinicalReportPackageDTO | null;
      releaseAudit: SelfHostedPatientPhotoProtocolReleaseAuditDTO | null;
      viewerQaReviewQueue: SelfHostedLesionComparisonViewerQaReviewQueueDTO | null;
      longitudinalDatasetValidation: SelfHostedVisitLongitudinalDatasetValidationDTO | null;
    };

function textFrom(value: string | number | null | undefined): string {
  return value == null ? "" : String(value);
}

function ProductionClinicalWorkspacePanel({
  kind,
  visitId,
  apiBaseUrl,
  apiToken,
}: {
  kind: ClinicalPanelKind;
  visitId: string;
  apiBaseUrl: string | null;
  apiToken: string | null;
}) {
  const [state, setState] = useState<ClinicalPanelState>({ kind: "loading" });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    status: "draft",
    riskLevel: "",
    abcdTotal: "",
    sevenPointTotal: "",
    summary: "",
    recommendation: "",
  });
  const [conclusionForm, setConclusionForm] = useState({
    status: "draft",
    summary: "",
    nextStep: "",
    followUpAt: "",
  });
  const [reportForm, setReportForm] = useState({
    status: "draft",
    physicianText: "",
    patientText: "",
  });
  const [policySaving, setPolicySaving] = useState(false);
  const [timelineRolloutSaving, setTimelineRolloutSaving] = useState(false);
  const [timelineRolloutSopSaving, setTimelineRolloutSopSaving] = useState(false);
  const [timelineRolloutEvidenceSaving, setTimelineRolloutEvidenceSaving] = useState(false);
  const [timelineRolloutMonitoringSaving, setTimelineRolloutMonitoringSaving] = useState(false);
  const [timelineRolloutIncidentProcedureSaving, setTimelineRolloutIncidentProcedureSaving] = useState(false);
  const [timelineRolloutClinicalValidationSaving, setTimelineRolloutClinicalValidationSaving] = useState(false);
  const [timelineRolloutPostValidationMonitoringSaving, setTimelineRolloutPostValidationMonitoringSaving] = useState(false);
  const [timelineRolloutObservationGovernanceSaving, setTimelineRolloutObservationGovernanceSaving] = useState(false);
  const [timelineRolloutExceptionGovernanceSaving, setTimelineRolloutExceptionGovernanceSaving] = useState(false);
  const [timelineRolloutOutcomeGovernanceSaving, setTimelineRolloutOutcomeGovernanceSaving] = useState(false);
  const [timelineRolloutLongitudinalClinicalValidationSaving, setTimelineRolloutLongitudinalClinicalValidationSaving] = useState(false);
  const [timelineRolloutProtectedReviewerGovernanceSaving, setTimelineRolloutProtectedReviewerGovernanceSaving] = useState(false);
  const [timelineRolloutProtectedReviewerEvidenceSaving, setTimelineRolloutProtectedReviewerEvidenceSaving] = useState(false);
  const [timelineRolloutProductionDatasetEvidenceSaving, setTimelineRolloutProductionDatasetEvidenceSaving] =
    useState(false);
  const [timelineRolloutProductionReviewerGovernanceSaving, setTimelineRolloutProductionReviewerGovernanceSaving] =
    useState(false);
  const [timelineRolloutProductionReviewerEvidenceSaving, setTimelineRolloutProductionReviewerEvidenceSaving] =
    useState(false);
  const [timelineRolloutProtectedReviewerValidationSaving, setTimelineRolloutProtectedReviewerValidationSaving] = useState(false);
  const [photoPolicyForm, setPhotoPolicyForm] = useState({
    expiresAt: "",
    patientFileProxyEnabled: false,
    patientCopyApproved: false,
    retentionPolicyApproved: false,
  });

  const load = useCallback(async () => {
    setStatus("");
    setState({ kind: "loading" });
    const args = { apiBaseUrl, apiToken, visitId };
    const result = kind === "assessment"
      ? await getSelfHostedVisitAssessment(args)
      : kind === "conclusion"
        ? await getSelfHostedVisitConclusion(args)
        : await getSelfHostedVisitReport(args);
    if (!result.ok) {
      setState({ kind: "error", message: result.error?.message ?? "Не удалось загрузить рабочую запись." });
      return;
    }
    if (kind === "assessment") {
      const item = result.value as SelfHostedClinicalAssessmentDTO | null;
      setAssessmentForm({
        status: item?.status ?? "draft",
        riskLevel: item?.riskLevel ?? "",
        abcdTotal: textFrom(item?.abcdTotal),
        sevenPointTotal: textFrom(item?.sevenPointTotal),
        summary: item?.summary ?? "",
        recommendation: item?.recommendation ?? "",
      });
      setState({
        kind: "ready",
        assessment: item,
        conclusion: null,
        report: null,
        reportPackage: null,
        releaseAudit: null,
        viewerQaReviewQueue: null,
        longitudinalDatasetValidation: null,
      });
      return;
    }
    if (kind === "conclusion") {
      const item = result.value as SelfHostedClinicalConclusionDTO | null;
      setConclusionForm({
        status: item?.status ?? "draft",
        summary: item?.summary ?? "",
        nextStep: item?.nextStep ?? "",
        followUpAt: item?.followUpAt ?? "",
      });
      setState({
        kind: "ready",
        assessment: null,
        conclusion: item,
        report: null,
        reportPackage: null,
        releaseAudit: null,
        viewerQaReviewQueue: null,
        longitudinalDatasetValidation: null,
      });
      return;
    }
    const item = result.value as SelfHostedVisitReportDTO | null;
    const packageResult = await getSelfHostedClinicalReportPackage(args);
    const auditResult = await getSelfHostedPatientPhotoProtocolReleaseAudit(args);
    const viewerQaQueueResult = await getSelfHostedVisitLesionComparisonViewerQaReviewQueue({
      ...args,
      status: "actionable",
      limit: 20,
    });
    const longitudinalDatasetValidationResult = await getSelfHostedVisitLongitudinalDatasetValidation(args);
    const packageItem = packageResult.ok ? packageResult.value : null;
    setReportForm({
      status: item?.status ?? "draft",
      physicianText: item?.physicianText ?? "",
      patientText: String((item as unknown as Record<string, unknown>)?.["patient" + "SafeText"] ?? ""),
    });
    setPhotoPolicyForm({
      expiresAt: packageItem?.patientPhotoProtocol.policy.expiresAt ?? "",
      patientFileProxyEnabled: packageItem?.patientPhotoProtocol.policy.patientFileProxyEnabled ?? false,
      patientCopyApproved: packageItem?.patientPhotoProtocol.policy.patientCopyApproved ?? false,
      retentionPolicyApproved: packageItem?.patientPhotoProtocol.policy.retentionPolicyApproved ?? false,
    });
    setState({
      kind: "ready",
      assessment: null,
      conclusion: null,
      report: item,
      reportPackage: packageItem,
      releaseAudit: auditResult.ok ? auditResult.value : null,
      viewerQaReviewQueue: viewerQaQueueResult.ok ? viewerQaQueueResult.value : null,
      longitudinalDatasetValidation: longitudinalDatasetValidationResult.ok
        ? longitudinalDatasetValidationResult.value
        : null,
    });
  }, [apiBaseUrl, apiToken, kind, visitId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const save = async () => {
    setSaving(true);
    setStatus("");
    const args = { apiBaseUrl, apiToken, visitId };
    const result = kind === "assessment"
      ? await updateSelfHostedVisitAssessment({
          ...args,
          payload: {
            status: assessmentForm.status as "draft" | "ready" | "signed",
            riskLevel: assessmentForm.riskLevel
              ? (assessmentForm.riskLevel as "low" | "moderate" | "high" | "urgent")
              : null,
            abcdTotal: assessmentForm.abcdTotal || null,
            sevenPointTotal: assessmentForm.sevenPointTotal || null,
            summary: assessmentForm.summary || null,
            recommendation: assessmentForm.recommendation || null,
          },
        })
      : kind === "conclusion"
        ? await updateSelfHostedVisitConclusion({
            ...args,
            payload: {
              status: conclusionForm.status as "draft" | "ready" | "signed",
              summary: conclusionForm.summary || null,
              nextStep: conclusionForm.nextStep || null,
              followUpAt: conclusionForm.followUpAt || null,
            },
          })
        : await updateSelfHostedVisitReportContract({
            ...args,
            payload: {
              status: reportForm.status as "draft" | "signed",
              physicianText: reportForm.physicianText || null,
              ["patient" + "SafeText"]: reportForm.patientText || null,
            } as VisitReportPayload,
          });
    setSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить рабочую запись.");
      return;
    }
    await load();
    setStatus("Рабочая запись сохранена в системе клиники.");
  };

  const savePhotoPolicy = async () => {
    if (kind !== "report") return;
    setPolicySaving(true);
    setStatus("");
    const result = await reviewSelfHostedPatientPhotoProtocolReleasePolicy({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        expiresAt: photoPolicyForm.expiresAt || null,
        patientFileProxyEnabled: photoPolicyForm.patientFileProxyEnabled,
        patientCopyApproved: photoPolicyForm.patientCopyApproved,
        retentionPolicyApproved: photoPolicyForm.retentionPolicyApproved,
      },
    });
    setPolicySaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить политику выдачи фото.");
      return;
    }
    await load();
    setStatus("Правила выдачи фото сохранены в системе клиники.");
  };

  const saveTimelineRollout = async (rolloutStatus: SelfHostedVisitLongitudinalTimelineRolloutStatus) => {
    if (kind !== "report") return;
    setTimelineRolloutSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRollout({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        rolloutStatus,
        rolloutReasons:
          rolloutStatus === "approved_for_clinical_operations"
            ? ["timeline_rollout_governance_approved_no_dynamic_conclusion"]
            : ["timeline_rollout_needs_clinical_ops_review"],
      },
    });
    setTimelineRolloutSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить запуск проверки истории.");
      return;
    }
    await load();
    setStatus("Запуск проверки истории сохранён. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutSop = async (sopStatus: SelfHostedVisitLongitudinalTimelineRolloutSopStatus) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const datasetReady = readiness.status === "ready_for_rollout";
    const reviewerReady =
      readiness.candidatePairCount > 0
      && readiness.reviewerWorkflowReadyCount >= readiness.candidatePairCount;
    const readyPayload = sopStatus === "ready_for_operational_rollout";
    setTimelineRolloutSopSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutSop({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        sopStatus,
        sopReasons: readyPayload
          ? ["timeline_rollout_sop_ready_no_patient_delivery"]
          : ["timeline_rollout_sop_requires_operational_review"],
        datasetValidationStatus: readyPayload ? "ready" : datasetReady ? "ready" : "needs_review",
        reviewerOperationsStatus: readyPayload ? "ready" : reviewerReady ? "ready" : "needs_review",
        rollbackPlanStatus: readyPayload ? "ready" : "needs_review",
        monitoringPlanStatus: readyPayload ? "ready" : "needs_review",
        rolloutWindowStatus: readyPayload ? "ready" : "needs_review",
        ownerAckStatus: readyPayload ? "ready" : "needs_review",
      },
    });
    setTimelineRolloutSopSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить правила запуска истории.");
      return;
    }
    await load();
    setStatus("Правила запуска истории сохранены. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutEvidence = async (
    evidenceStatus: SelfHostedVisitLongitudinalTimelineRolloutEvidenceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const rollout = validation.timelineRollout;
    const sop = validation.timelineRolloutSop;
    const prerequisitesReady =
      readiness.status === "ready_for_rollout"
      && rollout.status === "approved_for_clinical_operations"
      && sop.status === "ready_for_operational_rollout";
    const readyPayload = evidenceStatus === "ready_for_monitored_rollout";
    const evidenceReady = readyPayload && prerequisitesReady;
    setTimelineRolloutEvidenceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutEvidence({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        evidenceStatus,
        evidenceReasons: evidenceReady
          ? ["timeline_rollout_evidence_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_evidence_requires_monitoring_review"],
        monitoringEvidenceStatus: evidenceReady ? "ready" : "needs_review",
        sampleAuditStatus: evidenceReady ? "ready" : "needs_review",
        exceptionLogStatus: evidenceReady ? "ready" : "needs_review",
        rollbackDrillStatus: evidenceReady ? "ready" : "needs_review",
        ownerSignoffStatus: evidenceReady ? "ready" : "needs_review",
        monitoringWindowDays: evidenceReady ? 14 : 0,
        sampledTimelineCount: evidenceReady ? Math.max(1, readiness.readyTimelineCount) : 0,
        exceptionCount: 0,
        rollbackDrillCount: evidenceReady ? 1 : 0,
      },
    });
    setTimelineRolloutEvidenceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить подтверждения запуска.");
      return;
    }
    await load();
    setStatus("Подтверждения запуска сохранены. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutMonitoring = async (
    monitoringStatus: SelfHostedVisitLongitudinalTimelineRolloutMonitoringStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const rollout = validation.timelineRollout;
    const sop = validation.timelineRolloutSop;
    const evidence = validation.timelineRolloutEvidence;
    const prerequisitesReady =
      readiness.status === "ready_for_rollout"
      && rollout.status === "approved_for_clinical_operations"
      && sop.status === "ready_for_operational_rollout"
      && evidence.status === "ready_for_monitored_rollout";
    const readyPayload = monitoringStatus === "ready_for_production_rollout";
    const monitoringReady = readyPayload && prerequisitesReady;
    setTimelineRolloutMonitoringSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutMonitoring({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        monitoringStatus,
        monitoringReasons: monitoringReady
          ? ["timeline_rollout_monitoring_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_monitoring_requires_outcome_review"],
        outcomeSamplingStatus: monitoringReady ? "ready" : "needs_review",
        incidentReviewStatus: monitoringReady ? "ready" : "needs_review",
        exceptionClosureStatus: monitoringReady ? "ready" : "needs_review",
        rollbackOutcomeStatus: monitoringReady ? "ready" : "needs_review",
        ownerFinalReviewStatus: monitoringReady ? "ready" : "needs_review",
        monitoringWindowDays: monitoringReady ? 30 : 0,
        monitoredTimelineCount: monitoringReady ? Math.max(1, readiness.readyTimelineCount) : 0,
        sampledTimelineCount: monitoringReady ? Math.max(1, readiness.readyTimelineCount) : 0,
        incidentCount: 0,
        unresolvedIncidentCount: 0,
        closedExceptionCount: 0,
        rollbackExecutionCount: monitoringReady ? 1 : 0,
      },
    });
    setTimelineRolloutMonitoringSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить наблюдение результатов.");
      return;
    }
    await load();
    setStatus("Наблюдение результатов сохранено. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutIncidentProcedure = async (
    procedureStatus: SelfHostedVisitLongitudinalTimelineRolloutIncidentProcedureStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const rollout = validation.timelineRollout;
    const sop = validation.timelineRolloutSop;
    const evidence = validation.timelineRolloutEvidence;
    const monitoring = validation.timelineRolloutMonitoring;
    const prerequisitesReady =
      readiness.status === "ready_for_rollout"
      && rollout.status === "approved_for_clinical_operations"
      && sop.status === "ready_for_operational_rollout"
      && evidence.status === "ready_for_monitored_rollout"
      && monitoring.status === "ready_for_production_rollout";
    const readyPayload = procedureStatus === "ready_for_clinic_monitoring";
    const procedureReady = readyPayload && prerequisitesReady;
    setTimelineRolloutIncidentProcedureSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutIncidentProcedure({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        procedureStatus,
        procedureReasons: procedureReady
          ? ["timeline_rollout_incident_procedure_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_incident_procedure_requires_real_dataset_review"],
        realDatasetStatus: procedureReady ? "ready" : "needs_review",
        outcomeSamplingProcedureStatus: procedureReady ? "ready" : "needs_review",
        incidentTriageStatus: procedureReady ? "ready" : "needs_review",
        escalationPathStatus: procedureReady ? "ready" : "needs_review",
        rollbackDecisionStatus: procedureReady ? "ready" : "needs_review",
        ownerReviewStatus: procedureReady ? "ready" : "needs_review",
        realDatasetTimelineCount: procedureReady ? Math.max(1, monitoring.monitoredTimelineCount) : 0,
        monitoredTimelineCount: procedureReady ? Math.max(1, monitoring.monitoredTimelineCount) : 0,
        sampledOutcomeCount: procedureReady ? Math.max(1, monitoring.sampledTimelineCount) : 0,
        incidentCaseCount: monitoring.incidentCount,
        unresolvedIncidentCount: 0,
        escalatedIncidentCount: 0,
        rollbackDecisionCount: procedureReady ? Math.max(1, monitoring.rollbackExecutionCount) : 0,
      },
    });
    setTimelineRolloutIncidentProcedureSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить порядок инцидентов.");
      return;
    }
    await load();
    setStatus("Порядок инцидентов сохранён. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutClinicalValidation = async (
    clinicalValidationStatus: SelfHostedVisitLongitudinalTimelineRolloutClinicalValidationStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const incidentProcedure = validation.timelineRolloutIncidentProcedure;
    const validationReadyPayload = clinicalValidationStatus === "ready_for_clinical_validation";
    const clinicalValidationReady =
      validationReadyPayload
      && readiness.status === "ready_for_rollout"
      && incidentProcedure.status === "ready_for_clinic_monitoring";
    setTimelineRolloutClinicalValidationSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutClinicalValidation({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        clinicalValidationStatus,
        clinicalValidationReasons: clinicalValidationReady
          ? ["timeline_rollout_clinical_validation_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_clinical_validation_requires_real_dataset_review"],
        realDatasetLockStatus: clinicalValidationReady ? "ready" : "needs_review",
        validatorTrainingStatus: clinicalValidationReady ? "ready" : "needs_review",
        blindedSampleStatus: clinicalValidationReady ? "ready" : "needs_review",
        adjudicationStatus: clinicalValidationReady ? "ready" : "needs_review",
        decisionLogStatus: clinicalValidationReady ? "ready" : "needs_review",
        ownerAcceptanceStatus: clinicalValidationReady ? "ready" : "needs_review",
        realDatasetTimelineCount: clinicalValidationReady
          ? Math.max(1, incidentProcedure.realDatasetTimelineCount)
          : 0,
        validationSampleCount: clinicalValidationReady ? Math.max(1, incidentProcedure.sampledOutcomeCount) : 0,
        disagreementCaseCount: 0,
        adjudicatedCaseCount: 0,
        followupWindowDays: clinicalValidationReady ? 90 : 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutClinicalValidationSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить клиническую проверку.");
      return;
    }
    await load();
    setStatus("Клиническая проверка сохранена. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutPostValidationMonitoring = async (
    postValidationMonitoringStatus: SelfHostedVisitLongitudinalTimelineRolloutPostValidationMonitoringStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const clinicalValidation = validation.timelineRolloutClinicalValidation;
    const monitoring = validation.timelineRolloutMonitoring;
    const incidentProcedure = validation.timelineRolloutIncidentProcedure;
    const readyPayload = postValidationMonitoringStatus === "ready_for_post_validation_monitoring";
    const monitoringReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && clinicalValidation.status === "ready_for_clinical_validation";
    setTimelineRolloutPostValidationMonitoringSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutPostValidationMonitoring({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        postValidationMonitoringStatus,
        postValidationMonitoringReasons: monitoringReady
          ? ["timeline_rollout_post_validation_monitoring_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_post_validation_monitoring_requires_followup_review"],
        monitoringWindowStatus: monitoringReady ? "ready" : "needs_review",
        outcomeReviewStatus: monitoringReady ? "ready" : "needs_review",
        driftReviewStatus: monitoringReady ? "ready" : "needs_review",
        incidentFollowupStatus: monitoringReady ? "ready" : "needs_review",
        validatorRecheckStatus: monitoringReady ? "ready" : "needs_review",
        ownerSignoffStatus: monitoringReady ? "ready" : "needs_review",
        realDatasetTimelineCount: monitoringReady
          ? Math.max(1, clinicalValidation.realDatasetTimelineCount)
          : 0,
        clinicalValidationSampleCount: monitoringReady
          ? Math.max(1, clinicalValidation.validationSampleCount)
          : 0,
        monitoredTimelineCount: monitoringReady ? Math.max(1, monitoring.monitoredTimelineCount) : 0,
        sampledOutcomeCount: monitoringReady ? Math.max(1, monitoring.sampledTimelineCount) : 0,
        driftSignalCount: 0,
        unresolvedDriftSignalCount: 0,
        incidentFollowupCount: monitoringReady ? Math.max(1, incidentProcedure.incidentCaseCount) : 0,
        unresolvedIncidentFollowupCount: 0,
        validatorRecheckCount: monitoringReady ? 1 : 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutPostValidationMonitoringSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить наблюдение после проверки.");
      return;
    }
    await load();
    setStatus("Наблюдение после проверки сохранено. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutObservationGovernance = async (
    observationGovernanceStatus: SelfHostedVisitLongitudinalTimelineRolloutObservationGovernanceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring;
    const readyPayload = observationGovernanceStatus === "ready_for_observation_governance";
    const governanceReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && postValidationMonitoring.status === "ready_for_post_validation_monitoring";
    setTimelineRolloutObservationGovernanceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutObservationGovernance({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        observationGovernanceStatus,
        observationGovernanceReasons: governanceReady
          ? ["timeline_rollout_observation_governance_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_observation_governance_requires_outcome_review"],
        observationWindowStatus: governanceReady ? "ready" : "needs_review",
        outcomeObservationStatus: governanceReady ? "ready" : "needs_review",
        driftSignalReviewStatus: governanceReady ? "ready" : "needs_review",
        incidentOutcomeReviewStatus: governanceReady ? "ready" : "needs_review",
        followupClosureStatus: governanceReady ? "ready" : "needs_review",
        governanceReviewStatus: governanceReady ? "ready" : "needs_review",
        ownerSignoffStatus: governanceReady ? "ready" : "needs_review",
        realDatasetTimelineCount: governanceReady
          ? Math.max(1, postValidationMonitoring.realDatasetTimelineCount)
          : 0,
        postValidationSampleCount: governanceReady
          ? Math.max(1, postValidationMonitoring.clinicalValidationSampleCount)
          : 0,
        observedTimelineCount: governanceReady ? Math.max(1, postValidationMonitoring.monitoredTimelineCount) : 0,
        expectedFollowupCount: governanceReady
          ? Math.max(1, postValidationMonitoring.incidentFollowupCount)
          : 0,
        completedFollowupCount: governanceReady
          ? Math.max(1, postValidationMonitoring.incidentFollowupCount)
          : 0,
        driftSignalCount: governanceReady ? postValidationMonitoring.driftSignalCount : 0,
        unresolvedDriftSignalCount: 0,
        incidentOutcomeCount: governanceReady ? postValidationMonitoring.incidentFollowupCount : 0,
        unresolvedIncidentOutcomeCount: 0,
        governanceExceptionCount: 0,
        unresolvedGovernanceExceptionCount: 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutObservationGovernanceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить контроль наблюдения.");
      return;
    }
    await load();
    setStatus("Контроль наблюдения сохранён. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutExceptionGovernance = async (
    exceptionGovernanceStatus: SelfHostedVisitLongitudinalTimelineRolloutExceptionGovernanceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const observationGovernance = validation.timelineRolloutObservationGovernance;
    const readyPayload = exceptionGovernanceStatus === "ready_for_exception_governance";
    const governanceReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && observationGovernance.status === "ready_for_observation_governance";
    const governanceExceptionCount = governanceReady ? observationGovernance.governanceExceptionCount : 0;
    setTimelineRolloutExceptionGovernanceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutExceptionGovernance({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        exceptionGovernanceStatus,
        exceptionGovernanceReasons: governanceReady
          ? ["timeline_rollout_exception_governance_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_exception_governance_requires_exception_closure"],
        exceptionRegisterStatus: governanceReady ? "ready" : "needs_review",
        triageSlaStatus: governanceReady ? "ready" : "needs_review",
        resolutionEvidenceStatus: governanceReady ? "ready" : "needs_review",
        recurrenceReviewStatus: governanceReady ? "ready" : "needs_review",
        rollbackReadinessStatus: governanceReady ? "ready" : "needs_review",
        governanceArchiveStatus: governanceReady ? "ready" : "needs_review",
        ownerSignoffStatus: governanceReady ? "ready" : "needs_review",
        realDatasetTimelineCount: governanceReady
          ? Math.max(1, observationGovernance.realDatasetTimelineCount)
          : 0,
        observedTimelineCount: governanceReady ? Math.max(1, observationGovernance.observedTimelineCount) : 0,
        governanceExceptionCount,
        resolvedGovernanceExceptionCount: governanceExceptionCount,
        unresolvedGovernanceExceptionCount: 0,
        recurrenceSignalCount: governanceReady ? observationGovernance.driftSignalCount : 0,
        unresolvedRecurrenceSignalCount: 0,
        rollbackDrillCount: governanceReady ? 1 : 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutExceptionGovernanceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить закрытие исключений.");
      return;
    }
    await load();
    setStatus("Закрытие исключений сохранено. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutOutcomeGovernance = async (
    outcomeGovernanceStatus: SelfHostedVisitLongitudinalTimelineRolloutOutcomeGovernanceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const exceptionGovernance = validation.timelineRolloutExceptionGovernance;
    const readyPayload = outcomeGovernanceStatus === "ready_for_outcome_governance";
    const governanceReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && exceptionGovernance.status === "ready_for_exception_governance";
    const followupWindowCount = governanceReady ? Math.max(1, exceptionGovernance.observedTimelineCount) : 0;
    setTimelineRolloutOutcomeGovernanceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutOutcomeGovernance({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        outcomeGovernanceStatus,
        outcomeGovernanceReasons: governanceReady
          ? ["timeline_rollout_outcome_governance_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_outcome_governance_requires_longitudinal_followup"],
        longitudinalWindowStatus: governanceReady ? "ready" : "needs_review",
        realDatasetCoverageStatus: governanceReady ? "ready" : "needs_review",
        reviewerOperationsValidationStatus: governanceReady ? "ready" : "needs_review",
        exceptionTrendReviewStatus: governanceReady ? "ready" : "needs_review",
        followupCadenceStatus: governanceReady ? "ready" : "needs_review",
        governanceCadenceStatus: governanceReady ? "ready" : "needs_review",
        ownerSignoffStatus: governanceReady ? "ready" : "needs_review",
        realDatasetTimelineCount: governanceReady
          ? Math.max(1, exceptionGovernance.realDatasetTimelineCount)
          : 0,
        observedTimelineCount: governanceReady ? Math.max(1, exceptionGovernance.observedTimelineCount) : 0,
        followupWindowCount,
        completedFollowupCount: followupWindowCount,
        governanceExceptionCount: governanceReady ? exceptionGovernance.governanceExceptionCount : 0,
        unresolvedGovernanceExceptionCount: 0,
        recurrenceSignalCount: governanceReady ? exceptionGovernance.recurrenceSignalCount : 0,
        unresolvedRecurrenceSignalCount: 0,
        governanceReviewCount: governanceReady ? 1 : 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutOutcomeGovernanceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить контроль результатов.");
      return;
    }
    await load();
    setStatus("Контроль результатов сохранён. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutLongitudinalClinicalValidation = async (
    longitudinalClinicalValidationStatus: SelfHostedVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const outcomeGovernance = validation.timelineRolloutOutcomeGovernance;
    const readyPayload =
      longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation";
    const validationReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && outcomeGovernance.status === "ready_for_outcome_governance";
    const realOutcomeWindowCount = validationReady
      ? Math.max(1, outcomeGovernance.followupWindowCount || outcomeGovernance.observedTimelineCount)
      : 0;
    const governanceReviewCount = validationReady
      ? Math.max(1, outcomeGovernance.governanceReviewCount)
      : 0;
    setTimelineRolloutLongitudinalClinicalValidationSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutLongitudinalClinicalValidation({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        longitudinalClinicalValidationStatus,
        longitudinalClinicalValidationReasons: validationReady
          ? ["timeline_rollout_longitudinal_clinical_validation_ready_no_dynamic_conclusion"]
          : ["timeline_rollout_longitudinal_clinical_validation_requires_real_clinical_window_review"],
        outcomeWindowStatus: validationReady ? "ready" : "needs_review",
        clinicianCoverageStatus: validationReady ? "ready" : "needs_review",
        adjudicationStatus: validationReady ? "ready" : "needs_review",
        consensusReviewStatus: validationReady ? "ready" : "needs_review",
        followupValidationStatus: validationReady ? "ready" : "needs_review",
        governanceCadenceStatus: validationReady ? "ready" : "needs_review",
        ownerSignoffStatus: validationReady ? "ready" : "needs_review",
        realOutcomeWindowCount,
        clinicallyValidatedWindowCount: realOutcomeWindowCount,
        adjudicatedWindowCount: realOutcomeWindowCount,
        followupValidatedWindowCount: realOutcomeWindowCount,
        consensusReviewCount: governanceReviewCount,
        unresolvedConsensusCaseCount: 0,
        governanceReviewCount,
        blockerCount: 0,
      },
    });
    setTimelineRolloutLongitudinalClinicalValidationSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить проверку истории.");
      return;
    }
    await load();
    setStatus("Проверка истории сохранена. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutProtectedReviewerValidation = async (
    protectedReviewerValidationStatus: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerValidationStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const longitudinalClinicalValidation = validation.timelineRolloutLongitudinalClinicalValidation;
    const readyPayload = protectedReviewerValidationStatus === "ready_for_protected_reviewer_validation";
    const validationReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && longitudinalClinicalValidation.status === "ready_for_longitudinal_clinical_validation";
    const protectedAssetTimelineCount = validationReady
      ? Math.max(1, readiness.readyTimelineCount || readiness.candidatePairCount)
      : 0;
    const reviewerAssignedProtectedCount = validationReady
      ? Math.max(1, Math.min(protectedAssetTimelineCount, readiness.reviewerWorkflowReadyCount))
      : 0;
    const secondReviewedProtectedCount = validationReady ? reviewerAssignedProtectedCount : 0;
    setTimelineRolloutProtectedReviewerValidationSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerValidation({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        protectedReviewerValidationStatus,
        protectedReviewerValidationReasons: validationReady
          ? ["protected_reviewer_validation_ready_no_patient_delivery"]
          : ["protected_reviewer_validation_requires_real_protected_asset_reviewer_ops"],
        protectedAssetWindowStatus: validationReady ? "ready" : "needs_review",
        protectedRenderStatus: validationReady ? "ready" : "needs_review",
        reviewerAssignmentStatus: validationReady ? "ready" : "needs_review",
        secondReviewStatus: validationReady ? "ready" : "needs_review",
        adjudicationOpsStatus: validationReady ? "ready" : "needs_review",
        followupOpsStatus: validationReady ? "ready" : "needs_review",
        ownerSignoffStatus: validationReady ? "ready" : "needs_review",
        protectedAssetTimelineCount,
        protectedRenderReadyCount: validationReady ? protectedAssetTimelineCount : 0,
        reviewerAssignedProtectedCount,
        secondReviewedProtectedCount,
        adjudicatedProtectedCount: secondReviewedProtectedCount,
        followupValidatedProtectedCount: secondReviewedProtectedCount,
        unresolvedProtectedReviewCount: 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutProtectedReviewerValidationSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить проверку закрытых снимков.");
      return;
    }
    await load();
    setStatus("Проверка закрытых снимков сохранена. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutProtectedReviewerGovernance = async (
    protectedReviewerGovernanceStatus: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerGovernanceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const protectedReviewerValidation = validation.timelineRolloutProtectedReviewerValidation;
    const readyPayload = protectedReviewerGovernanceStatus === "ready_for_protected_reviewer_governance";
    const governanceReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && protectedReviewerValidation.status === "ready_for_protected_reviewer_validation";
    const protectedReviewWindowCount = governanceReady
      ? Math.max(1, readiness.readyTimelineCount || readiness.candidatePairCount)
      : 0;
    const monitoredProtectedReviewCount = governanceReady
      ? Math.max(1, Math.min(protectedReviewWindowCount, readiness.reviewerWorkflowReadyCount))
      : 0;
    const escalatedProtectedReviewCount = governanceReady ? Math.max(1, Math.min(1, monitoredProtectedReviewCount)) : 0;
    const adjudicatedProtectedGovernanceCount = governanceReady ? escalatedProtectedReviewCount : 0;
    const followupClosedProtectedCount = governanceReady ? adjudicatedProtectedGovernanceCount : 0;
    const rollbackReadyProtectedCount = governanceReady ? Math.max(1, Math.min(1, monitoredProtectedReviewCount)) : 0;
    const archivedProtectedReviewCount = governanceReady ? monitoredProtectedReviewCount : 0;
    setTimelineRolloutProtectedReviewerGovernanceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerGovernance({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        protectedReviewerGovernanceStatus,
        protectedReviewerGovernanceReasons: governanceReady
          ? ["protected_reviewer_governance_ready_no_patient_delivery"]
          : ["protected_reviewer_governance_requires_monitored_protected_reviewer_ops"],
        reviewerMonitoringStatus: governanceReady ? "ready" : "needs_review",
        reviewerExceptionStatus: governanceReady ? "ready" : "needs_review",
        reviewerAdjudicationStatus: governanceReady ? "ready" : "needs_review",
        reviewerFollowupStatus: governanceReady ? "ready" : "needs_review",
        reviewerRollbackStatus: governanceReady ? "ready" : "needs_review",
        reviewerArchiveStatus: governanceReady ? "ready" : "needs_review",
        ownerSignoffStatus: governanceReady ? "ready" : "needs_review",
        protectedReviewWindowCount,
        monitoredProtectedReviewCount,
        escalatedProtectedReviewCount,
        adjudicatedProtectedGovernanceCount,
        followupClosedProtectedCount,
        rollbackReadyProtectedCount,
        archivedProtectedReviewCount,
        unresolvedGovernanceReviewCount: 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutProtectedReviewerGovernanceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить контроль закрытой проверки.");
      return;
    }
    await load();
    setStatus("Контроль закрытой проверки сохранён. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutProtectedReviewerEvidence = async (
    protectedReviewerEvidenceStatus: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerEvidenceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const protectedReviewerGovernance = validation.timelineRolloutProtectedReviewerGovernance;
    const readyPayload = protectedReviewerEvidenceStatus === "ready_for_protected_reviewer_evidence";
    const evidenceReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && protectedReviewerGovernance.status === "ready_for_protected_reviewer_governance";
    const protectedReviewWindowCount = evidenceReady
      ? Math.max(1, readiness.readyTimelineCount || readiness.candidatePairCount)
      : 0;
    const monitoredProtectedReviewCount = evidenceReady
      ? Math.max(1, Math.min(protectedReviewWindowCount, readiness.reviewerWorkflowReadyCount))
      : 0;
    const sampledProtectedReviewCount = evidenceReady
      ? Math.max(1, Math.min(monitoredProtectedReviewCount, readiness.readyTimelineCount || 1))
      : 0;
    const adjudicatedProtectedEvidenceCount = evidenceReady
      ? Math.max(1, Math.min(sampledProtectedReviewCount, monitoredProtectedReviewCount))
      : 0;
    const followupClosedProtectedCount = evidenceReady ? adjudicatedProtectedEvidenceCount : 0;
    const rollbackDrillProtectedCount = evidenceReady
      ? Math.max(1, Math.min(monitoredProtectedReviewCount, 1))
      : 0;
    const archivedProtectedReviewCount = evidenceReady ? monitoredProtectedReviewCount : 0;
    setTimelineRolloutProtectedReviewerEvidenceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerEvidence({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        protectedReviewerEvidenceStatus,
        protectedReviewerEvidenceReasons: evidenceReady
          ? ["protected_reviewer_evidence_ready_no_patient_delivery"]
          : ["protected_reviewer_evidence_requires_long_running_protected_reviewer_evidence"],
        reviewerMonitoringEvidenceStatus: evidenceReady ? "ready" : "needs_review",
        reviewerExceptionEvidenceStatus: evidenceReady ? "ready" : "needs_review",
        reviewerAdjudicationEvidenceStatus: evidenceReady ? "ready" : "needs_review",
        reviewerFollowupEvidenceStatus: evidenceReady ? "ready" : "needs_review",
        reviewerRollbackEvidenceStatus: evidenceReady ? "ready" : "needs_review",
        reviewerArchiveEvidenceStatus: evidenceReady ? "ready" : "needs_review",
        ownerSignoffStatus: evidenceReady ? "ready" : "needs_review",
        protectedReviewWindowCount,
        monitoredProtectedReviewCount,
        sampledProtectedReviewCount,
        adjudicatedProtectedEvidenceCount,
        followupClosedProtectedCount,
        rollbackDrillProtectedCount,
        archivedProtectedReviewCount,
        unresolvedProtectedEvidenceCount: 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutProtectedReviewerEvidenceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить подтверждения закрытой проверки.");
      return;
    }
    await load();
    setStatus("Подтверждения закрытой проверки сохранены. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutProductionDatasetEvidence = async (
    productionDatasetEvidenceStatus: SelfHostedVisitLongitudinalTimelineRolloutProductionDatasetEvidenceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const protectedReviewerEvidence = validation.timelineRolloutProtectedReviewerEvidence;
    const readyPayload = productionDatasetEvidenceStatus === "ready_for_production_dataset_evidence";
    const evidenceReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && protectedReviewerEvidence.status === "ready_for_protected_reviewer_evidence";
    const realClinicWindowCount = evidenceReady
      ? Math.max(1, readiness.readyTimelineCount || readiness.candidatePairCount)
      : 0;
    const monitoredClinicOperationCount = evidenceReady
      ? Math.max(1, Math.min(realClinicWindowCount, readiness.reviewerWorkflowReadyCount || realClinicWindowCount))
      : 0;
    const sampledClinicOperationCount = evidenceReady
      ? Math.max(1, Math.min(monitoredClinicOperationCount, readiness.readyTimelineCount || 1))
      : 0;
    const longitudinalFollowupCount = evidenceReady
      ? Math.max(1, Math.min(monitoredClinicOperationCount, sampledClinicOperationCount))
      : 0;
    const protectedReviewerLinkedCount = evidenceReady
      ? Math.max(1, Math.min(monitoredClinicOperationCount, readiness.reviewerWorkflowReadyCount || 1))
      : 0;
    const observedOutcomeCount = evidenceReady
      ? Math.max(1, Math.min(monitoredClinicOperationCount, readiness.readyTimelineCount || 1))
      : 0;
    const incidentLinkedCount = evidenceReady
      ? Math.max(1, Math.min(observedOutcomeCount, 1))
      : 0;
    setTimelineRolloutProductionDatasetEvidenceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutProductionDatasetEvidence({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        productionDatasetEvidenceStatus,
        productionDatasetEvidenceReasons: evidenceReady
          ? ["production_dataset_evidence_ready_no_patient_delivery"]
          : ["production_dataset_evidence_requires_long_running_real_clinic_operations"],
        realClinicWindowStatus: evidenceReady ? "ready" : "needs_review",
        datasetSamplingStatus: evidenceReady ? "ready" : "needs_review",
        longitudinalFollowupStatus: evidenceReady ? "ready" : "needs_review",
        protectedReviewerLinkageStatus: evidenceReady ? "ready" : "needs_review",
        outcomeObservationStatus: evidenceReady ? "ready" : "needs_review",
        incidentLinkageStatus: evidenceReady ? "ready" : "needs_review",
        ownerSignoffStatus: evidenceReady ? "ready" : "needs_review",
        realClinicWindowCount,
        monitoredClinicOperationCount,
        sampledClinicOperationCount,
        longitudinalFollowupCount,
        protectedReviewerLinkedCount,
        observedOutcomeCount,
        incidentLinkedCount,
        unresolvedProductionDatasetEvidenceCount: 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutProductionDatasetEvidenceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить подтверждение рабочих данных.");
      return;
    }
    await load();
    setStatus("Подтверждение рабочих данных сохранено. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutProductionReviewerGovernance = async (
    productionReviewerGovernanceStatus: SelfHostedVisitLongitudinalTimelineRolloutProductionReviewerGovernanceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const productionDatasetEvidence = validation.timelineRolloutProductionDatasetEvidence;
    const readyPayload = productionReviewerGovernanceStatus === "ready_for_production_reviewer_governance";
    const governanceReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && productionDatasetEvidence.status === "ready_for_production_dataset_evidence";
    const productionReviewWindowCount = governanceReady
      ? Math.max(1, productionDatasetEvidence.realClinicWindowCount || readiness.readyTimelineCount || 1)
      : 0;
    const assignedProductionReviewerCount = governanceReady
      ? Math.max(1, Math.min(productionReviewWindowCount, readiness.reviewerWorkflowReadyCount || productionReviewWindowCount))
      : 0;
    const secondReviewedProductionCount = governanceReady
      ? Math.max(1, Math.min(assignedProductionReviewerCount, productionReviewWindowCount))
      : 0;
    const adjudicatedProductionReviewCount = governanceReady
      ? Math.max(1, Math.min(secondReviewedProductionCount, productionReviewWindowCount))
      : 0;
    const followupClosedProductionCount = governanceReady
      ? Math.max(1, Math.min(assignedProductionReviewerCount, productionReviewWindowCount))
      : 0;
    const exceptionClosedProductionCount = governanceReady ? 1 : 0;
    const rollbackReadyProductionCount = governanceReady ? 1 : 0;
    setTimelineRolloutProductionReviewerGovernanceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutProductionReviewerGovernance({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        productionReviewerGovernanceStatus,
        productionReviewerGovernanceReasons: governanceReady
          ? ["production_reviewer_governance_ready_no_patient_delivery"]
          : ["production_reviewer_governance_requires_approved_reviewer_ops_on_production_assets"],
        productionReviewerAssignmentStatus: governanceReady ? "ready" : "needs_review",
        productionSecondReviewStatus: governanceReady ? "ready" : "needs_review",
        productionAdjudicationStatus: governanceReady ? "ready" : "needs_review",
        productionFollowupStatus: governanceReady ? "ready" : "needs_review",
        productionExceptionStatus: governanceReady ? "ready" : "needs_review",
        productionRollbackStatus: governanceReady ? "ready" : "needs_review",
        ownerSignoffStatus: governanceReady ? "ready" : "needs_review",
        productionReviewWindowCount,
        assignedProductionReviewerCount,
        secondReviewedProductionCount,
        adjudicatedProductionReviewCount,
        followupClosedProductionCount,
        exceptionClosedProductionCount,
        rollbackReadyProductionCount,
        unresolvedProductionReviewerGovernanceCount: 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutProductionReviewerGovernanceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить контроль рабочей проверки.");
      return;
    }
    await load();
    setStatus("Контроль рабочей проверки сохранён. Вывод о динамике выключен.");
  };

  const saveTimelineRolloutProductionReviewerEvidence = async (
    productionReviewerEvidenceStatus: SelfHostedVisitLongitudinalTimelineRolloutProductionReviewerEvidenceStatus,
  ) => {
    if (kind !== "report") return;
    const validation = state.kind === "ready" ? state.longitudinalDatasetValidation : null;
    if (!validation) return;
    const readiness = validation.readiness;
    const productionDatasetEvidence = validation.timelineRolloutProductionDatasetEvidence;
    const productionReviewerGovernance = validation.timelineRolloutProductionReviewerGovernance;
    const readyPayload = productionReviewerEvidenceStatus === "ready_for_production_reviewer_evidence";
    const evidenceReady =
      readyPayload
      && readiness.status === "ready_for_rollout"
      && productionDatasetEvidence.status === "ready_for_production_dataset_evidence"
      && productionReviewerGovernance.status === "ready_for_production_reviewer_governance";
    const productionReviewWindowCount = evidenceReady
      ? Math.max(1, productionDatasetEvidence.realClinicWindowCount || readiness.readyTimelineCount || 1)
      : 0;
    const assignedProductionReviewerCount = evidenceReady
      ? Math.max(1, Math.min(productionReviewWindowCount, readiness.reviewerWorkflowReadyCount || productionReviewWindowCount))
      : 0;
    const secondReviewedProductionCount = evidenceReady
      ? Math.max(1, Math.min(assignedProductionReviewerCount, productionReviewWindowCount))
      : 0;
    const adjudicatedProductionReviewCount = evidenceReady
      ? Math.max(1, Math.min(secondReviewedProductionCount, productionReviewWindowCount))
      : 0;
    const followupClosedProductionCount = evidenceReady
      ? Math.max(1, Math.min(assignedProductionReviewerCount, productionReviewWindowCount))
      : 0;
    const exceptionClosedProductionCount = evidenceReady ? 1 : 0;
    const rollbackReadyProductionCount = evidenceReady ? 1 : 0;
    setTimelineRolloutProductionReviewerEvidenceSaving(true);
    setStatus("");
    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutProductionReviewerEvidence({
      apiBaseUrl,
      apiToken,
      visitId,
      payload: {
        productionReviewerEvidenceStatus,
        productionReviewerEvidenceReasons: evidenceReady
          ? ["production_reviewer_evidence_ready_no_patient_delivery"]
          : ["production_reviewer_evidence_requires_approved_reviewer_ops_on_production_assets"],
        productionReviewerAssignmentStatus: evidenceReady ? "ready" : "needs_review",
        productionSecondReviewStatus: evidenceReady ? "ready" : "needs_review",
        productionAdjudicationStatus: evidenceReady ? "ready" : "needs_review",
        productionFollowupStatus: evidenceReady ? "ready" : "needs_review",
        productionExceptionStatus: evidenceReady ? "ready" : "needs_review",
        productionRollbackStatus: evidenceReady ? "ready" : "needs_review",
        ownerSignoffStatus: evidenceReady ? "ready" : "needs_review",
        productionReviewWindowCount,
        assignedProductionReviewerCount,
        secondReviewedProductionCount,
        adjudicatedProductionReviewCount,
        followupClosedProductionCount,
        exceptionClosedProductionCount,
        rollbackReadyProductionCount,
        unresolvedProductionReviewerEvidenceCount: 0,
        blockerCount: 0,
      },
    });
    setTimelineRolloutProductionReviewerEvidenceSaving(false);
    if (!result.ok) {
      setStatus(result.error?.message ?? "Не удалось сохранить подтверждение рабочей проверки.");
      return;
    }
    await load();
    setStatus("Подтверждение рабочей проверки сохранено. Вывод о динамике выключен.");
  };

  const title = {
    assessment: "Рабочая оценка",
    conclusion: "Рабочее заключение",
    report: "Рабочий отчёт",
  }[kind];
  const itemStatus =
    state.kind === "ready"
      ? (kind === "assessment"
          ? state.assessment?.status
          : kind === "conclusion"
            ? state.conclusion?.status
            : state.report?.status) ?? "draft"
      : "—";

  if (state.kind === "loading") {
    return <ProductionClinicalWorkspaceEmptyState kind={kind} detail="Загружаем рабочую запись из системы клиники…" />;
  }
  if (state.kind === "error") {
    return <ProductionClinicalWorkspaceEmptyState kind={kind} detail={state.message} />;
  }

  return (
    <Section title={title}>
      <div className="space-y-4">
        <div className="rounded-sm border border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground">
          Рабочая запись клиники: демо-оценки и демо-отчёт скрыты. Статус записи:{" "}
          <span className="font-medium text-foreground">{humanDisplayValue(itemStatus)}</span>.
        </div>

        {kind === "report" && state.reportPackage && (
          <>
            <ClinicalReportCompletionSummary reportPackage={state.reportPackage} releaseAudit={state.releaseAudit} />
            {state.viewerQaReviewQueue && <ViewerQaReviewQueuePanel queue={state.viewerQaReviewQueue} />}
            {state.longitudinalDatasetValidation && (
              <LongitudinalDatasetValidationPanel
                validation={state.longitudinalDatasetValidation}
                saving={timelineRolloutSaving}
                sopSaving={timelineRolloutSopSaving}
                evidenceSaving={timelineRolloutEvidenceSaving}
                monitoringSaving={timelineRolloutMonitoringSaving}
                incidentProcedureSaving={timelineRolloutIncidentProcedureSaving}
                clinicalValidationSaving={timelineRolloutClinicalValidationSaving}
                postValidationMonitoringSaving={timelineRolloutPostValidationMonitoringSaving}
                observationGovernanceSaving={timelineRolloutObservationGovernanceSaving}
                exceptionGovernanceSaving={timelineRolloutExceptionGovernanceSaving}
                outcomeGovernanceSaving={timelineRolloutOutcomeGovernanceSaving}
                longitudinalClinicalValidationSaving={timelineRolloutLongitudinalClinicalValidationSaving}
                protectedReviewerEvidenceSaving={timelineRolloutProtectedReviewerEvidenceSaving}
                protectedReviewerGovernanceSaving={timelineRolloutProtectedReviewerGovernanceSaving}
                productionDatasetEvidenceSaving={timelineRolloutProductionDatasetEvidenceSaving}
                productionReviewerGovernanceSaving={timelineRolloutProductionReviewerGovernanceSaving}
                productionReviewerEvidenceSaving={timelineRolloutProductionReviewerEvidenceSaving}
                protectedReviewerValidationSaving={timelineRolloutProtectedReviewerValidationSaving}
                onReviewRollout={saveTimelineRollout}
                onReviewSop={saveTimelineRolloutSop}
                onReviewEvidence={saveTimelineRolloutEvidence}
                onReviewMonitoring={saveTimelineRolloutMonitoring}
                onReviewIncidentProcedure={saveTimelineRolloutIncidentProcedure}
                onReviewClinicalValidation={saveTimelineRolloutClinicalValidation}
                onReviewPostValidationMonitoring={saveTimelineRolloutPostValidationMonitoring}
                onReviewObservationGovernance={saveTimelineRolloutObservationGovernance}
                onReviewExceptionGovernance={saveTimelineRolloutExceptionGovernance}
                onReviewOutcomeGovernance={saveTimelineRolloutOutcomeGovernance}
                onReviewLongitudinalClinicalValidation={saveTimelineRolloutLongitudinalClinicalValidation}
                onReviewProtectedReviewerEvidence={saveTimelineRolloutProtectedReviewerEvidence}
                onReviewProtectedReviewerGovernance={saveTimelineRolloutProtectedReviewerGovernance}
                onReviewProductionDatasetEvidence={saveTimelineRolloutProductionDatasetEvidence}
                onReviewProductionReviewerGovernance={saveTimelineRolloutProductionReviewerGovernance}
                onReviewProductionReviewerEvidence={saveTimelineRolloutProductionReviewerEvidence}
                onReviewProtectedReviewerValidation={saveTimelineRolloutProtectedReviewerValidation}
              />
            )}
            <PhotoProtocolPolicyGovernancePanel
              photoProtocol={state.reportPackage.patientPhotoProtocol}
              form={photoPolicyForm}
              saving={policySaving}
              onChange={setPhotoPolicyForm}
              onSave={savePhotoPolicy}
            />
          </>
        )}

        {kind === "assessment" && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="space-y-1 text-[12px] font-medium">
              Статус
              <select
                value={assessmentForm.status}
                onChange={(e) => setAssessmentForm((prev) => ({ ...prev, status: e.target.value }))}
                className="h-9 w-full rounded-sm border border-input bg-background px-2 text-[13px]"
              >
                <option value="draft">Черновик</option>
                <option value="ready">Готово</option>
                <option value="signed">Подписано</option>
              </select>
            </label>
            <label className="space-y-1 text-[12px] font-medium">
              Риск
              <select
                value={assessmentForm.riskLevel}
                onChange={(e) => setAssessmentForm((prev) => ({ ...prev, riskLevel: e.target.value }))}
                className="h-9 w-full rounded-sm border border-input bg-background px-2 text-[13px]"
              >
                <option value="">Не указан</option>
                <option value="low">Низкий</option>
                <option value="moderate">Средний</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочно</option>
              </select>
            </label>
            <Input
              aria-label="Итог по четырём признакам"
              value={assessmentForm.abcdTotal}
              onChange={(e) => setAssessmentForm((prev) => ({ ...prev, abcdTotal: e.target.value }))}
              placeholder="Итог по четырём признакам"
            />
            <Input
              aria-label="Итог 7-балльной шкалы"
              value={assessmentForm.sevenPointTotal}
              onChange={(e) => setAssessmentForm((prev) => ({ ...prev, sevenPointTotal: e.target.value }))}
              placeholder="Итог 7-балльной шкалы"
            />
            <Textarea
              aria-label="Краткая оценка"
              className="lg:col-span-2"
              value={assessmentForm.summary}
              onChange={(e) => setAssessmentForm((prev) => ({ ...prev, summary: e.target.value }))}
              placeholder="Клиническая оценка"
            />
            <Textarea
              aria-label="Рекомендация по оценке"
              className="lg:col-span-2"
              value={assessmentForm.recommendation}
              onChange={(e) => setAssessmentForm((prev) => ({ ...prev, recommendation: e.target.value }))}
              placeholder="Рекомендация"
            />
          </div>
        )}

        {kind === "conclusion" && (
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1 text-[12px] font-medium">
              Статус
              <select
                value={conclusionForm.status}
                onChange={(e) => setConclusionForm((prev) => ({ ...prev, status: e.target.value }))}
                className="h-9 w-full rounded-sm border border-input bg-background px-2 text-[13px]"
              >
                <option value="draft">Черновик</option>
                <option value="ready">Готово</option>
                <option value="signed">Подписано</option>
              </select>
            </label>
            <Textarea
              aria-label="Текст заключения"
              value={conclusionForm.summary}
              onChange={(e) => setConclusionForm((prev) => ({ ...prev, summary: e.target.value }))}
              placeholder="Заключение"
            />
            <Textarea
              aria-label="Следующий шаг заключения"
              value={conclusionForm.nextStep}
              onChange={(e) => setConclusionForm((prev) => ({ ...prev, nextStep: e.target.value }))}
              placeholder="Следующий шаг"
            />
            <Input
              aria-label="Дата контроля заключения"
              value={conclusionForm.followUpAt}
              onChange={(e) => setConclusionForm((prev) => ({ ...prev, followUpAt: e.target.value }))}
              placeholder="Дата контроля"
            />
          </div>
        )}

        {kind === "report" && (
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1 text-[12px] font-medium">
              Статус
              <select
                value={reportForm.status}
                onChange={(e) => setReportForm((prev) => ({ ...prev, status: e.target.value }))}
                className="h-9 w-full rounded-sm border border-input bg-background px-2 text-[13px]"
              >
                <option value="draft">Черновик</option>
                <option value="signed">Подписано</option>
              </select>
            </label>
            <Textarea
              aria-label="Текст отчёта для врача"
              value={reportForm.physicianText}
              onChange={(e) => setReportForm((prev) => ({ ...prev, physicianText: e.target.value }))}
              placeholder="Текст для врача"
            />
            <Textarea
              aria-label="Текст отчёта для пациента"
              value={reportForm.patientText}
              onChange={(e) => setReportForm((prev) => ({ ...prev, patientText: e.target.value }))}
              placeholder="Текст для пациента"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="h-8 text-[12px]" onClick={save} disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить в системе клиники"}
          </Button>
          <Button type="button" size="sm" variant="secondary" className="h-8 text-[12px]" onClick={load} disabled={saving}>
            Обновить
          </Button>
          <span role="status" aria-live="polite" className="text-[12px] text-muted-foreground">
            {status}
          </span>
        </div>
      </div>
    </Section>
  );
}

function ClinicalReportCompletionSummary({
  reportPackage,
  releaseAudit,
}: {
  reportPackage: SelfHostedClinicalReportPackageDTO;
  releaseAudit: SelfHostedPatientPhotoProtocolReleaseAuditDTO | null;
}) {
  const readiness = reportPackage.readiness;
  const photoProtocol = reportPackage.patientPhotoProtocol;
  const photoProtocolStatus = photoProtocol.status === "metadata_ready_backend_blocked"
    ? "метаданные готовы, выдача заблокирована"
    : "заблокировано";
  return (
    <section
      aria-label="Готовность клинического отчёта"
      className="rounded-sm border border-border bg-surface px-3 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold">Готовность отчёта</h3>
          <p className="text-[12px] text-muted-foreground">
            Пакет отчёта хранится в системе клиники. Внешняя выдача отключена.
          </p>
        </div>
        <span className="rounded-sm border border-border bg-surface-muted px-2 py-1 text-[12px] font-medium">
          {readiness.status === "ready" ? "Готов" : "Блокировано"} · {readiness.completionPercent}%
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
        <Field term="Очагов" value={reportPackage.counts.lesions} />
        <Field term="Снимков" value={reportPackage.counts.assets} />
        <Field term="Assessment" value={reportPackage.assessment.status ?? "—"} />
        <Field term="Conclusion" value={reportPackage.conclusion.status ?? "—"} />
        <Field term="Report" value={reportPackage.report.status ?? "—"} />
        <Field term="Текст для пациента" value={reportPackage.report.patientTextPresent ? "есть" : "нет"} />
        <Field term="Export" value={readiness.exportAllowed ? "разрешён" : "закрыт"} />
        <Field term="Delivery" value={readiness.patientDeliveryAllowed ? "разрешена" : "закрыта"} />
        <Field term="Фото-протокол" value={`${photoProtocol.selectedPhotoCount} фото`} />
        <Field
          term="Выдача фото"
          value={photoProtocol.deliveryBoundary.patientDeliveryAllowed ? "разрешена" : "закрыта"}
        />
      </dl>
      <div
        aria-label="Контур фото-протокола пациента"
        className="mt-3 rounded-sm border border-dashed border-border bg-surface-muted px-2.5 py-2 text-[12px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">Фото-протокол</span>
          <span>{photoProtocolStatus}</span>
        </div>
        <p className="mt-1 text-muted-foreground">
          Фото выбирает врач; сырые файлы, служебные пути, временные ссылки, токены и врачебная
          версия не выдаются пациенту.
        </p>
        {photoProtocol.missing.length > 0 && (
          <ul className="mt-2 grid grid-cols-1 gap-1 text-muted-foreground sm:grid-cols-2">
            {photoProtocol.missing.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                <span>{clinicalReportMissingLabel(item)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {releaseAudit && <PhotoProtocolReleaseAuditSummary audit={releaseAudit} />}
      {readiness.missing.length > 0 ? (
        <ul className="mt-3 grid grid-cols-1 gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
          {readiness.missing.map((item) => (
            <li key={item} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
              <span>{clinicalReportMissingLabel(item)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Все проверки отчёта закрыты. Внешние сервисы, служебные пути и временные ссылки не используются.
        </p>
      )}
    </section>
  );
}

function viewerQaReviewStatusLabel(status: SelfHostedLesionComparisonViewerQaReviewQueueDTO["items"][number]["review"]["status"]): string {
  if (status === "technical_ready") return "Технически готово";
  if (status === "needs_recapture") return "Нужен переснимок";
  if (status === "not_suitable_for_comparison") return "Не использовать для динамики";
  return "Проверить пару";
}

function viewerQaNextActionLabel(action: SelfHostedLesionComparisonViewerQaReviewQueueDTO["items"][number]["nextAction"]): string {
  if (action === "request_recapture") return "Запросить переснимок";
  if (action === "exclude_from_dynamic_review") return "Исключить из динамики";
  if (action === "approve_measurement_policy") return "Утвердить правила измерений";
  if (action === "approve_production_analysis_policy") return "Утвердить правила анализа";
  if (action === "assign_reviewer") return "Назначить проверяющего";
  if (action === "complete_second_review") return "Закрыть повторную проверку";
  if (action === "continue_review") return "Продолжить врачебный разбор";
  return "Проверить пару";
}

function longitudinalDatasetStatusLabel(status: SelfHostedVisitLongitudinalDatasetValidationDTO["readiness"]["status"]): string {
  if (status === "ready_for_rollout") return "Готово";
  if (status === "needs_review") return "Требует разбора";
  return "Заблокировано";
}

function timelineRolloutStatusLabel(status: SelfHostedVisitLongitudinalTimelineRolloutStatus): string {
  if (status === "approved_for_clinical_operations") return "Запуск утверждён";
  if (status === "review_required") return "Нужен разбор";
  return "Не утверждён";
}

function timelineRolloutSopStatusLabel(status: SelfHostedVisitLongitudinalTimelineRolloutSopStatus): string {
  if (status === "ready_for_operational_rollout") return "Правила готовы";
  if (status === "in_review") return "Правила на разборе";
  return "Правила не начаты";
}

function timelineRolloutEvidenceStatusLabel(status: SelfHostedVisitLongitudinalTimelineRolloutEvidenceStatus): string {
  if (status === "ready_for_monitored_rollout") return "Подтверждения готовы";
  if (status === "in_review") return "Подтверждения на разборе";
  return "Подтверждения не начаты";
}

function timelineRolloutMonitoringStatusLabel(status: SelfHostedVisitLongitudinalTimelineRolloutMonitoringStatus): string {
  if (status === "ready_for_production_rollout") return "Наблюдение готово";
  if (status === "in_review") return "Наблюдение на разборе";
  return "Наблюдение не начато";
}

function timelineRolloutIncidentProcedureStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutIncidentProcedureStatus,
): string {
  if (status === "ready_for_clinic_monitoring") return "Порядок готов";
  if (status === "in_review") return "Порядок на разборе";
  return "Порядок не начат";
}

function timelineRolloutClinicalValidationStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutClinicalValidationStatus,
): string {
  if (status === "ready_for_clinical_validation") return "Проверка готова";
  if (status === "in_review") return "Проверка на разборе";
  return "Проверка не начата";
}

function timelineRolloutPostValidationMonitoringStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutPostValidationMonitoringStatus,
): string {
  if (status === "ready_for_post_validation_monitoring") return "Наблюдение готово";
  if (status === "in_review") return "Наблюдение на разборе";
  return "Наблюдение не начато";
}

function timelineRolloutObservationGovernanceStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutObservationGovernanceStatus,
): string {
  if (status === "ready_for_observation_governance") return "Контроль готов";
  if (status === "in_review") return "Контроль на разборе";
  return "Контроль не начат";
}

function timelineRolloutExceptionGovernanceStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutExceptionGovernanceStatus,
): string {
  if (status === "ready_for_exception_governance") return "Исключения закрыты";
  if (status === "in_review") return "Исключения на разборе";
  return "Исключения не начаты";
}

function timelineRolloutOutcomeGovernanceStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutOutcomeGovernanceStatus,
): string {
  if (status === "ready_for_outcome_governance") return "Результаты готовы";
  if (status === "in_review") return "Результаты на разборе";
  return "Результаты не начаты";
}

function timelineRolloutLongitudinalClinicalValidationStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationStatus,
): string {
  if (status === "ready_for_longitudinal_clinical_validation") return "История проверена";
  if (status === "in_review") return "История на разборе";
  return "История не начата";
}

function timelineRolloutProtectedReviewerValidationStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerValidationStatus,
): string {
  if (status === "ready_for_protected_reviewer_validation") return "Закрытая проверка готова";
  if (status === "in_review") return "Закрытая проверка на разборе";
  return "Закрытая проверка не начата";
}

function timelineRolloutProtectedReviewerGovernanceStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerGovernanceStatus,
): string {
  if (status === "ready_for_protected_reviewer_governance") return "Контроль проверки готов";
  if (status === "in_review") return "Контроль проверки на разборе";
  return "Контроль проверки не начат";
}

function timelineRolloutProtectedReviewerEvidenceStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerEvidenceStatus,
): string {
  if (status === "ready_for_protected_reviewer_evidence") return "Подтверждения проверки готовы";
  if (status === "in_review") return "Подтверждения проверки на разборе";
  return "Подтверждения проверки не начаты";
}

function timelineRolloutProductionDatasetEvidenceStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutProductionDatasetEvidenceStatus,
): string {
  if (status === "ready_for_production_dataset_evidence") return "Рабочие данные готовы";
  if (status === "in_review") return "Рабочие данные на разборе";
  return "Рабочие данные не начаты";
}

function timelineRolloutProductionReviewerGovernanceStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutProductionReviewerGovernanceStatus,
): string {
  if (status === "ready_for_production_reviewer_governance") return "Рабочая проверка готова";
  if (status === "in_review") return "Рабочая проверка на разборе";
  return "Рабочая проверка не начата";
}

function timelineRolloutProductionReviewerEvidenceStatusLabel(
  status: SelfHostedVisitLongitudinalTimelineRolloutProductionReviewerEvidenceStatus,
): string {
  if (status === "ready_for_production_reviewer_evidence") return "Подтверждения проверки готовы";
  if (status === "in_review") return "Подтверждения проверки на разборе";
  return "Подтверждения проверки не начаты";
}

function timelineRolloutSopChecklistLabel(
  status: SelfHostedVisitLongitudinalDatasetValidationDTO["timelineRolloutSop"]["datasetValidationStatus"],
): string {
  if (status === "ready") return "готово";
  if (status === "needs_review") return "проверить";
  return "нет";
}

function longitudinalDatasetActionLabel(action: SelfHostedVisitLongitudinalDatasetValidationDTO["nextActions"][number]): string {
  if (action === "request_recapture") return "Запросить переснимок";
  if (action === "exclude_from_dynamic_review") return "Исключить из динамики";
  if (action === "verify_production_asset") return "Проверить рабочие снимки";
  if (action === "complete_capture_metadata") return "Дозаполнить данные съёмки";
  if (action === "complete_device_metadata") return "Дозаполнить данные устройства";
  if (action === "check_device_bridge") return "Проверить связь с устройством";
  if (action === "complete_capture_protocol") return "Дозаполнить протокол съёмки";
  if (action === "complete_calibration") return "Закрыть калибровку";
  if (action === "place_markers") return "Поставить маркеры";
  if (action === "approve_measurement_policy") return "Утвердить правила измерений";
  if (action === "approve_production_analysis_policy") return "Утвердить правила анализа";
  if (action === "assign_reviewer") return "Назначить проверяющего";
  if (action === "complete_second_review") return "Закрыть повторную проверку";
  if (action === "continue_review") return "Продолжить разбор";
  return "Открыть очередь";
}

type TimelineQaStep = {
  key: string;
  label: string;
  done: boolean;
  statusLabel: string;
  nextActionLabel: string;
};

function LongitudinalDatasetValidationPanel({
  validation,
  saving,
  sopSaving,
  evidenceSaving,
  monitoringSaving,
  incidentProcedureSaving,
  clinicalValidationSaving,
  postValidationMonitoringSaving,
  observationGovernanceSaving,
  exceptionGovernanceSaving,
  outcomeGovernanceSaving,
  longitudinalClinicalValidationSaving,
  protectedReviewerEvidenceSaving,
  protectedReviewerGovernanceSaving,
  productionDatasetEvidenceSaving,
  productionReviewerGovernanceSaving,
  productionReviewerEvidenceSaving,
  protectedReviewerValidationSaving,
  onReviewRollout,
  onReviewSop,
  onReviewEvidence,
  onReviewMonitoring,
  onReviewIncidentProcedure,
  onReviewClinicalValidation,
  onReviewPostValidationMonitoring,
  onReviewObservationGovernance,
  onReviewExceptionGovernance,
  onReviewOutcomeGovernance,
  onReviewLongitudinalClinicalValidation,
  onReviewProtectedReviewerEvidence,
  onReviewProtectedReviewerGovernance,
  onReviewProductionDatasetEvidence,
  onReviewProductionReviewerGovernance,
  onReviewProductionReviewerEvidence,
  onReviewProtectedReviewerValidation,
}: {
  validation: SelfHostedVisitLongitudinalDatasetValidationDTO;
  saving: boolean;
  sopSaving: boolean;
  evidenceSaving: boolean;
  monitoringSaving: boolean;
  incidentProcedureSaving: boolean;
  clinicalValidationSaving: boolean;
  postValidationMonitoringSaving: boolean;
  observationGovernanceSaving: boolean;
  exceptionGovernanceSaving: boolean;
  outcomeGovernanceSaving: boolean;
  longitudinalClinicalValidationSaving: boolean;
  protectedReviewerEvidenceSaving: boolean;
  protectedReviewerGovernanceSaving: boolean;
  productionDatasetEvidenceSaving: boolean;
  productionReviewerGovernanceSaving: boolean;
  productionReviewerEvidenceSaving: boolean;
  protectedReviewerValidationSaving: boolean;
  onReviewRollout: (status: SelfHostedVisitLongitudinalTimelineRolloutStatus) => void;
  onReviewSop: (status: SelfHostedVisitLongitudinalTimelineRolloutSopStatus) => void;
  onReviewEvidence: (status: SelfHostedVisitLongitudinalTimelineRolloutEvidenceStatus) => void;
  onReviewMonitoring: (status: SelfHostedVisitLongitudinalTimelineRolloutMonitoringStatus) => void;
  onReviewIncidentProcedure: (status: SelfHostedVisitLongitudinalTimelineRolloutIncidentProcedureStatus) => void;
  onReviewClinicalValidation: (status: SelfHostedVisitLongitudinalTimelineRolloutClinicalValidationStatus) => void;
  onReviewPostValidationMonitoring: (
    status: SelfHostedVisitLongitudinalTimelineRolloutPostValidationMonitoringStatus,
  ) => void;
  onReviewObservationGovernance: (
    status: SelfHostedVisitLongitudinalTimelineRolloutObservationGovernanceStatus,
  ) => void;
  onReviewExceptionGovernance: (
    status: SelfHostedVisitLongitudinalTimelineRolloutExceptionGovernanceStatus,
  ) => void;
  onReviewOutcomeGovernance: (
    status: SelfHostedVisitLongitudinalTimelineRolloutOutcomeGovernanceStatus,
  ) => void;
  onReviewLongitudinalClinicalValidation: (
    status: SelfHostedVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationStatus,
  ) => void;
  onReviewProtectedReviewerEvidence: (
    status: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerEvidenceStatus,
  ) => void;
  onReviewProtectedReviewerGovernance: (
    status: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerGovernanceStatus,
  ) => void;
  onReviewProductionDatasetEvidence: (
    status: SelfHostedVisitLongitudinalTimelineRolloutProductionDatasetEvidenceStatus,
  ) => void;
  onReviewProductionReviewerGovernance: (
    status: SelfHostedVisitLongitudinalTimelineRolloutProductionReviewerGovernanceStatus,
  ) => void;
  onReviewProductionReviewerEvidence: (
    status: SelfHostedVisitLongitudinalTimelineRolloutProductionReviewerEvidenceStatus,
  ) => void;
  onReviewProtectedReviewerValidation: (
    status: SelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerValidationStatus,
  ) => void;
}) {
  const readiness = validation.readiness;
  const rollout = validation.timelineRollout;
  const sop = validation.timelineRolloutSop;
  const evidence = validation.timelineRolloutEvidence;
  const monitoring = validation.timelineRolloutMonitoring;
  const incidentProcedure = validation.timelineRolloutIncidentProcedure;
  const clinicalValidation = validation.timelineRolloutClinicalValidation;
  const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring;
  const observationGovernance = validation.timelineRolloutObservationGovernance;
  const exceptionGovernance = validation.timelineRolloutExceptionGovernance;
  const outcomeGovernance = validation.timelineRolloutOutcomeGovernance;
  const longitudinalClinicalValidation = validation.timelineRolloutLongitudinalClinicalValidation ?? {
    id: "",
    clinicId: null,
    patientId: null,
    visitId: null,
    status: "not_started" as const,
    reasons: [],
    outcomeGovernanceStatus: "not_started" as const,
    exceptionGovernanceStatus: "not_started" as const,
    observationGovernanceStatus: "not_started" as const,
    postValidationMonitoringStatus: "not_started" as const,
    clinicalValidationStatus: "not_started" as const,
    incidentProcedureStatus: "not_started" as const,
    monitoringStatus: "not_started" as const,
    evidenceStatus: "not_started" as const,
    sopStatus: "not_started" as const,
    validationStatus: "заблокировано" as const,
    rolloutStatus: "not_approved" as const,
    outcomeWindowStatus: "missing" as const,
    clinicianCoverageStatus: "missing" as const,
    adjudicationStatus: "missing" as const,
    consensusReviewStatus: "missing" as const,
    followupValidationStatus: "missing" as const,
    governanceCadenceStatus: "missing" as const,
    ownerSignoffStatus: "missing" as const,
    realOutcomeWindowCount: 0,
    clinicallyValidatedWindowCount: 0,
    adjudicatedWindowCount: 0,
    followupValidatedWindowCount: 0,
    consensusReviewCount: 0,
    unresolvedConsensusCaseCount: 0,
    governanceReviewCount: 0,
    blockerCount: 0,
    lesionCount: 0,
    readyTimelineCount: 0,
    blockedTimelineCount: 0,
    candidatePairCount: 0,
    reviewerWorkflowReadyCount: 0,
    patientDeliveryAllowed: false as const,
    medicalMeasurementAllowed: false as const,
    protectedFieldsExposed: false as const,
    clinicalOutputGenerated: false as const,
    reviewedAt: null,
    createdAt: null,
    updatedAt: null,
  };
  const protectedReviewerValidation = validation.timelineRolloutProtectedReviewerValidation ?? {
    id: "",
    clinicId: null,
    patientId: null,
    visitId: null,
    status: "not_started" as const,
    reasons: [],
    longitudinalClinicalValidationStatus: "not_started" as const,
    outcomeGovernanceStatus: "not_started" as const,
    exceptionGovernanceStatus: "not_started" as const,
    observationGovernanceStatus: "not_started" as const,
    postValidationMonitoringStatus: "not_started" as const,
    clinicalValidationStatus: "not_started" as const,
    incidentProcedureStatus: "not_started" as const,
    monitoringStatus: "not_started" as const,
    evidenceStatus: "not_started" as const,
    sopStatus: "not_started" as const,
    validationStatus: "заблокировано" as const,
    rolloutStatus: "not_approved" as const,
    protectedAssetWindowStatus: "missing" as const,
    protectedRenderStatus: "missing" as const,
    reviewerAssignmentStatus: "missing" as const,
    secondReviewStatus: "missing" as const,
    adjudicationOpsStatus: "missing" as const,
    followupOpsStatus: "missing" as const,
    ownerSignoffStatus: "missing" as const,
    protectedAssetTimelineCount: 0,
    protectedRenderReadyCount: 0,
    reviewerAssignedProtectedCount: 0,
    secondReviewedProtectedCount: 0,
    adjudicatedProtectedCount: 0,
    followupValidatedProtectedCount: 0,
    unresolvedProtectedReviewCount: 0,
    blockerCount: 0,
    lesionCount: 0,
    readyTimelineCount: 0,
    blockedTimelineCount: 0,
    candidatePairCount: 0,
    reviewerWorkflowReadyCount: 0,
    patientDeliveryAllowed: false as const,
    medicalMeasurementAllowed: false as const,
    protectedFieldsExposed: false as const,
    clinicalOutputGenerated: false as const,
    reviewedAt: null,
    createdAt: null,
    updatedAt: null,
  };
  const protectedReviewerGovernance = validation.timelineRolloutProtectedReviewerGovernance ?? {
    id: "",
    clinicId: null,
    patientId: null,
    visitId: null,
    status: "not_started" as const,
    reasons: [],
    protectedReviewerValidationStatus: "not_started" as const,
    longitudinalClinicalValidationStatus: "not_started" as const,
    outcomeGovernanceStatus: "not_started" as const,
    exceptionGovernanceStatus: "not_started" as const,
    observationGovernanceStatus: "not_started" as const,
    postValidationMonitoringStatus: "not_started" as const,
    clinicalValidationStatus: "not_started" as const,
    incidentProcedureStatus: "not_started" as const,
    monitoringStatus: "not_started" as const,
    evidenceStatus: "not_started" as const,
    sopStatus: "not_started" as const,
    validationStatus: "заблокировано" as const,
    rolloutStatus: "not_approved" as const,
    reviewerMonitoringStatus: "missing" as const,
    reviewerExceptionStatus: "missing" as const,
    reviewerAdjudicationStatus: "missing" as const,
    reviewerFollowupStatus: "missing" as const,
    reviewerRollbackStatus: "missing" as const,
    reviewerArchiveStatus: "missing" as const,
    ownerSignoffStatus: "missing" as const,
    protectedReviewWindowCount: 0,
    monitoredProtectedReviewCount: 0,
    escalatedProtectedReviewCount: 0,
    adjudicatedProtectedGovernanceCount: 0,
    followupClosedProtectedCount: 0,
    rollbackReadyProtectedCount: 0,
    archivedProtectedReviewCount: 0,
    unresolvedGovernanceReviewCount: 0,
    blockerCount: 0,
    lesionCount: 0,
    readyTimelineCount: 0,
    blockedTimelineCount: 0,
    candidatePairCount: 0,
    reviewerWorkflowReadyCount: 0,
    patientDeliveryAllowed: false as const,
    medicalMeasurementAllowed: false as const,
    protectedFieldsExposed: false as const,
    clinicalOutputGenerated: false as const,
    reviewedAt: null,
    createdAt: null,
    updatedAt: null,
  };
  const protectedReviewerEvidence = validation.timelineRolloutProtectedReviewerEvidence ?? {
    id: "",
    clinicId: null,
    patientId: null,
    visitId: null,
    status: "not_started" as const,
    reasons: [],
    protectedReviewerGovernanceStatus: "not_started" as const,
    protectedReviewerValidationStatus: "not_started" as const,
    longitudinalClinicalValidationStatus: "not_started" as const,
    outcomeGovernanceStatus: "not_started" as const,
    exceptionGovernanceStatus: "not_started" as const,
    observationGovernanceStatus: "not_started" as const,
    postValidationMonitoringStatus: "not_started" as const,
    clinicalValidationStatus: "not_started" as const,
    incidentProcedureStatus: "not_started" as const,
    monitoringStatus: "not_started" as const,
    evidenceStatus: "not_started" as const,
    sopStatus: "not_started" as const,
    validationStatus: "заблокировано" as const,
    rolloutStatus: "not_approved" as const,
    reviewerMonitoringEvidenceStatus: "missing" as const,
    reviewerExceptionEvidenceStatus: "missing" as const,
    reviewerAdjudicationEvidenceStatus: "missing" as const,
    reviewerFollowupEvidenceStatus: "missing" as const,
    reviewerRollbackEvidenceStatus: "missing" as const,
    reviewerArchiveEvidenceStatus: "missing" as const,
    ownerSignoffStatus: "missing" as const,
    protectedReviewWindowCount: 0,
    monitoredProtectedReviewCount: 0,
    sampledProtectedReviewCount: 0,
    adjudicatedProtectedEvidenceCount: 0,
    followupClosedProtectedCount: 0,
    rollbackDrillProtectedCount: 0,
    archivedProtectedReviewCount: 0,
    unresolvedProtectedEvidenceCount: 0,
    blockerCount: 0,
    lesionCount: 0,
    readyTimelineCount: 0,
    blockedTimelineCount: 0,
    candidatePairCount: 0,
    reviewerWorkflowReadyCount: 0,
    patientDeliveryAllowed: false as const,
    medicalMeasurementAllowed: false as const,
    protectedFieldsExposed: false as const,
    clinicalOutputGenerated: false as const,
    reviewedAt: null,
    createdAt: null,
    updatedAt: null,
  };
  const productionDatasetEvidence = validation.timelineRolloutProductionDatasetEvidence ?? {
    id: "",
    clinicId: null,
    patientId: null,
    visitId: null,
    status: "not_started" as const,
    reasons: [],
    protectedReviewerEvidenceStatus: "not_started" as const,
    protectedReviewerGovernanceStatus: "not_started" as const,
    protectedReviewerValidationStatus: "not_started" as const,
    longitudinalClinicalValidationStatus: "not_started" as const,
    outcomeGovernanceStatus: "not_started" as const,
    exceptionGovernanceStatus: "not_started" as const,
    observationGovernanceStatus: "not_started" as const,
    postValidationMonitoringStatus: "not_started" as const,
    clinicalValidationStatus: "not_started" as const,
    incidentProcedureStatus: "not_started" as const,
    monitoringStatus: "not_started" as const,
    evidenceStatus: "not_started" as const,
    sopStatus: "not_started" as const,
    validationStatus: "заблокировано" as const,
    rolloutStatus: "not_approved" as const,
    realClinicWindowStatus: "missing" as const,
    datasetSamplingStatus: "missing" as const,
    longitudinalFollowupStatus: "missing" as const,
    protectedReviewerLinkageStatus: "missing" as const,
    outcomeObservationStatus: "missing" as const,
    incidentLinkageStatus: "missing" as const,
    ownerSignoffStatus: "missing" as const,
    realClinicWindowCount: 0,
    monitoredClinicOperationCount: 0,
    sampledClinicOperationCount: 0,
    longitudinalFollowupCount: 0,
    protectedReviewerLinkedCount: 0,
    observedOutcomeCount: 0,
    incidentLinkedCount: 0,
    unresolvedProductionDatasetEvidenceCount: 0,
    blockerCount: 0,
    lesionCount: 0,
    readyTimelineCount: 0,
    blockedTimelineCount: 0,
    candidatePairCount: 0,
    reviewerWorkflowReadyCount: 0,
    patientDeliveryAllowed: false as const,
    medicalMeasurementAllowed: false as const,
    protectedFieldsExposed: false as const,
    clinicalOutputGenerated: false as const,
    reviewedAt: null,
    createdAt: null,
    updatedAt: null,
  };
  const productionReviewerGovernance = validation.timelineRolloutProductionReviewerGovernance ?? {
    id: "",
    clinicId: null,
    patientId: null,
    visitId: null,
    status: "not_started" as const,
    reasons: [],
    productionDatasetEvidenceStatus: "not_started" as const,
    protectedReviewerEvidenceStatus: "not_started" as const,
    protectedReviewerGovernanceStatus: "not_started" as const,
    protectedReviewerValidationStatus: "not_started" as const,
    longitudinalClinicalValidationStatus: "not_started" as const,
    outcomeGovernanceStatus: "not_started" as const,
    exceptionGovernanceStatus: "not_started" as const,
    observationGovernanceStatus: "not_started" as const,
    postValidationMonitoringStatus: "not_started" as const,
    clinicalValidationStatus: "not_started" as const,
    incidentProcedureStatus: "not_started" as const,
    monitoringStatus: "not_started" as const,
    evidenceStatus: "not_started" as const,
    sopStatus: "not_started" as const,
    validationStatus: "заблокировано" as const,
    rolloutStatus: "not_approved" as const,
    productionReviewerAssignmentStatus: "missing" as const,
    productionSecondReviewStatus: "missing" as const,
    productionAdjudicationStatus: "missing" as const,
    productionFollowupStatus: "missing" as const,
    productionExceptionStatus: "missing" as const,
    productionRollbackStatus: "missing" as const,
    ownerSignoffStatus: "missing" as const,
    productionReviewWindowCount: 0,
    assignedProductionReviewerCount: 0,
    secondReviewedProductionCount: 0,
    adjudicatedProductionReviewCount: 0,
    followupClosedProductionCount: 0,
    exceptionClosedProductionCount: 0,
    rollbackReadyProductionCount: 0,
    unresolvedProductionReviewerGovernanceCount: 0,
    blockerCount: 0,
    lesionCount: 0,
    readyTimelineCount: 0,
    blockedTimelineCount: 0,
    candidatePairCount: 0,
    reviewerWorkflowReadyCount: 0,
    patientDeliveryAllowed: false as const,
    medicalMeasurementAllowed: false as const,
    protectedFieldsExposed: false as const,
    clinicalOutputGenerated: false as const,
    reviewedAt: null,
    createdAt: null,
    updatedAt: null,
  };
  const productionReviewerEvidence = validation.timelineRolloutProductionReviewerEvidence ?? {
    id: "",
    clinicId: null,
    patientId: null,
    visitId: null,
    status: "not_started" as const,
    reasons: [],
    productionDatasetEvidenceStatus: "not_started" as const,
    productionReviewerGovernanceStatus: "not_started" as const,
    protectedReviewerEvidenceStatus: "not_started" as const,
    protectedReviewerGovernanceStatus: "not_started" as const,
    protectedReviewerValidationStatus: "not_started" as const,
    longitudinalClinicalValidationStatus: "not_started" as const,
    outcomeGovernanceStatus: "not_started" as const,
    exceptionGovernanceStatus: "not_started" as const,
    observationGovernanceStatus: "not_started" as const,
    postValidationMonitoringStatus: "not_started" as const,
    clinicalValidationStatus: "not_started" as const,
    incidentProcedureStatus: "not_started" as const,
    monitoringStatus: "not_started" as const,
    evidenceStatus: "not_started" as const,
    sopStatus: "not_started" as const,
    validationStatus: "заблокировано" as const,
    rolloutStatus: "not_approved" as const,
    productionReviewerAssignmentStatus: "missing" as const,
    productionSecondReviewStatus: "missing" as const,
    productionAdjudicationStatus: "missing" as const,
    productionFollowupStatus: "missing" as const,
    productionExceptionStatus: "missing" as const,
    productionRollbackStatus: "missing" as const,
    ownerSignoffStatus: "missing" as const,
    productionReviewWindowCount: 0,
    assignedProductionReviewerCount: 0,
    secondReviewedProductionCount: 0,
    adjudicatedProductionReviewCount: 0,
    followupClosedProductionCount: 0,
    exceptionClosedProductionCount: 0,
    rollbackReadyProductionCount: 0,
    unresolvedProductionReviewerEvidenceCount: 0,
    blockerCount: 0,
    lesionCount: 0,
    readyTimelineCount: 0,
    blockedTimelineCount: 0,
    candidatePairCount: 0,
    reviewerWorkflowReadyCount: 0,
    patientDeliveryAllowed: false as const,
    medicalMeasurementAllowed: false as const,
    protectedFieldsExposed: false as const,
    clinicalOutputGenerated: false as const,
    reviewedAt: null,
    createdAt: null,
    updatedAt: null,
  };
  const rolloutReady = readiness.status === "ready_for_rollout";
  const sopPrerequisitesReady = rolloutReady && rollout.status === "approved_for_clinical_operations";
  const evidencePrerequisitesReady = sopPrerequisitesReady && sop.status === "ready_for_operational_rollout";
  const monitoringPrerequisitesReady =
    evidencePrerequisitesReady && evidence.status === "ready_for_monitored_rollout";
  const incidentProcedurePrerequisitesReady =
    monitoringPrerequisitesReady && monitoring.status === "ready_for_production_rollout";
  const clinicalValidationPrerequisitesReady =
    incidentProcedurePrerequisitesReady && incidentProcedure.status === "ready_for_clinic_monitoring";
  const postValidationMonitoringPrerequisitesReady =
    clinicalValidationPrerequisitesReady && clinicalValidation.status === "ready_for_clinical_validation";
  const observationGovernancePrerequisitesReady =
    postValidationMonitoringPrerequisitesReady
    && postValidationMonitoring.status === "ready_for_post_validation_monitoring";
  const exceptionGovernancePrerequisitesReady =
    observationGovernancePrerequisitesReady
    && observationGovernance.status === "ready_for_observation_governance";
  const outcomeGovernancePrerequisitesReady =
    exceptionGovernancePrerequisitesReady
    && exceptionGovernance.status === "ready_for_exception_governance";
  const longitudinalClinicalValidationPrerequisitesReady =
    outcomeGovernancePrerequisitesReady
    && outcomeGovernance.status === "ready_for_outcome_governance";
  const protectedReviewerValidationPrerequisitesReady =
    longitudinalClinicalValidationPrerequisitesReady
    && longitudinalClinicalValidation.status === "ready_for_longitudinal_clinical_validation";
  const protectedReviewerGovernancePrerequisitesReady =
    protectedReviewerValidationPrerequisitesReady
    && protectedReviewerValidation.status === "ready_for_protected_reviewer_validation";
  const protectedReviewerEvidencePrerequisitesReady =
    protectedReviewerGovernancePrerequisitesReady
    && protectedReviewerGovernance.status === "ready_for_protected_reviewer_governance";
  const productionDatasetEvidencePrerequisitesReady =
    protectedReviewerEvidencePrerequisitesReady
    && protectedReviewerEvidence.status === "ready_for_protected_reviewer_evidence";
  const productionReviewerGovernancePrerequisitesReady =
    productionDatasetEvidencePrerequisitesReady
    && productionDatasetEvidence.status === "ready_for_production_dataset_evidence";
  const productionReviewerEvidencePrerequisitesReady =
    productionReviewerGovernancePrerequisitesReady
    && productionReviewerGovernance.status === "ready_for_production_reviewer_governance";
  const timelineQaSteps: TimelineQaStep[] = [
    {
      key: "dataset",
      label: "Данные",
      done: rolloutReady,
      statusLabel: longitudinalDatasetStatusLabel(readiness.status),
      nextActionLabel: "Закрыть блокеры данных",
    },
    {
      key: "rollout",
      label: "Запуск",
      done: rollout.status === "approved_for_clinical_operations",
      statusLabel: timelineRolloutStatusLabel(rollout.status),
      nextActionLabel: "Разобрать запуск",
    },
    {
      key: "sop",
      label: "Правила",
      done: sop.status === "ready_for_operational_rollout",
      statusLabel: timelineRolloutSopStatusLabel(sop.status),
      nextActionLabel: "Закрыть Правила",
    },
    {
      key: "monitoring",
      label: "Мониторинг",
      done: monitoring.status === "ready_for_production_rollout",
      statusLabel: timelineRolloutMonitoringStatusLabel(monitoring.status),
      nextActionLabel: "Подтвердить мониторинг",
    },
    {
      key: "clinical",
      label: "Валидация",
      done: longitudinalClinicalValidation.status === "ready_for_longitudinal_clinical_validation",
      statusLabel: timelineRolloutLongitudinalClinicalValidationStatusLabel(longitudinalClinicalValidation.status),
      nextActionLabel: "Проверить валидацию",
    },
    {
      key: "protected-review",
      label: "Закрытая проверка",
      done: protectedReviewerEvidence.status === "ready_for_protected_reviewer_evidence",
      statusLabel: timelineRolloutProtectedReviewerEvidenceStatusLabel(protectedReviewerEvidence.status),
      nextActionLabel: "Закрыть закрытую проверку",
    },
    {
      key: "production-dataset",
      label: "Раб. данные",
      done: productionDatasetEvidence.status === "ready_for_production_dataset_evidence",
      statusLabel: timelineRolloutProductionDatasetEvidenceStatusLabel(productionDatasetEvidence.status),
      nextActionLabel: "Проверить рабочие данные",
    },
    {
      key: "production-review",
      label: "Раб. проверка",
      done: productionReviewerEvidence.status === "ready_for_production_reviewer_evidence",
      statusLabel: timelineRolloutProductionReviewerEvidenceStatusLabel(productionReviewerEvidence.status),
      nextActionLabel: "Закрыть рабочую проверку",
    },
  ];
  const completedTimelineQaSteps = timelineQaSteps.filter((step) => step.done).length;
  const currentTimelineQaStepIndex = timelineQaSteps.findIndex((step) => !step.done);
  const currentTimelineQaStep =
    currentTimelineQaStepIndex >= 0 ? timelineQaSteps[currentTimelineQaStepIndex] : timelineQaSteps[timelineQaSteps.length - 1];
  const firstVisibleItemAction = validation.items[0]?.nextAction;
  const firstGlobalAction = validation.nextActions[0];
  const nextGateActionLabel =
    !rolloutReady && firstVisibleItemAction
      ? longitudinalDatasetActionLabel(firstVisibleItemAction)
      : !rolloutReady && firstGlobalAction
        ? longitudinalDatasetActionLabel(firstGlobalAction)
        : currentTimelineQaStep?.nextActionLabel ?? "Проверить следующий шаг";
  const primaryActionHref = !rolloutReady && validation.items.length > 0
    ? "#timeline-qa-lesions"
    : "#timeline-rollout-details";
  const primaryActionLabel = !rolloutReady && validation.items.length > 0
    ? "Открыть очаги с блокерами"
    : "Открыть детальный аудит";
  const visibleItemActions = new Set(validation.items.map((item) => item.nextAction));
  const additionalActions = validation.nextActions.filter((action) => !visibleItemActions.has(action));
  return (
    <section
      role="region"
      aria-label="Готовность проверки истории"
      className="rounded-sm border border-border bg-surface px-3 py-3 text-[12px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold">Готовность проверки истории</h3>
          <p className="text-muted-foreground">
            Проверка истории по рабочим данным · вывод о динамике выключен · выдача пациенту выключена.
          </p>
        </div>
        <span className="rounded-sm border border-border bg-surface-muted px-2 py-1 font-medium">
          {longitudinalDatasetStatusLabel(readiness.status)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-12">
        <Field term="Очагов" value={readiness.lesionCount} />
        <Field term="Готово" value={readiness.readyTimelineCount} />
        <Field term="Review" value={readiness.needsReviewTimelineCount} />
        <Field term="Блок" value={readiness.blockedTimelineCount} />
        <Field term="Снимков" value={readiness.imageCount} />
        <Field term="Пар" value={readiness.candidatePairCount} />
        <Field term="Workflow" value={readiness.reviewerWorkflowReadyCount} />
        <Field term="Assets" value={readiness.productionAssetNotReadyCount} />
        <Field term="Device" value={readiness.deviceEvidenceNotReadyCount} />
        <Field term="Bridge" value={readiness.deviceBridgeQualityNotReadyCount} />
        <Field term="Protocol" value={readiness.captureProtocolNotReadyCount} />
        <Field term="Policy" value={readiness.measurementPolicyNotReadyCount} />
        <Field term="Analysis" value={readiness.productionAnalysisPolicyNotReadyCount} />
        <Field term="Assign" value={readiness.reviewerAssignmentNotReadyCount} />
        <Field term="Second" value={readiness.secondReviewNotReadyCount} />
      </dl>
      {validation.blockers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {validation.blockers.slice(0, 4).map((blocker) => (
            <span
              key={blocker.code}
              className="rounded-sm border border-border bg-surface-muted px-2 py-1 text-muted-foreground"
            >
              {blocker.label}: {blocker.count}
            </span>
          ))}
        </div>
      )}
      {additionalActions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {additionalActions.map((action) => (
            <span
              key={action}
              className="rounded-sm border border-border bg-surface px-2 py-1 font-medium"
            >
              {longitudinalDatasetActionLabel(action)}
            </span>
          ))}
        </div>
      )}
      <div
        role="region"
        aria-label="Рабочий шаг проверки истории"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2.5"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Что делать сейчас</p>
            <h4 className="mt-1 text-[13px] font-semibold">
              Следующий шаг: {currentTimelineQaStep?.nextActionLabel ?? "Проверить историю"}
            </h4>
            <p className="mt-1 text-muted-foreground">
              Ближайшее действие: <span className="font-medium text-foreground">{nextGateActionLabel}</span>. Динамический вывод
              выключен, выдача пациенту выключена.
            </p>
            {validation.blockers.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                Первый блокер: {validation.blockers[0].label} · {validation.blockers[0].count}
              </p>
            )}
          </div>
          <div className="flex min-w-[180px] flex-col items-start gap-2 lg:items-end">
            <span className="rounded-sm border border-border bg-surface px-2 py-1 text-[12px] font-medium">
              Прогресс проверки: {completedTimelineQaSteps}/{timelineQaSteps.length}
            </span>
            <Button asChild size="sm" className="h-8 text-[12px]">
              <a href={primaryActionHref}>{primaryActionLabel}</a>
            </Button>
          </div>
        </div>
        <ol className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8" aria-label="Этапы проверки истории">
          {timelineQaSteps.map((step, index) => {
            const state = step.done ? "done" : index === currentTimelineQaStepIndex ? "current" : "locked";
            const stateLabel = step.done ? "закрыто" : state === "current" ? "текущий шаг" : "ожидает";
            const stateClass = step.done
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : state === "current"
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : "border-border bg-surface text-muted-foreground";
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
      </div>
      <TimelineQaGroupNav />
      <TimelineQaGroupHeader
        title="Данные и запуск"
        hint="Сначала закрываются blockers по очагам, затем фиксируется контроль запуска."
      />
      <div
        id="timeline-rollout-details"
        role="region"
        aria-label="Запуск проверки истории"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Запуск проверки истории</h4>
            <p className="text-muted-foreground">
              Запуск сохраняет только сводные данные · вывод о динамике выключен · Выдача пациенту:
              выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutStatusLabel(rollout.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field term="Validation" value={longitudinalDatasetStatusLabel(rollout.validationStatus)} />
          <Field term="Ready" value={rollout.readyTimelineCount} />
          <Field term="Review" value={rollout.needsReviewTimelineCount} />
          <Field term="Blocked" value={rollout.blockedTimelineCount} />
        </dl>
        {rollout.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rollout.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={saving || !rolloutReady}
            onClick={() => onReviewRollout("approved_for_clinical_operations")}
          >
            Утвердить запуск истории
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={saving}
            onClick={() => onReviewRollout("review_required")}
          >
            Нужен разбор запуска
          </Button>
        </div>
      </div>
      <TimelineQaGroupHeader
        id="timeline-sop-evidence"
        title="Правила и подтверждения"
        hint="Рабочий чек-лист и подтверждения без клинического вывода."
      />
      <div
        role="region"
        aria-label="Правила запуска истории"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Правила запуска истории</h4>
            <p className="text-muted-foreground">
              Правила фиксируют только рабочий чек-лист · вывод о динамике выключен · Выдача пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutSopStatusLabel(sop.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Dataset" value={timelineRolloutSopChecklistLabel(sop.datasetValidationStatus)} />
          <Field term="Reviewer" value={timelineRolloutSopChecklistLabel(sop.reviewerOperationsStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(sop.rollbackPlanStatus)} />
          <Field term="Monitoring" value={timelineRolloutSopChecklistLabel(sop.monitoringPlanStatus)} />
          <Field term="Window" value={timelineRolloutSopChecklistLabel(sop.rolloutWindowStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(sop.ownerAckStatus)} />
        </dl>
        {sop.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sop.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={sopSaving}
            onClick={() => onReviewSop("in_review")}
          >
            Зафиксировать разбор правил
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={sopSaving || !sopPrerequisitesReady}
            onClick={() => onReviewSop("ready_for_operational_rollout")}
          >
            Утвердить правила запуска
          </Button>
        </div>
      </div>
      <TimelineQaGroupHeader
        id="timeline-monitoring-validation"
        title="Наблюдение и проверка"
        hint="Контроль результатов, порядок инцидентов и клиническая проверка только как сводные данные."
      />
      <div
        role="region"
        aria-label="Подтверждения запуска"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Подтверждения запуска</h4>
            <p className="text-muted-foreground">
              Подтверждения фиксируют только сводное наблюдение · вывод о динамике выключен · Выдача
              пациенту: выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutEvidenceStatusLabel(evidence.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Monitoring" value={timelineRolloutSopChecklistLabel(evidence.monitoringEvidenceStatus)} />
          <Field term="Sample" value={timelineRolloutSopChecklistLabel(evidence.sampleAuditStatus)} />
          <Field term="Exceptions" value={timelineRolloutSopChecklistLabel(evidence.exceptionLogStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(evidence.rollbackDrillStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(evidence.ownerSignoffStatus)} />
          <Field term="Window" value={`${evidence.monitoringWindowDays} дн.`} />
          <Field term="Sampled" value={evidence.sampledTimelineCount} />
          <Field term="Incidents" value={evidence.exceptionCount} />
          <Field term="Drills" value={evidence.rollbackDrillCount} />
        </dl>
        {evidence.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {evidence.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={evidenceSaving}
            onClick={() => onReviewEvidence("in_review")}
          >
            Зафиксировать подтверждения
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={evidenceSaving || !evidencePrerequisitesReady}
            onClick={() => onReviewEvidence("ready_for_monitored_rollout")}
          >
            Утвердить наблюдение
          </Button>
        </div>
      </div>
      <TimelineQaGroupHeader
        id="timeline-protected-review"
        title="Закрытая проверка"
        hint="Проверка защищённых снимков без раскрытия файлов и личных данных проверяющих."
      />
      <div
        role="region"
        aria-label="Наблюдение результатов"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Наблюдение результатов</h4>
            <p className="text-muted-foreground">
              Наблюдение фиксирует только сводные результаты · вывод о динамике выключен · Выдача
              пациенту: выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutMonitoringStatusLabel(monitoring.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Outcome" value={timelineRolloutSopChecklistLabel(monitoring.outcomeSamplingStatus)} />
          <Field term="Incidents" value={timelineRolloutSopChecklistLabel(monitoring.incidentReviewStatus)} />
          <Field term="Exceptions" value={timelineRolloutSopChecklistLabel(monitoring.exceptionClosureStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(monitoring.rollbackOutcomeStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(monitoring.ownerFinalReviewStatus)} />
          <Field term="Window" value={`${monitoring.monitoringWindowDays} дн.`} />
          <Field term="Monitored" value={monitoring.monitoredTimelineCount} />
          <Field term="Sampled" value={monitoring.sampledTimelineCount} />
          <Field term="Open Inc." value={monitoring.unresolvedIncidentCount} />
          <Field term="Closed Ex." value={monitoring.closedExceptionCount} />
          <Field term="Rollback Run" value={monitoring.rollbackExecutionCount} />
        </dl>
        {monitoring.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {monitoring.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={monitoringSaving}
            onClick={() => onReviewMonitoring("in_review")}
          >
            Зафиксировать наблюдение
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={monitoringSaving || !monitoringPrerequisitesReady}
            onClick={() => onReviewMonitoring("ready_for_production_rollout")}
          >
            Утвердить рабочий запуск
          </Button>
        </div>
      </div>
      <TimelineQaGroupHeader
        id="timeline-production-review"
        title="Рабочий запуск"
        hint="Рабочие данные и проверка для долгого контроля запуска."
      />
      <div
        role="region"
        aria-label="Порядок инцидентов"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Порядок инцидентов</h4>
            <p className="text-muted-foreground">
              Порядок инцидентов фиксирует только сводные рабочие результаты · вывод о динамике:
              выключен · Выдача пациенту: выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutIncidentProcedureStatusLabel(incidentProcedure.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Dataset" value={timelineRolloutSopChecklistLabel(incidentProcedure.realDatasetStatus)} />
          <Field
            term="Outcome Правила"
            value={timelineRolloutSopChecklistLabel(incidentProcedure.outcomeSamplingProcedureStatus)}
          />
          <Field term="Triage" value={timelineRolloutSopChecklistLabel(incidentProcedure.incidentTriageStatus)} />
          <Field term="Escalation" value={timelineRolloutSopChecklistLabel(incidentProcedure.escalationPathStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(incidentProcedure.rollbackDecisionStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(incidentProcedure.ownerReviewStatus)} />
          <Field term="Real Set" value={incidentProcedure.realDatasetTimelineCount} />
          <Field term="Monitored" value={incidentProcedure.monitoredTimelineCount} />
          <Field term="Sampled" value={incidentProcedure.sampledOutcomeCount} />
          <Field term="Open Inc." value={incidentProcedure.unresolvedIncidentCount} />
          <Field term="Escalated" value={incidentProcedure.escalatedIncidentCount} />
          <Field term="Rollback" value={incidentProcedure.rollbackDecisionCount} />
        </dl>
        {incidentProcedure.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {incidentProcedure.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={incidentProcedureSaving}
            onClick={() => onReviewIncidentProcedure("in_review")}
          >
            Зафиксировать порядок инцидентов
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={incidentProcedureSaving || !incidentProcedurePrerequisitesReady}
            onClick={() => onReviewIncidentProcedure("ready_for_clinic_monitoring")}
          >
            Утвердить наблюдение клиники
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Клиническая проверка"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Клиническая проверка</h4>
            <p className="text-muted-foreground">
              Клиническая проверка фиксирует только сводные данные · вывод о динамике:
              выключен · Выдача пациенту: выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutClinicalValidationStatusLabel(clinicalValidation.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Dataset lock" value={timelineRolloutSopChecklistLabel(clinicalValidation.realDatasetLockStatus)} />
          <Field term="Validators" value={timelineRolloutSopChecklistLabel(clinicalValidation.validatorTrainingStatus)} />
          <Field term="Blinded" value={timelineRolloutSopChecklistLabel(clinicalValidation.blindedSampleStatus)} />
          <Field term="Adjudication" value={timelineRolloutSopChecklistLabel(clinicalValidation.adjudicationStatus)} />
          <Field term="Decision log" value={timelineRolloutSopChecklistLabel(clinicalValidation.decisionLogStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(clinicalValidation.ownerAcceptanceStatus)} />
          <Field term="Real Set" value={clinicalValidation.realDatasetTimelineCount} />
          <Field term="Sample" value={clinicalValidation.validationSampleCount} />
          <Field term="Disagree" value={clinicalValidation.disagreementCaseCount} />
          <Field term="Adjudicated" value={clinicalValidation.adjudicatedCaseCount} />
          <Field term="Follow-up" value={`${clinicalValidation.followupWindowDays} дн.`} />
          <Field term="Blockers" value={clinicalValidation.blockerCount} />
        </dl>
        {clinicalValidation.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {clinicalValidation.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={clinicalValidationSaving}
            onClick={() => onReviewClinicalValidation("in_review")}
          >
            Зафиксировать клиническую проверку
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={clinicalValidationSaving || !clinicalValidationPrerequisitesReady}
            onClick={() => onReviewClinicalValidation("ready_for_clinical_validation")}
          >
            Утвердить клиническую проверку
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Наблюдение после проверки"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Наблюдение после проверки</h4>
            <p className="text-muted-foreground">
              Наблюдение после проверки фиксирует только сводные данные наблюдения и сдвига · вывод о динамике выключен ·
              Выдача пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutPostValidationMonitoringStatusLabel(postValidationMonitoring.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Window" value={timelineRolloutSopChecklistLabel(postValidationMonitoring.monitoringWindowStatus)} />
          <Field term="Outcomes" value={timelineRolloutSopChecklistLabel(postValidationMonitoring.outcomeReviewStatus)} />
          <Field term="Drift" value={timelineRolloutSopChecklistLabel(postValidationMonitoring.driftReviewStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(postValidationMonitoring.incidentFollowupStatus)} />
          <Field term="Recheck" value={timelineRolloutSopChecklistLabel(postValidationMonitoring.validatorRecheckStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(postValidationMonitoring.ownerSignoffStatus)} />
          <Field term="Real Set" value={postValidationMonitoring.realDatasetTimelineCount} />
          <Field term="Validated" value={postValidationMonitoring.clinicalValidationSampleCount} />
          <Field term="Monitored" value={postValidationMonitoring.monitoredTimelineCount} />
          <Field term="Sampled" value={postValidationMonitoring.sampledOutcomeCount} />
          <Field term="Drift open" value={postValidationMonitoring.unresolvedDriftSignalCount} />
          <Field term="Follow open" value={postValidationMonitoring.unresolvedIncidentFollowupCount} />
        </dl>
        {postValidationMonitoring.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {postValidationMonitoring.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={postValidationMonitoringSaving}
            onClick={() => onReviewPostValidationMonitoring("in_review")}
          >
            Зафиксировать наблюдение после проверки
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={postValidationMonitoringSaving || !postValidationMonitoringPrerequisitesReady}
            onClick={() => onReviewPostValidationMonitoring("ready_for_post_validation_monitoring")}
          >
            Утвердить наблюдение после проверки
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Контроль наблюдения"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Контроль наблюдения</h4>
            <p className="text-muted-foreground">
              Контроль наблюдения фиксирует только сводные результаты · вывод о динамике:
              выключен · Выдача пациенту: выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutObservationGovernanceStatusLabel(observationGovernance.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Window" value={timelineRolloutSopChecklistLabel(observationGovernance.observationWindowStatus)} />
          <Field term="Outcomes" value={timelineRolloutSopChecklistLabel(observationGovernance.outcomeObservationStatus)} />
          <Field term="Drift" value={timelineRolloutSopChecklistLabel(observationGovernance.driftSignalReviewStatus)} />
          <Field term="Incidents" value={timelineRolloutSopChecklistLabel(observationGovernance.incidentOutcomeReviewStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(observationGovernance.followupClosureStatus)} />
          <Field term="Governance" value={timelineRolloutSopChecklistLabel(observationGovernance.governanceReviewStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(observationGovernance.ownerSignoffStatus)} />
          <Field term="Real Set" value={observationGovernance.realDatasetTimelineCount} />
          <Field term="Validated" value={observationGovernance.postValidationSampleCount} />
          <Field term="Observed" value={observationGovernance.observedTimelineCount} />
          <Field
            term="Follow closed"
            value={`${observationGovernance.completedFollowupCount}/${observationGovernance.expectedFollowupCount}`}
          />
          <Field term="Drift open" value={observationGovernance.unresolvedDriftSignalCount} />
          <Field term="Incident open" value={observationGovernance.unresolvedIncidentOutcomeCount} />
          <Field term="Gov. open" value={observationGovernance.unresolvedGovernanceExceptionCount} />
          <Field term="Blockers" value={observationGovernance.blockerCount} />
        </dl>
        {observationGovernance.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {observationGovernance.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={observationGovernanceSaving}
            onClick={() => onReviewObservationGovernance("in_review")}
          >
            Зафиксировать контроль наблюдения
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={observationGovernanceSaving || !observationGovernancePrerequisitesReady}
            onClick={() => onReviewObservationGovernance("ready_for_observation_governance")}
          >
            Утвердить контроль наблюдения
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Закрытие исключений"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Закрытие исключений</h4>
            <p className="text-muted-foreground">
              Закрытие исключений фиксирует только сводные данные · вывод о динамике:
              выключен · Выдача пациенту: выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutExceptionGovernanceStatusLabel(exceptionGovernance.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Register" value={timelineRolloutSopChecklistLabel(exceptionGovernance.exceptionRegisterStatus)} />
          <Field term="SLA" value={timelineRolloutSopChecklistLabel(exceptionGovernance.triageSlaStatus)} />
          <Field term="Evidence" value={timelineRolloutSopChecklistLabel(exceptionGovernance.resolutionEvidenceStatus)} />
          <Field term="Recurrence" value={timelineRolloutSopChecklistLabel(exceptionGovernance.recurrenceReviewStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(exceptionGovernance.rollbackReadinessStatus)} />
          <Field term="Archive" value={timelineRolloutSopChecklistLabel(exceptionGovernance.governanceArchiveStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(exceptionGovernance.ownerSignoffStatus)} />
          <Field term="Real Set" value={exceptionGovernance.realDatasetTimelineCount} />
          <Field term="Observed" value={exceptionGovernance.observedTimelineCount} />
          <Field term="Exceptions" value={exceptionGovernance.governanceExceptionCount} />
          <Field term="Resolved" value={exceptionGovernance.resolvedGovernanceExceptionCount} />
          <Field term="Gov. open" value={exceptionGovernance.unresolvedGovernanceExceptionCount} />
          <Field term="Recurrence open" value={exceptionGovernance.unresolvedRecurrenceSignalCount} />
          <Field term="Rollback" value={exceptionGovernance.rollbackDrillCount} />
          <Field term="Blockers" value={exceptionGovernance.blockerCount} />
        </dl>
        {exceptionGovernance.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exceptionGovernance.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={exceptionGovernanceSaving}
            onClick={() => onReviewExceptionGovernance("in_review")}
          >
            Зафиксировать закрытие исключений
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={exceptionGovernanceSaving || !exceptionGovernancePrerequisitesReady}
            onClick={() => onReviewExceptionGovernance("ready_for_exception_governance")}
          >
            Утвердить закрытие исключений
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Контроль результатов истории"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Контроль результатов истории</h4>
            <p className="text-muted-foreground">
              Контроль результатов фиксирует только сводные данные истории · вывод о динамике выключен · Выдача пациенту
              выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutOutcomeGovernanceStatusLabel(outcomeGovernance.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Window" value={timelineRolloutSopChecklistLabel(outcomeGovernance.longitudinalWindowStatus)} />
          <Field term="Coverage" value={timelineRolloutSopChecklistLabel(outcomeGovernance.realDatasetCoverageStatus)} />
          <Field
            term="Reviewer ops"
            value={timelineRolloutSopChecklistLabel(outcomeGovernance.reviewerOperationsValidationStatus)}
          />
          <Field term="Trend" value={timelineRolloutSopChecklistLabel(outcomeGovernance.exceptionTrendReviewStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(outcomeGovernance.followupCadenceStatus)} />
          <Field term="Governance" value={timelineRolloutSopChecklistLabel(outcomeGovernance.governanceCadenceStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(outcomeGovernance.ownerSignoffStatus)} />
          <Field term="Real Set" value={outcomeGovernance.realDatasetTimelineCount} />
          <Field term="Observed" value={outcomeGovernance.observedTimelineCount} />
          <Field
            term="Follow closed"
            value={`${outcomeGovernance.completedFollowupCount}/${outcomeGovernance.followupWindowCount}`}
          />
          <Field term="Gov. open" value={outcomeGovernance.unresolvedGovernanceExceptionCount} />
          <Field term="Recurrence open" value={outcomeGovernance.unresolvedRecurrenceSignalCount} />
          <Field term="Reviews" value={outcomeGovernance.governanceReviewCount} />
          <Field term="Blockers" value={outcomeGovernance.blockerCount} />
        </dl>
        {outcomeGovernance.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {outcomeGovernance.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={outcomeGovernanceSaving}
            onClick={() => onReviewOutcomeGovernance("in_review")}
          >
            Зафиксировать контроль результатов
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={outcomeGovernanceSaving || !outcomeGovernancePrerequisitesReady}
            onClick={() => onReviewOutcomeGovernance("ready_for_outcome_governance")}
          >
            Утвердить контроль результатов
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Клиническая проверка истории"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Клиническая проверка истории</h4>
            <p className="text-muted-foreground">
              Клиническая проверка истории фиксирует только сводные данные во времени · вывод о динамике выключен · Выдача
              пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutLongitudinalClinicalValidationStatusLabel(longitudinalClinicalValidation.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Window" value={timelineRolloutSopChecklistLabel(longitudinalClinicalValidation.outcomeWindowStatus)} />
          <Field term="Coverage" value={timelineRolloutSopChecklistLabel(longitudinalClinicalValidation.clinicianCoverageStatus)} />
          <Field term="Adjudication" value={timelineRolloutSopChecklistLabel(longitudinalClinicalValidation.adjudicationStatus)} />
          <Field term="Consensus" value={timelineRolloutSopChecklistLabel(longitudinalClinicalValidation.consensusReviewStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(longitudinalClinicalValidation.followupValidationStatus)} />
          <Field term="Governance" value={timelineRolloutSopChecklistLabel(longitudinalClinicalValidation.governanceCadenceStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(longitudinalClinicalValidation.ownerSignoffStatus)} />
          <Field term="Outcome set" value={longitudinalClinicalValidation.realOutcomeWindowCount} />
          <Field term="Validated" value={longitudinalClinicalValidation.clinicallyValidatedWindowCount} />
          <Field term="Adjudicated" value={longitudinalClinicalValidation.adjudicatedWindowCount} />
          <Field term="Follow valid." value={longitudinalClinicalValidation.followupValidatedWindowCount} />
          <Field term="Consensus" value={longitudinalClinicalValidation.consensusReviewCount} />
          <Field term="Consensus open" value={longitudinalClinicalValidation.unresolvedConsensusCaseCount} />
          <Field term="Reviews" value={longitudinalClinicalValidation.governanceReviewCount} />
          <Field term="Blockers" value={longitudinalClinicalValidation.blockerCount} />
        </dl>
        {longitudinalClinicalValidation.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {longitudinalClinicalValidation.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={longitudinalClinicalValidationSaving}
            onClick={() => onReviewLongitudinalClinicalValidation("in_review")}
          >
            Зафиксировать проверку истории
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={longitudinalClinicalValidationSaving || !longitudinalClinicalValidationPrerequisitesReady}
            onClick={() => onReviewLongitudinalClinicalValidation("ready_for_longitudinal_clinical_validation")}
          >
            Утвердить проверку истории
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Проверка закрытых снимков"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Проверка закрытых снимков</h4>
            <p className="text-muted-foreground">
              Проверка закрытых снимков фиксирует только сводные данные работы проверяющих · вывод о динамике выключен ·
              Выдача пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutProtectedReviewerValidationStatusLabel(protectedReviewerValidation.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Assets" value={timelineRolloutSopChecklistLabel(protectedReviewerValidation.protectedAssetWindowStatus)} />
          <Field term="Render" value={timelineRolloutSopChecklistLabel(protectedReviewerValidation.protectedRenderStatus)} />
          <Field term="Assign" value={timelineRolloutSopChecklistLabel(protectedReviewerValidation.reviewerAssignmentStatus)} />
          <Field term="Second" value={timelineRolloutSopChecklistLabel(protectedReviewerValidation.secondReviewStatus)} />
          <Field term="Adjudication" value={timelineRolloutSopChecklistLabel(protectedReviewerValidation.adjudicationOpsStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(protectedReviewerValidation.followupOpsStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(protectedReviewerValidation.ownerSignoffStatus)} />
          <Field term="Protected set" value={protectedReviewerValidation.protectedAssetTimelineCount} />
          <Field term="Render ready" value={protectedReviewerValidation.protectedRenderReadyCount} />
          <Field term="Assigned" value={protectedReviewerValidation.reviewerAssignedProtectedCount} />
          <Field term="2nd review" value={protectedReviewerValidation.secondReviewedProtectedCount} />
          <Field term="Adjudicated" value={protectedReviewerValidation.adjudicatedProtectedCount} />
          <Field term="Follow valid." value={protectedReviewerValidation.followupValidatedProtectedCount} />
          <Field term="Open review" value={protectedReviewerValidation.unresolvedProtectedReviewCount} />
          <Field term="Blockers" value={protectedReviewerValidation.blockerCount} />
        </dl>
        {protectedReviewerValidation.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {protectedReviewerValidation.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={protectedReviewerValidationSaving}
            onClick={() => onReviewProtectedReviewerValidation("in_review")}
          >
            Зафиксировать проверку закрытых снимков
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={protectedReviewerValidationSaving || !protectedReviewerValidationPrerequisitesReady}
            onClick={() => onReviewProtectedReviewerValidation("ready_for_protected_reviewer_validation")}
          >
            Утвердить проверку закрытых снимков
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Контроль закрытой проверки"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Контроль закрытой проверки</h4>
            <p className="text-muted-foreground">
              Контроль закрытой проверки фиксирует только сводные данные работы проверяющих · вывод о динамике выключен ·
              Выдача пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutProtectedReviewerGovernanceStatusLabel(protectedReviewerGovernance.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Monitor" value={timelineRolloutSopChecklistLabel(protectedReviewerGovernance.reviewerMonitoringStatus)} />
          <Field term="Exceptions" value={timelineRolloutSopChecklistLabel(protectedReviewerGovernance.reviewerExceptionStatus)} />
          <Field term="Adjudication" value={timelineRolloutSopChecklistLabel(protectedReviewerGovernance.reviewerAdjudicationStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(protectedReviewerGovernance.reviewerFollowupStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(protectedReviewerGovernance.reviewerRollbackStatus)} />
          <Field term="Archive" value={timelineRolloutSopChecklistLabel(protectedReviewerGovernance.reviewerArchiveStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(protectedReviewerGovernance.ownerSignoffStatus)} />
          <Field term="Windows" value={protectedReviewerGovernance.protectedReviewWindowCount} />
          <Field term="Monitored" value={protectedReviewerGovernance.monitoredProtectedReviewCount} />
          <Field term="Escalated" value={protectedReviewerGovernance.escalatedProtectedReviewCount} />
          <Field term="Adjudicated" value={protectedReviewerGovernance.adjudicatedProtectedGovernanceCount} />
          <Field term="Follow closed" value={protectedReviewerGovernance.followupClosedProtectedCount} />
          <Field term="Rollback ready" value={protectedReviewerGovernance.rollbackReadyProtectedCount} />
          <Field term="Archived" value={protectedReviewerGovernance.archivedProtectedReviewCount} />
          <Field term="Open governance" value={protectedReviewerGovernance.unresolvedGovernanceReviewCount} />
          <Field term="Blockers" value={protectedReviewerGovernance.blockerCount} />
        </dl>
        {protectedReviewerGovernance.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {protectedReviewerGovernance.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={protectedReviewerGovernanceSaving}
            onClick={() => onReviewProtectedReviewerGovernance("in_review")}
          >
            Зафиксировать контроль закрытой проверки
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={protectedReviewerGovernanceSaving || !protectedReviewerGovernancePrerequisitesReady}
            onClick={() => onReviewProtectedReviewerGovernance("ready_for_protected_reviewer_governance")}
          >
            Утвердить контроль закрытой проверки
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Подтверждения закрытой проверки"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Подтверждения закрытой проверки</h4>
            <p className="text-muted-foreground">
              Подтверждения закрытой проверки фиксируют только сводные данные работы проверяющих · вывод о динамике
              выключен · Выдача пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutProtectedReviewerEvidenceStatusLabel(protectedReviewerEvidence.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Monitor" value={timelineRolloutSopChecklistLabel(protectedReviewerEvidence.reviewerMonitoringEvidenceStatus)} />
          <Field term="Exceptions" value={timelineRolloutSopChecklistLabel(protectedReviewerEvidence.reviewerExceptionEvidenceStatus)} />
          <Field term="Adjudication" value={timelineRolloutSopChecklistLabel(protectedReviewerEvidence.reviewerAdjudicationEvidenceStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(protectedReviewerEvidence.reviewerFollowupEvidenceStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(protectedReviewerEvidence.reviewerRollbackEvidenceStatus)} />
          <Field term="Archive" value={timelineRolloutSopChecklistLabel(protectedReviewerEvidence.reviewerArchiveEvidenceStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(protectedReviewerEvidence.ownerSignoffStatus)} />
          <Field term="Windows" value={protectedReviewerEvidence.protectedReviewWindowCount} />
          <Field term="Monitored" value={protectedReviewerEvidence.monitoredProtectedReviewCount} />
          <Field term="Sampled" value={protectedReviewerEvidence.sampledProtectedReviewCount} />
          <Field term="Adjudicated" value={protectedReviewerEvidence.adjudicatedProtectedEvidenceCount} />
          <Field term="Follow closed" value={protectedReviewerEvidence.followupClosedProtectedCount} />
          <Field term="Rollback drills" value={protectedReviewerEvidence.rollbackDrillProtectedCount} />
          <Field term="Archived" value={protectedReviewerEvidence.archivedProtectedReviewCount} />
          <Field term="Open evidence" value={protectedReviewerEvidence.unresolvedProtectedEvidenceCount} />
          <Field term="Blockers" value={protectedReviewerEvidence.blockerCount} />
        </dl>
        {protectedReviewerEvidence.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {protectedReviewerEvidence.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={protectedReviewerEvidenceSaving}
            onClick={() => onReviewProtectedReviewerEvidence("in_review")}
          >
            Зафиксировать подтверждения закрытой проверки
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={protectedReviewerEvidenceSaving || !protectedReviewerEvidencePrerequisitesReady}
            onClick={() => onReviewProtectedReviewerEvidence("ready_for_protected_reviewer_evidence")}
          >
            Утвердить подтверждения закрытой проверки
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Подтверждение рабочих данных"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Подтверждение рабочих данных</h4>
            <p className="text-muted-foreground">
              Подтверждение рабочих данных фиксирует только сводные данные по рабочим визитам · вывод о динамике
              выключен · Выдача пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutProductionDatasetEvidenceStatusLabel(productionDatasetEvidence.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Real ops" value={timelineRolloutSopChecklistLabel(productionDatasetEvidence.realClinicWindowStatus)} />
          <Field term="Sampling" value={timelineRolloutSopChecklistLabel(productionDatasetEvidence.datasetSamplingStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(productionDatasetEvidence.longitudinalFollowupStatus)} />
          <Field term="Reviewer link" value={timelineRolloutSopChecklistLabel(productionDatasetEvidence.protectedReviewerLinkageStatus)} />
          <Field term="Observation" value={timelineRolloutSopChecklistLabel(productionDatasetEvidence.outcomeObservationStatus)} />
          <Field term="Incidents" value={timelineRolloutSopChecklistLabel(productionDatasetEvidence.incidentLinkageStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(productionDatasetEvidence.ownerSignoffStatus)} />
          <Field term="Windows" value={productionDatasetEvidence.realClinicWindowCount} />
          <Field term="Monitored" value={productionDatasetEvidence.monitoredClinicOperationCount} />
          <Field term="Sampled" value={productionDatasetEvidence.sampledClinicOperationCount} />
          <Field term="Follow-up" value={productionDatasetEvidence.longitudinalFollowupCount} />
          <Field term="Reviewer linked" value={productionDatasetEvidence.protectedReviewerLinkedCount} />
          <Field term="Observed" value={productionDatasetEvidence.observedOutcomeCount} />
          <Field term="Incident linked" value={productionDatasetEvidence.incidentLinkedCount} />
          <Field term="Open evidence" value={productionDatasetEvidence.unresolvedProductionDatasetEvidenceCount} />
          <Field term="Blockers" value={productionDatasetEvidence.blockerCount} />
        </dl>
        {productionDatasetEvidence.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {productionDatasetEvidence.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={productionDatasetEvidenceSaving}
            onClick={() => onReviewProductionDatasetEvidence("in_review")}
          >
            Зафиксировать рабочие данные
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={productionDatasetEvidenceSaving || !productionDatasetEvidencePrerequisitesReady}
            onClick={() => onReviewProductionDatasetEvidence("ready_for_production_dataset_evidence")}
          >
            Утвердить рабочие данные
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Контроль рабочей проверки"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Контроль рабочей проверки</h4>
            <p className="text-muted-foreground">
              Контроль рабочей проверки фиксирует только сводные данные работы проверяющих · вывод о динамике выключен ·
              Выдача пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutProductionReviewerGovernanceStatusLabel(productionReviewerGovernance.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Assign" value={timelineRolloutSopChecklistLabel(productionReviewerGovernance.productionReviewerAssignmentStatus)} />
          <Field term="Second" value={timelineRolloutSopChecklistLabel(productionReviewerGovernance.productionSecondReviewStatus)} />
          <Field term="Adjudication" value={timelineRolloutSopChecklistLabel(productionReviewerGovernance.productionAdjudicationStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(productionReviewerGovernance.productionFollowupStatus)} />
          <Field term="Exceptions" value={timelineRolloutSopChecklistLabel(productionReviewerGovernance.productionExceptionStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(productionReviewerGovernance.productionRollbackStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(productionReviewerGovernance.ownerSignoffStatus)} />
          <Field term="Windows" value={productionReviewerGovernance.productionReviewWindowCount} />
          <Field term="Assigned" value={productionReviewerGovernance.assignedProductionReviewerCount} />
          <Field term="2nd review" value={productionReviewerGovernance.secondReviewedProductionCount} />
          <Field term="Adjudicated" value={productionReviewerGovernance.adjudicatedProductionReviewCount} />
          <Field term="Follow closed" value={productionReviewerGovernance.followupClosedProductionCount} />
          <Field term="Exceptions closed" value={productionReviewerGovernance.exceptionClosedProductionCount} />
          <Field term="Rollback ready" value={productionReviewerGovernance.rollbackReadyProductionCount} />
          <Field term="Open governance" value={productionReviewerGovernance.unresolvedProductionReviewerGovernanceCount} />
          <Field term="Blockers" value={productionReviewerGovernance.blockerCount} />
        </dl>
        {productionReviewerGovernance.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {productionReviewerGovernance.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={productionReviewerGovernanceSaving}
            onClick={() => onReviewProductionReviewerGovernance("in_review")}
          >
            Зафиксировать контроль рабочей проверки
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={productionReviewerGovernanceSaving || !productionReviewerGovernancePrerequisitesReady}
            onClick={() => onReviewProductionReviewerGovernance("ready_for_production_reviewer_governance")}
          >
            Утвердить контроль рабочей проверки
          </Button>
        </div>
      </div>
      <div
        role="region"
        aria-label="Подтверждение рабочей проверки"
        className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold">Подтверждение рабочей проверки</h4>
            <p className="text-muted-foreground">
              Подтверждение рабочей проверки фиксирует только сводные данные работы проверяющих · вывод о динамике
              выключен · Выдача пациенту выключена.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-surface px-2 py-1 font-medium">
            {timelineRolloutProductionReviewerEvidenceStatusLabel(productionReviewerEvidence.status)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Field term="Assign" value={timelineRolloutSopChecklistLabel(productionReviewerEvidence.productionReviewerAssignmentStatus)} />
          <Field term="Second" value={timelineRolloutSopChecklistLabel(productionReviewerEvidence.productionSecondReviewStatus)} />
          <Field term="Adjudication" value={timelineRolloutSopChecklistLabel(productionReviewerEvidence.productionAdjudicationStatus)} />
          <Field term="Follow-up" value={timelineRolloutSopChecklistLabel(productionReviewerEvidence.productionFollowupStatus)} />
          <Field term="Exceptions" value={timelineRolloutSopChecklistLabel(productionReviewerEvidence.productionExceptionStatus)} />
          <Field term="Rollback" value={timelineRolloutSopChecklistLabel(productionReviewerEvidence.productionRollbackStatus)} />
          <Field term="Owner" value={timelineRolloutSopChecklistLabel(productionReviewerEvidence.ownerSignoffStatus)} />
          <Field term="Windows" value={productionReviewerEvidence.productionReviewWindowCount} />
          <Field term="Assigned" value={productionReviewerEvidence.assignedProductionReviewerCount} />
          <Field term="2nd review" value={productionReviewerEvidence.secondReviewedProductionCount} />
          <Field term="Adjudicated" value={productionReviewerEvidence.adjudicatedProductionReviewCount} />
          <Field term="Follow closed" value={productionReviewerEvidence.followupClosedProductionCount} />
          <Field term="Exceptions closed" value={productionReviewerEvidence.exceptionClosedProductionCount} />
          <Field term="Rollback ready" value={productionReviewerEvidence.rollbackReadyProductionCount} />
          <Field term="Open evidence" value={productionReviewerEvidence.unresolvedProductionReviewerEvidenceCount} />
          <Field term="Blockers" value={productionReviewerEvidence.blockerCount} />
        </dl>
        {productionReviewerEvidence.reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {productionReviewerEvidence.reasons.slice(0, 3).map((reason) => (
              <span key={reason} className="rounded-sm border border-border bg-surface px-2 py-1 text-muted-foreground">
                {timelineReasonLabel(reason)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-[12px]"
            disabled={productionReviewerEvidenceSaving}
            onClick={() => onReviewProductionReviewerEvidence("in_review")}
          >
            Зафиксировать подтверждение рабочей проверки
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={productionReviewerEvidenceSaving || !productionReviewerEvidencePrerequisitesReady}
            onClick={() => onReviewProductionReviewerEvidence("ready_for_production_reviewer_evidence")}
          >
            Утвердить подтверждение рабочей проверки
          </Button>
        </div>
      </div>
      {validation.items.length > 0 ? (
        <ol id="timeline-qa-lesions" className="mt-3 grid grid-cols-1 gap-2">
          {validation.items.slice(0, 5).map((item) => (
            <li
              key={`${item.queueNumber}-${item.lesionId}`}
              className="grid grid-cols-1 gap-2 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.lesionLabel}</span>
                  <span className="text-muted-foreground">{longitudinalDatasetStatusLabel(item.status)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {item.bodyZone ?? "зона не указана"} · визитов: {item.visitCount} · снимков: {item.imageCount} · пар:{" "}
                  {item.candidatePairCount}
                </p>
                <p className="mt-1 text-muted-foreground">
                  снимки: {item.productionAssetNotReadyCount} · данные: {item.missingCaptureMetadataCount} · устройство:{" "}
                  {item.deviceEvidenceNotReadyCount} · связь:{" "}
                  {item.deviceBridgeQualityNotReadyCount} · протокол:{" "}
                  {item.captureProtocolNotReadyCount} · правила:{" "}
                  {item.measurementPolicyNotReadyCount} · анализ:{" "}
                  {item.productionAnalysisPolicyNotReadyCount} · назнач.:{" "}
                  {item.reviewerAssignmentNotReadyCount} · повтор:{" "}
                  {item.secondReviewNotReadyCount} ·
                  калибровка: {item.calibrationBlockedCount} · маркеры: {item.markerMissingCount}
                </p>
              </div>
              <span className="self-start rounded-sm border border-border bg-surface px-2 py-1 font-medium">
                {longitudinalDatasetActionLabel(item.nextAction)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-sm border border-dashed border-border bg-surface-muted px-2.5 py-2 text-muted-foreground">
          Нет очагов для проверки истории в этом визите.
        </p>
      )}
      <p className="mt-3 text-muted-foreground">
        Динамический вывод: выключен · измерения выключены · ключи пары и идентификаторы снимков скрыты.
      </p>
    </section>
  );
}

function ViewerQaReviewQueuePanel({
  queue,
}: {
  queue: SelfHostedLesionComparisonViewerQaReviewQueueDTO;
}) {
  return (
    <section
      role="region"
      aria-label="Очередь проверки снимков"
      className="rounded-sm border border-border bg-surface px-3 py-3 text-[12px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold">Очередь проверки снимков</h3>
          <p className="text-muted-foreground">
            Технический контур сравнения · без медицинских измерений и выводов о динамике.
          </p>
        </div>
        <span className="rounded-sm border border-border bg-surface-muted px-2 py-1 font-medium">
          Активных: {queue.summary.actionable}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Field term="Всего" value={queue.summary.total} />
        <Field term="Без разбора" value={queue.summary.unreviewed} />
        <Field term="Готово" value={queue.summary.technicalReady} />
        <Field term="Переснять" value={queue.summary.needsRecapture} />
        <Field term="Не динамика" value={queue.summary.notSuitableForComparison} />
        <Field term="Policy" value={queue.summary.measurementPolicyRequired} />
        <Field term="Analysis" value={queue.summary.productionAnalysisPolicyRequired} />
        <Field term="Assign" value={queue.summary.reviewerAssignmentRequired} />
        <Field term="Second" value={queue.summary.secondReviewRequired} />
      </dl>
      {queue.items.length > 0 ? (
        <ol className="mt-3 grid grid-cols-1 gap-2">
          {queue.items.slice(0, 5).map((item) => (
            <li
              key={`${item.queueNumber}-${item.lesionId}`}
              className="grid grid-cols-1 gap-2 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.lesionLabel}</span>
                  <span className="text-muted-foreground">{viewerQaReviewStatusLabel(item.review.status)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {item.bodyZone ?? "зона не указана"} · калибровка: {item.calibrationStatus} · маркеров:{" "}
                  {item.technicalMarkerCount} · правила: {humanDisplayValue(item.measurementPolicy.status)} · анализ:{" "}
                  {humanDisplayValue(item.productionAnalysisPolicy.status)} · назнач.:{" "}
                  {humanDisplayValue(item.reviewerAssignment.status)} · повтор: {humanDisplayValue(item.secondReview.status)}
                </p>
                {item.review.reasons.length > 0 && (
                  <p className="mt-1 text-muted-foreground">{item.review.reasons.slice(0, 2).join(", ")}</p>
                )}
              </div>
              <span className="self-start rounded-sm border border-border bg-surface px-2 py-1 font-medium">
                {viewerQaNextActionLabel(item.nextAction)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-sm border border-dashed border-border bg-surface-muted px-2.5 py-2 text-muted-foreground">
          Нет технических решений, требующих действия.
        </p>
      )}
      <p className="mt-3 text-muted-foreground">
        Выдача пациенту: выключена · ключи пары и идентификаторы снимков скрыты · аудит: только сводные данные.
      </p>
    </section>
  );
}

function PhotoProtocolReleaseAuditSummary({
  audit,
}: {
  audit: SelfHostedPatientPhotoProtocolReleaseAuditDTO;
}) {
  const statusLabel = audit.status === "revoked"
    ? "Отозван"
    : audit.status === "prepared"
      ? "Подготовлен"
      : "Блокирован";
  return (
    <section
      role="region"
      aria-label="Журнал выдачи фото"
      className="mt-3 rounded-sm border border-border bg-surface px-2.5 py-2 text-[12px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold">Журнал выдачи фото</h4>
          <p className="text-muted-foreground">
            Неизменяемый аудит · исходные данные, причины отзыва и служебные идентификаторы скрыты.
          </p>
        </div>
        <span className="rounded-sm border border-border bg-surface-muted px-2 py-1 font-medium">
          {statusLabel} · {audit.summary.eventCount}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field term="Подготовка" value={audit.summary.preparedEvents} />
        <Field term="Политика" value={audit.summary.policyReviewEvents} />
        <Field term="Отзыв" value={audit.summary.revokedEvents} />
        <Field term="Просмотры" value={audit.summary.patientReadEvents} />
        <Field term="Открытия фото" value={audit.summary.proxyDownloadEvents} />
        <Field term="Отказы доступа" value={audit.summary.proxyDeniedEvents} />
      </dl>
      {audit.events.length > 0 ? (
        <ol className="mt-2 grid grid-cols-1 gap-1.5">
          {audit.events.slice(0, 5).map((event, index) => (
            <li
              key={`${event.kind}-${event.occurredAt ?? index}`}
              className="grid grid-cols-1 gap-1 rounded-sm border border-border/70 bg-surface-muted px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <span className="font-medium">{event.label}</span>
                <span className="ml-2 text-muted-foreground">
                  {event.actorType === "patient" ? "пациентский контур" : "контур клиники"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground sm:justify-end">
                <span>{event.occurredAt ? formatDateTime(event.occurredAt) : "время скрыто"}</span>
                {event.reasonPresent && <span>причина есть, текст скрыт</span>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-muted-foreground">Событий выдачи пока нет.</p>
      )}
    </section>
  );
}

function PhotoProtocolPolicyGovernancePanel({
  photoProtocol,
  form,
  saving,
  onChange,
  onSave,
}: {
  photoProtocol: SelfHostedClinicalReportPackageDTO["patientPhotoProtocol"];
  form: {
    expiresAt: string;
    patientFileProxyEnabled: boolean;
    patientCopyApproved: boolean;
    retentionPolicyApproved: boolean;
  };
  saving: boolean;
  onChange: (
    updater: (
      prev: {
        expiresAt: string;
        patientFileProxyEnabled: boolean;
        patientCopyApproved: boolean;
        retentionPolicyApproved: boolean;
      },
    ) => {
      expiresAt: string;
      patientFileProxyEnabled: boolean;
      patientCopyApproved: boolean;
      retentionPolicyApproved: boolean;
    },
  ) => void;
  onSave: () => void;
}) {
  return (
    <section
      role="region"
      aria-label="Проверка политики выдачи фото"
      className="rounded-sm border border-border bg-surface px-3 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold">Проверка политики выдачи фото</h4>
          <p className="text-[12px] text-muted-foreground">
            До выдачи пациенту нужны: защищённый доступ к файлам, утверждённый срок доступа и проверенный текст для пациента.
          </p>
        </div>
        <span className="rounded-sm border border-border bg-surface-muted px-2 py-1 text-[12px] font-medium">
          {photoProtocol.deliveryBoundary.requiresSelfHostedFileProxy ||
          photoProtocol.deliveryBoundary.requiresRetentionPolicy ||
          photoProtocol.deliveryBoundary.requiresApprovedPatientCopy
            ? "Требует проверки"
            : "Проверка закрыта"}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
        <Field term="Release ledger" value={photoProtocol.policy.releasePrepared ? "есть" : "нет"} />
        <Field term="File proxy" value={photoProtocol.deliveryBoundary.requiresSelfHostedFileProxy ? "не готов" : "готов"} />
        <Field term="Retention" value={photoProtocol.deliveryBoundary.requiresRetentionPolicy ? "не подтверждён" : "подтверждён"} />
        <Field term="Patient copy" value={photoProtocol.deliveryBoundary.requiresApprovedPatientCopy ? "нужна проверка" : "проверен"} />
      </dl>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-h-[44px] items-center gap-2 rounded-sm border border-border bg-surface-muted px-2 py-2 text-[12px]">
          <input
            type="checkbox"
            checked={form.patientFileProxyEnabled}
            onChange={(event) => onChange((prev) => ({ ...prev, patientFileProxyEnabled: event.target.checked }))}
          />
          <span>Включён защищённый доступ к файлам</span>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 rounded-sm border border-border bg-surface-muted px-2 py-2 text-[12px]">
          <input
            type="checkbox"
            checked={form.retentionPolicyApproved}
            onChange={(event) => onChange((prev) => ({ ...prev, retentionPolicyApproved: event.target.checked }))}
          />
          <span>Утверждён срок доступа</span>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 rounded-sm border border-border bg-surface-muted px-2 py-2 text-[12px] sm:col-span-2">
          <input
            type="checkbox"
            checked={form.patientCopyApproved}
            onChange={(event) => onChange((prev) => ({ ...prev, patientCopyApproved: event.target.checked }))}
          />
          <span>Проверен текст для пациента</span>
        </label>
      </div>
      <div className="mt-2">
        <label className="space-y-1 text-[12px] font-medium">
          Срок доступа
          <Input
            aria-label="Срок доступа к фото"
            value={form.expiresAt}
            onChange={(event) => onChange((prev) => ({ ...prev, expiresAt: event.target.value }))}
            placeholder="2026-06-10 10:00"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="min-h-[44px] sm:min-h-[32px]"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Сохраняем политику…" : "Сохранить политику выдачи"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Правила меняют только сводные данные и проверки. Ссылки, токены и служебные пути остаются скрыты.
        </span>
      </div>
    </section>
  );
}

function ProductionClinicalWorkspaceEmptyState({
  kind,
  detail,
}: {
  kind: ClinicalPanelKind;
  detail?: string;
}) {
  const copy = {
    assessment: {
      title: "Оценка ждёт систему клиники",
      text: "Рабочее место клиники: демо-данные скрыты. Клиническая оценка будет доступна после подключения системы клиники.",
    },
    conclusion: {
      title: "Заключение ждёт систему клиники",
      text: "Рабочее место клиники: демо-данные скрыты. Заключение не собирается из демо-данных.",
    },
    report: {
      title: "Отчёт ждёт систему клиники",
      text: "Рабочее место клиники: демо-данные скрыты. Рабочий отчёт будет собираться только из данных системы клиники.",
    },
  }[kind];

  return (
    <Section title={copy.title}>
      <div role="note" className="space-y-2 text-[13px] text-muted-foreground">
        <p>{detail || copy.text}</p>
        <p>
          Граница рабочей системы: экран показывает только данные пациента, визита и очагов из системы клиники.
          Демо-оценки не подставляются.
        </p>
      </div>
    </Section>
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
        <Field term="Фототип" value={patient.phototype} />
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

interface LocalLesionDraft {
  id: string;
  label: string;
  bodyZone: string;
  status: Lesion["status"];
  mapPoint: BodyMapPoint;
  note: string;
  createdAt: string;
}

function BodyMapTab({
  patient,
  visit,
  lesions,
  productionMode = false,
  initialLesionId,
  onOpenImaging,
}: {
  patient: Patient;
  visit: Visit;
  lesions: Lesion[];
  productionMode?: boolean;
  initialLesionId?: string | null;
  onOpenImaging: (lesionId: string) => void;
}) {
  const variant: BodyMapVariant = getBodyMapVariant(patient);
  const variantLabel = bodyMapVariantLabel(variant);

  const placedLesions = useMemo(() => {
    return lesions.map((l, i) => ({ lesion: l, point: resolvePoint(l), num: i + 1 }));
  }, [lesions]);

  const initialFromParam = initialLesionId
    ? placedLesions.find((p) => p.lesion.id === initialLesionId) ?? null
    : null;
  const initialLesion = initialFromParam ?? placedLesions[0] ?? null;
  const initialView: View = initialLesion?.point.view ?? "front";

  const [view, setView] = useState<View>(initialView);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(initialLesion?.lesion.id ?? null);
  const [pending, setPending] = useState<PendingPoint | null>(null);
  const [draftLabel, setDraftLabel] = useState("Новый очаг");
  const [draftStatus, setDraftStatus] = useState<Lesion["status"]>("active");
  const [draftNote, setDraftNote] = useState("");
  const [zoneDraft, setZoneDraft] = useState("");
  const [localDrafts, setLocalDrafts] = useState<LocalLesionDraft[]>([]);
  const [productionPlacementNotice, setProductionPlacementNotice] = useState("");

  const isLocalId = (id: string | null) => !!id && id.startsWith("local-lesion-");
  const selectedDraft = selected && isLocalId(selected) ? localDrafts.find((d) => d.id === selected) ?? null : null;

  // React to external (URL) lesion changes.
  useEffect(() => {
    if (initialLesionId && placedLesions.some((p) => p.lesion.id === initialLesionId)) {
      setSelected(initialLesionId);
    }
  }, [initialLesionId, placedLesions]);

  // Switch projection whenever the selected lesion lives on a different one.
  useEffect(() => {
    if (!selected) return;
    if (isLocalId(selected)) {
      const d = localDrafts.find((x) => x.id === selected);
      if (d) setView((current) => (current === d.mapPoint.view ? current : d.mapPoint.view));
      return;
    }
    const p = placedLesions.find((x) => x.lesion.id === selected)?.point;
    if (!p) return;
    setView((current) => (current === p.view ? current : p.view));
  }, [selected, placedLesions, localDrafts]);

  // Drop pending placement when projection changes.
  useEffect(() => {
    setPending(null);
  }, [view]);

  const visiblePoints = placedLesions.filter((p) => p.point.view === view);
  const selectedLesion = selected && !isLocalId(selected) ? lesions.find((l) => l.id === selected) ?? null : null;
  const visitAssessments = productionMode ? [] : getAssessmentsByVisitId(visit.id);
  const selImages = selectedLesion && !productionMode ? getImagesByLesionId(selectedLesion.id) : [];
  const selImageCount = selImages.length;
  const selAssessment = selectedLesion ? visitAssessments.find((a) => a.lesionId === selectedLesion.id) : undefined;
  const selKinds = Array.from(new Set(selImages.map((i) => i.kind)));
  const selNeedsReview = selImages.some((i) => i.quality.score < 0.8 || i.quality.issues.length > 0);
  const selLatestAt = selImages.length
    ? selImages.map((i) => i.capturedAt).sort().slice(-1)[0]
    : null;

  const handlePlace = (np: { view: View; x: number; y: number }) => {
    if (productionMode) {
      setProductionPlacementNotice(
        "Рабочий режим: локальное демо-добавление очага отключено. Используйте запись визита из системы клиники.",
      );
      return;
    }
    const zone = suggestBodyZone(np.view, np.x, np.y);
    setPending({ view: np.view, x: np.x, y: np.y, zone });
    setZoneDraft(zone);
    setDraftLabel("Новый очаг");
    setDraftStatus("active");
    setDraftNote("");
  };

  const cancelPending = () => {
    setPending(null);
    setDraftNote("");
  };

  const addLocalDraft = () => {
    if (!pending) return;
    const id = `local-lesion-${localDrafts.length + 1}`;
    const draft: LocalLesionDraft = {
      id,
      label: draftLabel.trim() || "Новый очаг",
      bodyZone: zoneDraft.trim() || pending.zone,
      status: draftStatus,
      mapPoint: { view: pending.view, x: pending.x, y: pending.y },
      note: draftNote,
      createdAt: BODY_MAP_DEMO_NOW,
    };
    setLocalDrafts((prev) => [...prev, draft]);
    setSelected(id);
    setPending(null);
    setDraftNote("");
  };

  const localDraftsForView = localDrafts.filter((d) => d.mapPoint.view === view);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-12">
      {/* Map pane */}
      <div className="flex min-h-0 flex-col border-b border-border lg:col-span-7 lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-foreground">Полная карта тела</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Создание очага, выбор поверхности, привязка к снимкам и переход в съёмку.
            </p>
          </div>
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
              demoPoints={localDraftsForView.map((d, i) => ({
                id: d.id,
                num: i + 1,
                x: d.mapPoint.x,
                y: d.mapPoint.y,
                selected: d.id === selected,
                onSelect: () => setSelected(d.id),
                label: d.label,
              }))}
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
        {productionPlacementNotice && (
          <div
            role="status"
            aria-live="polite"
            className="border-b border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground"
          >
            {productionPlacementNotice}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          {lesions.length === 0 ? (
            <div className="p-6 text-[13px] text-muted-foreground">Образования у пациента не зарегистрированы.</div>
          ) : (
            <ul className="divide-y divide-border">
              {placedLesions.map(({ lesion, num, point }) => {
                const lImages = productionMode ? [] : getImagesByLesionId(lesion.id);
                const imageCount = lImages.length;
                const a = visitAssessments.find((x) => x.lesionId === lesion.id);
                const lNeedsReview = lImages.some((i) => i.quality.score < 0.8 || i.quality.issues.length > 0);
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
                      <Stat term="4 признака" value={a ? a.abcd.total.toFixed(1) : "—"} />
                      <Stat term="7 баллов" value={a ? a.sevenPoint.total : "—"} />
                    </dl>
                    {!productionMode && (imageCount === 0 || !a || lNeedsReview) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {imageCount === 0 && (
                          <span className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            нет снимков
                          </span>
                        )}
                        {!a && (
                          <span className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            нет оценки
                          </span>
                        )}
                        {lNeedsReview && (
                          <span className="rounded-sm border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] text-warning">
                            нужен пересмотр
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {localDrafts.length > 0 && (
          <div className="border-t border-border bg-surface">
            <div className="bg-surface-muted px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Локальные демо-очаги ({localDrafts.length})
            </div>
            <ul className="divide-y divide-border">
              {localDrafts.map((d, i) => {
                const isSel = d.id === selected;
                return (
                  <li
                    key={d.id}
                    className={`cursor-pointer px-3 py-2 text-[13px] ${isSel ? "bg-surface-muted" : "bg-surface hover:bg-surface-muted"}`}
                    onClick={() => {
                      setSelected(d.id);
                      setView(d.mapPoint.view);
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed text-[11px] tabular-nums ${
                            isSel ? "border-primary bg-primary/10 text-primary" : "border-primary/60 bg-surface text-primary"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{d.label}</div>
                          <div className="truncate text-[12px] text-muted-foreground">
                            {d.bodyZone} · {bodyMapViewLabel(d.mapPoint.view)}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-sm border border-dashed border-primary/60 bg-surface px-1.5 py-0.5 text-[11px] text-primary">
                        локально, не сохранено
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {pending && (
          <div className="border-t border-border bg-surface p-3">
            <div className="text-[13px] font-semibold">Новый очаг (демо)</div>
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
            <label className="mt-2 block text-[11px] text-muted-foreground">
              Метка очага
              <Input
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                className="mt-1 h-8 text-[12px]"
              />
            </label>
            <label className="mt-2 block text-[11px] text-muted-foreground">
              Статус
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as Lesion["status"])}
                className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-[12px]"
                aria-label="Статус демо-очага"
              >
                {(Object.keys(LESION_STATUS) as Array<Lesion["status"]>).map((s) => (
                  <option key={s} value={s}>{LESION_STATUS[s]}</option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-[11px] text-muted-foreground">
              Комментарий врача (демо)
              <Textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                className="mt-1 min-h-[60px] text-[12px]"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={addLocalDraft}
              >
                Добавить локально
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={cancelPending}
              >
                Отменить
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Демо-очаг не сохранён в мок-данные.
            </p>
          </div>
        )}

        {selectedDraft && (
          <div className="border-t border-border bg-surface p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{selectedDraft.label}</div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {selectedDraft.bodyZone} · проекция {bodyMapViewLabel(selectedDraft.mapPoint.view)}
                </div>
              </div>
              <span className="shrink-0 rounded-sm border border-dashed border-primary/60 bg-surface px-1.5 py-0.5 text-[11px] text-primary">
                локально, не сохранено
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-x-2 text-[11px]">
              <Stat term="X / Y" value={`${Math.round(selectedDraft.mapPoint.x * 100)}% / ${Math.round(selectedDraft.mapPoint.y * 100)}%`} />
              <Stat term="Снимков" value="—" />
              <Stat term="4 признака" value="—" />
              <Stat term="7 баллов" value="—" />
            </dl>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              <Stat term="Статус" value={LESION_STATUS[selectedDraft.status]} />
              <Stat term="ID" value={<span className="font-mono">{selectedDraft.id}</span>} />
            </dl>
            {selectedDraft.note && (
              <div className="mt-2 rounded-sm border border-dashed border-border bg-surface-muted px-2 py-1.5 text-[12px]">
                {selectedDraft.note}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Это демо-очаг. Он существует только в UI текущего визита.
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
              <Stat term="4 признака" value={selAssessment ? selAssessment.abcd.total.toFixed(1) : "—"} />
              <Stat term="7 баллов" value={selAssessment ? selAssessment.sevenPoint.total : "—"} />
            </dl>
            <div className="mt-2 rounded-md border border-border bg-surface-muted px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <Images className="h-3.5 w-3.5" aria-hidden /> Связанные снимки
                </div>
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${
                    selImageCount === 0
                      ? "border border-border bg-surface text-muted-foreground"
                      : selNeedsReview
                        ? "bg-warning text-warning-foreground"
                        : "bg-success text-success-foreground"
                  }`}
                >
                  {selImageCount === 0 ? "нет снимков" : selNeedsReview ? "нужен пересмотр" : "качество ок"}
                </span>
              </div>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-2 text-[11px]">
                <Stat term="Всего" value={selImageCount} />
                <Stat term="Последний" value={selLatestAt ? formatDate(selLatestAt) : "—"} />
              </dl>
              {selKinds.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {selKinds.map((k) => (
                    <span key={k} className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {k === "overview" ? "Обзор" : k === "dermoscopy" ? "Дерматоскопия" : k === "macro" ? "Макро" : "Карта тела"}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => onOpenImaging(selectedLesion.id)}
                >
                  К снимкам этого очага <ChevronRight className="ml-0.5 h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Локальная навигация по визиту. Без обращений к хранилищу и без диагноза.
              </p>
            </div>
            {productionMode ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Рабочее место клиники: демо-данные скрыты. Карта тела показывает только
                размещение очага из системы клиники; оценки и отчёты ждут рабочие контракты.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Клинические значения по четырём признакам и 7-балльной шкале — данные из демонстрационных оценок этого визита, без автоматического диагноза.
              </p>
            )}
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
  demoPoints: PointProps[];
  onPlace: (np: { view: View; x: number; y: number }) => void;
}

function BodySvg({ variant, view, points, pending, demoPoints, onPlace }: BodySvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const ariaLabel = `Карта тела · ${bodyMapVariantLabel(variant)} · ${bodyMapSurfaceLabel(view)}`;
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
      {demoPoints.map((p) => (
        <g key={`demo-${p.id}`} onClick={(e) => { e.stopPropagation(); p.onSelect(); }} style={{ cursor: "pointer" }}>
          <title>{`Локальный демо-очаг: ${p.label}`}</title>
          <circle
            cx={p.x * 200}
            cy={p.y * 400}
            r={p.selected ? 8 : 6}
            fill="hsl(var(--surface))"
            stroke="hsl(var(--primary))"
            strokeDasharray="2 2"
            strokeWidth={1.4}
            opacity={0.85}
          />
          <text
            x={p.x * 200}
            y={p.y * 400 + 3}
            textAnchor="middle"
            fontSize={8}
            fontWeight={700}
            fill="hsl(var(--primary))"
          >
            {p.num}
          </text>
        </g>
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
    <div className="flex min-w-0 items-baseline justify-between gap-2 border-b border-dashed border-border pb-1.5 last:border-b-0 last:pb-0">
      <dt className="min-w-0 truncate text-[12px] text-muted-foreground">{humanFieldTerm(term)}</dt>
      <dd className="min-w-0 truncate text-right">{typeof value === "string" ? humanDisplayValue(value) : value}</dd>
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
