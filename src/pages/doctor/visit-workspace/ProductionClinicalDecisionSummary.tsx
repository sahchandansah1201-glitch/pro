type ProductionClinicalDecisionSummaryProps = {
  longitudinalClinicalValidationReady: boolean;
  productionDatasetEvidenceReady: boolean;
  productionReviewerRollbackEvidenceReady: boolean;
  productionReviewerGovernanceReady: boolean;
  productionReviewerEvidenceReady: boolean;
  realClinicWindowCount: number;
  sampledClinicOperationCount: number;
  productionReviewWindowCount: number;
  secondReviewedProductionCount: number;
};

export function ProductionClinicalDecisionSummary({
  longitudinalClinicalValidationReady,
  productionDatasetEvidenceReady,
  productionReviewerRollbackEvidenceReady,
  productionReviewerGovernanceReady,
  productionReviewerEvidenceReady,
  realClinicWindowCount,
  sampledClinicOperationCount,
  productionReviewWindowCount,
  secondReviewedProductionCount,
}: ProductionClinicalDecisionSummaryProps) {
  const gates = [
    {
      key: "real-dataset",
      label: "Рабочие данные",
      ready: longitudinalClinicalValidationReady && productionDatasetEvidenceReady,
      detail: productionDatasetEvidenceReady
        ? `${realClinicWindowCount} периодов · ${sampledClinicOperationCount} проверено`
        : "нужно закрыть рабочие данные",
    },
    {
      key: "reviewer-evidence",
      label: "Рабочая проверка",
      ready:
        productionReviewerRollbackEvidenceReady
        && productionReviewerGovernanceReady
        && productionReviewerEvidenceReady,
      detail: productionReviewerEvidenceReady
        ? `${productionReviewWindowCount} периодов · ${secondReviewedProductionCount} повторно`
        : "нужно закрыть проверку врачами",
    },
    {
      key: "clinical-safety",
      label: "Безопасность",
      ready:
        longitudinalClinicalValidationReady
        && productionDatasetEvidenceReady
        && productionReviewerRollbackEvidenceReady
        && productionReviewerGovernanceReady
        && productionReviewerEvidenceReady,
      detail: "вывод о динамике и выдача пациенту выключены",
    },
  ];
  const readyCount = gates.filter((gate) => gate.ready).length;

  return (
    <div
      role="region"
      aria-label="Рабочее решение по истории"
      className="mt-3 rounded-sm border border-border/70 bg-surface-muted px-2.5 py-2.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">Рабочее решение</p>
          <h4 className="mt-1 text-[13px] font-semibold">Что готово по реальным данным</h4>
          <p className="mt-1 text-muted-foreground">
            Только сводные итоги рабочих визитов и проверки врачами. Вывод о динамике и выдача пациенту выключены.
          </p>
        </div>
        <span className="rounded-sm border border-border bg-surface px-2 py-1 text-[12px] font-medium">
          Готово: {readyCount}/{gates.length}
        </span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {gates.map((gate) => (
          <div key={gate.key} className="rounded-sm border border-border bg-surface px-2 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{gate.label}</p>
              <span
                className={
                  gate.ready
                    ? "rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900"
                    : "rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-amber-950"
                }
              >
                {gate.ready ? "готово" : "нужно закрыть"}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{gate.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
