import type { SelfHostedVisitLongitudinalDatasetValidationDTO } from "@/lib/self-hosted-clinical-workspace-api";

type LongitudinalReadiness = SelfHostedVisitLongitudinalDatasetValidationDTO["readiness"];

type LongitudinalQaSummaryGroup = {
  title: string;
  status: string;
  detail: string;
  action: string;
};

function buildLongitudinalQaSummaryGroups({
  readiness,
  completedSteps,
  totalSteps,
  currentStepLabel,
}: {
  readiness: LongitudinalReadiness;
  completedSteps: number;
  totalSteps: number;
  currentStepLabel: string;
}): LongitudinalQaSummaryGroup[] {
  const dataBlockerCount =
    readiness.productionAssetNotReadyCount
    + readiness.missingCaptureMetadataCount
    + readiness.captureProtocolNotReadyCount;
  const comparisonBlockerCount =
    readiness.deviceEvidenceNotReadyCount
    + readiness.deviceBridgeQualityNotReadyCount
    + readiness.calibrationBlockedCount
    + readiness.markerMissingCount;
  const reviewerBlockerCount =
    readiness.measurementPolicyNotReadyCount
    + readiness.productionAnalysisPolicyNotReadyCount
    + readiness.reviewerAssignmentNotReadyCount
    + readiness.secondReviewNotReadyCount;
  const workingControlBlockerCount = Math.max(0, totalSteps - completedSteps);

  return [
    {
      title: "Данные снимков",
      status: dataBlockerCount > 0 ? `${dataBlockerCount} препятств.` : "готово",
      detail: `снимков: ${readiness.imageCount} · пар: ${readiness.candidatePairCount}`,
      action: dataBlockerCount > 0 ? "Дозаполнить данные" : "Данные готовы",
    },
    {
      title: "Условия сравнения",
      status: comparisonBlockerCount > 0 ? `${comparisonBlockerCount} препятств.` : "готово",
      detail: `устройство: ${readiness.deviceEvidenceNotReadyCount} · связь: ${readiness.deviceBridgeQualityNotReadyCount}`,
      action: comparisonBlockerCount > 0 ? "Проверить условия" : "Условия готовы",
    },
    {
      title: "Разбор врачом",
      status: reviewerBlockerCount > 0 ? `${reviewerBlockerCount} препятств.` : "готово",
      detail: `правила: ${readiness.measurementPolicyNotReadyCount} · повтор: ${readiness.secondReviewNotReadyCount}`,
      action: reviewerBlockerCount > 0 ? "Закрыть разбор" : "Разбор готов",
    },
    {
      title: "Рабочий контроль",
      status: `${completedSteps}/${totalSteps}`,
      detail: `следующий шаг: ${currentStepLabel}`,
      action: workingControlBlockerCount > 0 ? "Продолжить контроль" : "Контроль закрыт",
    },
  ];
}

export function LongitudinalQaSummary({
  readiness,
  completedSteps,
  totalSteps,
  currentStepLabel,
}: {
  readiness: LongitudinalReadiness;
  completedSteps: number;
  totalSteps: number;
  currentStepLabel: string;
}) {
  const groups = buildLongitudinalQaSummaryGroups({
    readiness,
    completedSteps,
    totalSteps,
    currentStepLabel,
  });

  return (
    <>
      <p className="mt-3 text-[11px] font-medium uppercase text-muted-foreground">Краткая сводка проверки истории</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Краткая сводка проверки истории">
        {groups.map((group) => (
          <div key={group.title} className="min-w-0 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-[12px] font-semibold">{group.title}</p>
              <span className="shrink-0 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium">
                {group.status}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{group.detail}</p>
            <p className="mt-1 font-medium text-foreground">{group.action}</p>
          </div>
        ))}
      </div>
    </>
  );
}
