type LongitudinalClinicalValidationSource = {
  followupWindowCount: number;
  observedTimelineCount: number;
  governanceReviewCount: number;
};

type ProductionDatasetEvidenceSource = {
  protectedReviewWindowCount: number;
  monitoredProtectedReviewCount: number;
  sampledProtectedReviewCount: number;
  followupClosedProtectedCount: number;
  adjudicatedProtectedEvidenceCount: number;
  archivedProtectedReviewCount: number;
  rollbackDrillProtectedCount: number;
};

type ProductionReviewerGovernanceSource = {
  realClinicWindowCount: number;
  protectedReviewerLinkedCount: number;
  sampledClinicOperationCount: number;
  longitudinalFollowupCount: number;
  incidentLinkedCount: number;
};

type ProductionReviewerEvidenceSource = {
  productionReviewWindowCount: number;
  assignedProductionReviewerCount: number;
  secondReviewedProductionCount: number;
  adjudicatedProductionReviewCount: number;
  followupClosedProductionCount: number;
  exceptionClosedProductionCount: number;
  rollbackReadyProductionCount: number;
};

function positiveCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function hasPositiveCounts(...values: Array<number | null | undefined>): boolean {
  return values.every((value) => positiveCount(value) > 0);
}

function positiveMin(...values: Array<number | null | undefined>): number {
  return hasPositiveCounts(...values) ? Math.min(...values.map(positiveCount)) : 0;
}

export const EMPTY_LONGITUDINAL_CLINICAL_VALIDATION_COUNTS = {
  ready: false,
  realOutcomeWindowCount: 0,
  governanceReviewCount: 0,
};

export const EMPTY_PRODUCTION_DATASET_EVIDENCE_COUNTS = {
  ready: false,
  realClinicWindowCount: 0,
  monitoredClinicOperationCount: 0,
  sampledClinicOperationCount: 0,
  longitudinalFollowupCount: 0,
  protectedReviewerLinkedCount: 0,
  observedOutcomeCount: 0,
  incidentLinkedCount: 0,
};

export const EMPTY_PRODUCTION_REVIEWER_COUNTS = {
  ready: false,
  productionReviewWindowCount: 0,
  assignedProductionReviewerCount: 0,
  secondReviewedProductionCount: 0,
  adjudicatedProductionReviewCount: 0,
  followupClosedProductionCount: 0,
  exceptionClosedProductionCount: 0,
  rollbackReadyProductionCount: 0,
};

const PENDING_REAL_PRODUCTION_ROLLBACK_EVIDENCE_COUNT = 0;

export function buildLongitudinalClinicalValidationCounts(
  source: LongitudinalClinicalValidationSource,
) {
  const realOutcomeWindowCount =
    positiveCount(source.followupWindowCount) || positiveCount(source.observedTimelineCount);
  const governanceReviewCount = positiveCount(source.governanceReviewCount);
  const ready = realOutcomeWindowCount > 0 && governanceReviewCount > 0;
  return ready
    ? { ready, realOutcomeWindowCount, governanceReviewCount }
    : EMPTY_LONGITUDINAL_CLINICAL_VALIDATION_COUNTS;
}

export function buildProductionDatasetEvidenceCounts(source: ProductionDatasetEvidenceSource) {
  const ready = hasPositiveCounts(
    source.protectedReviewWindowCount,
    source.monitoredProtectedReviewCount,
    source.sampledProtectedReviewCount,
    source.followupClosedProtectedCount,
    source.adjudicatedProtectedEvidenceCount,
    source.archivedProtectedReviewCount,
    source.rollbackDrillProtectedCount,
  );
  if (!ready) return EMPTY_PRODUCTION_DATASET_EVIDENCE_COUNTS;

  const realClinicWindowCount = positiveCount(source.protectedReviewWindowCount);
  const monitoredClinicOperationCount = positiveMin(source.monitoredProtectedReviewCount, realClinicWindowCount);
  const sampledClinicOperationCount = positiveMin(source.sampledProtectedReviewCount, monitoredClinicOperationCount);
  const longitudinalFollowupCount = positiveMin(source.followupClosedProtectedCount, sampledClinicOperationCount);
  const protectedReviewerLinkedCount = positiveMin(source.adjudicatedProtectedEvidenceCount, monitoredClinicOperationCount);
  const observedOutcomeCount = positiveMin(source.archivedProtectedReviewCount, monitoredClinicOperationCount);
  const incidentLinkedCount = positiveMin(source.rollbackDrillProtectedCount, observedOutcomeCount);

  return {
    ready,
    realClinicWindowCount,
    monitoredClinicOperationCount,
    sampledClinicOperationCount,
    longitudinalFollowupCount,
    protectedReviewerLinkedCount,
    observedOutcomeCount,
    incidentLinkedCount,
  };
}

