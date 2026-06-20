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
  rollbackReadyProductionCount: number;
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

type ProductionReviewerRollbackEvidenceSource = {
  productionReviewWindowCount: number;
  rollbackDrillProductionCount: number;
  rollbackReadyProductionCount: number;
  rollbackExceptionCount: number;
};

type BoundaryFlagSource = {
  patientDeliveryAllowed: boolean;
  medicalMeasurementAllowed: boolean;
  protectedFieldsExposed: boolean;
  clinicalOutputGenerated: boolean;
};

type LongitudinalClinicalValidationDecisionSource = BoundaryFlagSource & {
  status: string;
  realOutcomeWindowCount: number;
  governanceReviewCount: number;
  unresolvedConsensusCaseCount: number;
  blockerCount: number;
};

type ProductionDatasetEvidenceDecisionSource = BoundaryFlagSource & {
  status: string;
  realClinicWindowCount: number;
  monitoredClinicOperationCount: number;
  sampledClinicOperationCount: number;
  longitudinalFollowupCount: number;
  protectedReviewerLinkedCount: number;
  observedOutcomeCount: number;
  incidentLinkedCount: number;
  unresolvedProductionDatasetEvidenceCount: number;
  blockerCount: number;
};

type ProductionReviewerRollbackEvidenceDecisionSource = ProductionReviewerRollbackEvidenceSource & BoundaryFlagSource & {
  status: string;
  unresolvedRollbackEvidenceCount: number;
  blockerCount: number;
};

type ProductionReviewerGovernanceDecisionSource = ProductionReviewerEvidenceSource & BoundaryFlagSource & {
  status: string;
  unresolvedProductionReviewerGovernanceCount: number;
  blockerCount: number;
};

type ProductionReviewerEvidenceDecisionSource = ProductionReviewerEvidenceSource & BoundaryFlagSource & {
  status: string;
  unresolvedProductionReviewerEvidenceCount: number;
  blockerCount: number;
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

function boundaryFlagsClear(source: BoundaryFlagSource): boolean {
  return (
    source.patientDeliveryAllowed === false
    && source.medicalMeasurementAllowed === false
    && source.protectedFieldsExposed === false
    && source.clinicalOutputGenerated === false
  );
}

function noOpenWork(...values: Array<number | null | undefined>): boolean {
  return values.every((value) => positiveCount(value) === 0);
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

export function buildProductionReviewerRollbackEvidenceCounts(
  source: ProductionReviewerRollbackEvidenceSource,
) {
  const ready = hasPositiveCounts(
    source.productionReviewWindowCount,
    source.rollbackDrillProductionCount,
    source.rollbackReadyProductionCount,
  );
  if (!ready) {
    return {
      ready: false,
      productionReviewWindowCount: 0,
      rollbackDrillProductionCount: 0,
      rollbackReadyProductionCount: 0,
      rollbackExceptionCount: 0,
    };
  }

  const productionReviewWindowCount = positiveCount(source.productionReviewWindowCount);
  const rollbackDrillProductionCount = positiveMin(source.rollbackDrillProductionCount, productionReviewWindowCount);
  const rollbackReadyProductionCount = positiveMin(source.rollbackReadyProductionCount, rollbackDrillProductionCount);
  const rollbackExceptionCount = Math.min(positiveCount(source.rollbackExceptionCount), productionReviewWindowCount);

  return {
    ready,
    productionReviewWindowCount,
    rollbackDrillProductionCount,
    rollbackReadyProductionCount,
    rollbackExceptionCount,
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
    source.rollbackReadyProductionCount,
  );
  if (!ready) return EMPTY_PRODUCTION_REVIEWER_COUNTS;

  const productionReviewWindowCount = positiveCount(source.realClinicWindowCount);
  const assignedProductionReviewerCount = positiveMin(source.protectedReviewerLinkedCount, productionReviewWindowCount);
  const secondReviewedProductionCount = positiveMin(source.sampledClinicOperationCount, assignedProductionReviewerCount);
  const adjudicatedProductionReviewCount = positiveMin(source.protectedReviewerLinkedCount, secondReviewedProductionCount);
  const followupClosedProductionCount = positiveMin(source.longitudinalFollowupCount, productionReviewWindowCount);
  const exceptionClosedProductionCount = positiveMin(source.incidentLinkedCount, productionReviewWindowCount);
  const rollbackReadyProductionCount = positiveMin(
    source.rollbackReadyProductionCount,
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

export function isLongitudinalClinicalValidationDecisionReady(
  source: LongitudinalClinicalValidationDecisionSource,
): boolean {
  const counts = buildLongitudinalClinicalValidationCounts({
    followupWindowCount: source.realOutcomeWindowCount,
    observedTimelineCount: source.realOutcomeWindowCount,
    governanceReviewCount: source.governanceReviewCount,
  });
  return (
    source.status === "ready_for_longitudinal_clinical_validation"
    && counts.ready
    && noOpenWork(source.unresolvedConsensusCaseCount, source.blockerCount)
    && boundaryFlagsClear(source)
  );
}

export function isProductionDatasetEvidenceDecisionReady(
  source: ProductionDatasetEvidenceDecisionSource,
): boolean {
  return (
    source.status === "ready_for_production_dataset_evidence"
    && hasPositiveCounts(
      source.realClinicWindowCount,
      source.monitoredClinicOperationCount,
      source.sampledClinicOperationCount,
      source.longitudinalFollowupCount,
      source.protectedReviewerLinkedCount,
      source.observedOutcomeCount,
      source.incidentLinkedCount,
    )
    && noOpenWork(source.unresolvedProductionDatasetEvidenceCount, source.blockerCount)
    && boundaryFlagsClear(source)
  );
}

export function isProductionReviewerRollbackEvidenceDecisionReady(
  source: ProductionReviewerRollbackEvidenceDecisionSource,
): boolean {
  return (
    source.status === "ready_for_production_reviewer_rollback_evidence"
    && buildProductionReviewerRollbackEvidenceCounts(source).ready
    && noOpenWork(source.unresolvedRollbackEvidenceCount, source.blockerCount)
    && boundaryFlagsClear(source)
  );
}

export function isProductionReviewerGovernanceDecisionReady(
  source: ProductionReviewerGovernanceDecisionSource,
): boolean {
  return (
    source.status === "ready_for_production_reviewer_governance"
    && buildProductionReviewerEvidenceCounts(source).ready
    && noOpenWork(source.unresolvedProductionReviewerGovernanceCount, source.blockerCount)
    && boundaryFlagsClear(source)
  );
}

export function isProductionReviewerEvidenceDecisionReady(
  source: ProductionReviewerEvidenceDecisionSource,
): boolean {
  return (
    source.status === "ready_for_production_reviewer_evidence"
    && buildProductionReviewerEvidenceCounts(source).ready
    && noOpenWork(source.unresolvedProductionReviewerEvidenceCount, source.blockerCount)
    && boundaryFlagsClear(source)
  );
}