export function buildProductionReviewerGovernanceCounts(source: ProductionReviewerGovernanceSource) {
  const ready = hasPositiveCounts(
    source.realClinicWindowCount,
    source.protectedReviewerLinkedCount,
    source.sampledClinicOperationCount,
    source.protectedReviewerLinkedCount,
    source.longitudinalFollowupCount,
    source.incidentLinkedCount,
    PENDING_REAL_PRODUCTION_ROLLBACK_EVIDENCE_COUNT,
  );
  if (!ready) return EMPTY_PRODUCTION_REVIEWER_COUNTS;

  const productionReviewWindowCount = positiveCount(source.realClinicWindowCount);
  const assignedProductionReviewerCount = positiveMin(source.protectedReviewerLinkedCount, productionReviewWindowCount);
  const secondReviewedProductionCount = positiveMin(source.sampledClinicOperationCount, assignedProductionReviewerCount);
  const adjudicatedProductionReviewCount = positiveMin(source.protectedReviewerLinkedCount, secondReviewedProductionCount);
  const followupClosedProductionCount = positiveMin(source.longitudinalFollowupCount, productionReviewWindowCount);
  const exceptionClosedProductionCount = positiveMin(source.incidentLinkedCount, productionReviewWindowCount);
  const rollbackReadyProductionCount = positiveMin(
    PENDING_REAL_PRODUCTION_ROLLBACK_EVIDENCE_COUNT,
    productionReviewWindowCount,
  );

  return {
    ready,
    productionReviewWindowCount,
    assignedProductionReviewerCount,
    secondReviewedProductionCount,
    adjudicatedProductionReviewCount,
    followupClosedProductionCount,
    exceptionClosedProductionCount,
    rollbackReadyProductionCount,
  };
}

export function buildProductionReviewerEvidenceCounts(source: ProductionReviewerEvidenceSource) {
  const ready = hasPositiveCounts(
    source.productionReviewWindowCount,
    source.assignedProductionReviewerCount,
    source.secondReviewedProductionCount,
    source.adjudicatedProductionReviewCount,
    source.followupClosedProductionCount,
    source.exceptionClosedProductionCount,
    source.rollbackReadyProductionCount,
  );
  if (!ready) return EMPTY_PRODUCTION_REVIEWER_COUNTS;

  const productionReviewWindowCount = positiveCount(source.productionReviewWindowCount);
  const assignedProductionReviewerCount = positiveMin(source.assignedProductionReviewerCount, productionReviewWindowCount);
  const secondReviewedProductionCount = positiveMin(source.secondReviewedProductionCount, assignedProductionReviewerCount);
  const adjudicatedProductionReviewCount = positiveMin(
    source.adjudicatedProductionReviewCount,
    secondReviewedProductionCount,
  );
  const followupClosedProductionCount = positiveMin(source.followupClosedProductionCount, productionReviewWindowCount);
  const exceptionClosedProductionCount = positiveMin(source.exceptionClosedProductionCount, productionReviewWindowCount);
  const rollbackReadyProductionCount = positiveMin(source.rollbackReadyProductionCount, productionReviewWindowCount);

  return {
    ready,
    productionReviewWindowCount,
    assignedProductionReviewerCount,
    secondReviewedProductionCount,
    adjudicatedProductionReviewCount,
    followupClosedProductionCount,
    exceptionClosedProductionCount,
    rollbackReadyProductionCount,
  };
}
