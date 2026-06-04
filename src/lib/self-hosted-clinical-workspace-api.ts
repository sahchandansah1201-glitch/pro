// Stage 5H · Self-hosted clinical workspace API client.
// Production assessment/conclusion/report contracts. No managed runtime coupling.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";
import type { SelfHostedVisitReportDTO, VisitReportPayload } from "@/lib/self-hosted-visit-write-api";

export interface SelfHostedClinicalAssessmentDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  doctorUserId: string | null;
  status: "draft" | "ready" | "signed" | string;
  riskLevel: "low" | "moderate" | "high" | "urgent" | null;
  abcdTotal: number | null;
  sevenPointTotal: number | null;
  summary: string | null;
  recommendation: string | null;
  signedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SelfHostedClinicalConclusionDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  doctorUserId: string | null;
  status: "draft" | "ready" | "signed" | string;
  summary: string | null;
  nextStep: string | null;
  followUpAt: string | null;
  signedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ClinicalAssessmentPayload {
  status?: "draft" | "ready" | "signed";
  riskLevel?: "low" | "moderate" | "high" | "urgent" | null;
  abcdTotal?: number | string | null;
  sevenPointTotal?: number | string | null;
  summary?: string | null;
  recommendation?: string | null;
}

export interface ClinicalConclusionPayload {
  status?: "draft" | "ready" | "signed";
  summary?: string | null;
  nextStep?: string | null;
  followUpAt?: string | null;
}

export type LesionComparisonDraftAction = "retake" | "excluded" | "report_limit";

export interface LesionComparisonDraftPayload {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  action: LesionComparisonDraftAction;
  comparability: "comparable" | "not_comparable";
  reasons: string[];
}

export interface SelfHostedLesionComparisonDraftDTO extends LesionComparisonDraftPayload {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  doctorUserId: string | null;
  patientDeliveryAllowed: false;
  protectedFieldsExposed: false;
  createdAt: string | null;
  updatedAt: string | null;
}

export type CaptureSource = "phone" | "device_bridge" | "file_import" | "camera" | "local_transfer" | "unknown";

export interface AssetCaptureMetadataPayload {
  captureSource: CaptureSource;
  deviceId?: string | null;
  frameWidth?: number | null;
  frameHeight?: number | null;
  qualityScore?: number | null;
  qualityIssues?: string[];
  scaleMarkerDetected: boolean;
  millimetersAvailable: boolean;
  deviceCaptureProfile?: "standard_dermoscopy" | "standard_macro" | "overview" | "unknown";
  lightingProfile?: "polarized" | "non_polarized" | "cross_polarized" | "ambient" | "unknown";
  focusProfile?: "locked" | "auto" | "manual" | "unknown";
  distanceProfile?: "fixed" | "estimated" | "unknown";
  deviceCalibrationStatus?: "valid" | "due_soon" | "expired" | "missing" | "not_applicable" | "unknown";
  deviceCalibrationCheckedAt?: string | null;
  captureProtocolVersion?: "clinic_standard_v1" | "device_standard_v1" | "imported_standard" | "unknown";
  lensProfile?: "dermoscope_contact" | "dermoscope_non_contact" | "macro_lens" | "phone_camera" | "unknown";
  polarizationMode?: "polarized" | "non_polarized" | "cross_polarized" | "not_applicable" | "unknown";
  colorReferenceStatus?: "captured" | "not_required" | "missing" | "unknown";
  deviceClockSyncStatus?: "synced" | "stale" | "missing" | "unknown";
}

export interface SelfHostedAssetCaptureMetadataDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  lesionId: string | null;
  assetId: string;
  captureSource: CaptureSource | string;
  deviceId: string | null;
  frame: { width: number | null; height: number | null };
  quality: { score: number | null; issues: string[] };
  calibration: { scaleMarkerDetected: boolean; millimetersAvailable: boolean };
  deviceEvidence: {
    captureProfile: string;
    lightingProfile: string;
    focusProfile: string;
    distanceProfile: string;
    calibrationStatus: string;
    calibrationCheckedAt: string | null;
    status: "ready" | "needs_review" | "missing";
  };
  deviceBridgeQuality: {
    status: "ready" | "needs_review" | "not_applicable";
    reasons: string[];
  };
  captureProtocol: {
    version: string;
    lensProfile: string;
    polarizationMode: string;
    colorReferenceStatus: string;
    clockSyncStatus: string;
    status: "ready" | "needs_review" | "missing";
  };
  productionAssetReadiness: {
    status: "ready" | "needs_review";
    reasons: string[];
  };
  patientDeliveryAllowed: false;
  protectedFieldsExposed: false;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SelfHostedLesionCaptureMetadataDTO {
  clinicId: string | null;
  patientId: string | null;
  lesionId: string;
  summary: {
    assetCount: number;
    metadataCount: number;
    missingMetadataCount: number;
    readyForTechnicalCompareCount: number;
    scaleReadyCount: number;
    deviceEvidenceReadyCount: number;
    deviceEvidenceReviewCount: number;
    productionAssetReadyCount: number;
    productionAssetReviewCount: number;
    deviceBridgeQualityReadyCount: number;
    deviceBridgeQualityReviewCount: number;
    captureProtocolReadyCount: number;
    captureProtocolReviewCount: number;
  };
  items: Array<{
    assetId: string;
    visitId: string | null;
    kind: string;
    contentType: string | null;
    capturedAt: string | null;
    captureSource: CaptureSource | string;
    deviceId: string | null;
    deviceProfile: string | null;
    frame: { width: number | null; height: number | null };
    quality: { score: number | null; issues: string[] };
    calibration: { scaleMarkerDetected: boolean; millimetersAvailable: boolean };
    deviceEvidence: SelfHostedAssetCaptureMetadataDTO["deviceEvidence"];
    productionAssetReadiness: SelfHostedAssetCaptureMetadataDTO["productionAssetReadiness"];
    deviceBridgeQuality: SelfHostedAssetCaptureMetadataDTO["deviceBridgeQuality"];
    captureProtocol: SelfHostedAssetCaptureMetadataDTO["captureProtocol"];
    technicalStatus: "ready" | "warning" | "missing";
    technicalReasons: string[];
  }>;
  boundaries: {
    patientDeliveryAllowed: false;
    protectedFieldsExposed: false;
    storagePathsExposed: false;
    signedUrlsIssued: false;
    rawImageBytesExposed: false;
    doctorOnlyTextExposed: false;
    clinicalConclusionGenerated: false;
  };
}

export interface LesionComparisonViewerQaPayload {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  technicalMarkers: Array<{ target: "A" | "B"; xPercent: number; yPercent: number }>;
  calibrationStatus: "ready" | "not_ready" | "limited";
  calibrationReasons: string[];
  captureMetadataStatus: "ready" | "needs_review" | "missing";
}

export interface LesionComparisonViewerQaReviewPayload {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  reviewStatus: "technical_ready" | "needs_recapture" | "not_suitable_for_comparison";
  reviewReasons: string[];
}

export interface LesionComparisonViewerQaReviewerWorkflowPayload {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  workflowStatus: "ready_for_reviewer" | "reviewer_accepted" | "reviewer_rejected";
  workflowReasons: string[];
}

export interface LesionComparisonMeasurementPolicyPayload {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  measurementPolicyStatus: "not_approved" | "review_required" | "approved_for_technical_review";
  measurementPolicyReasons: string[];
}

export interface LesionComparisonProductionAnalysisPolicyPayload {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  productionAnalysisPolicyStatus: "not_approved" | "review_required" | "approved_for_production_analysis";
  productionAnalysisPolicyReasons: string[];
}

export interface LesionComparisonReviewerAssignmentPayload {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  assignmentStatus:
    | "unassigned"
    | "assigned"
    | "second_review_required"
    | "second_review_assigned"
    | "second_review_completed"
    | "assignment_blocked";
  assignmentReasons: string[];
  assignedReviewerUserId: string | null;
  secondReviewStatus: "not_required" | "required" | "assigned" | "completed" | "blocked";
  secondReviewReasons: string[];
  secondReviewerUserId: string | null;
}

type LesionComparisonMeasurementPolicyDTO = {
  status: "not_approved" | "review_required" | "approved_for_technical_review";
  reasons: string[];
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  medicalMeasurementAllowed: false;
  patientDeliveryAllowed: false;
  clinicalOutputGenerated: false;
};

type LesionComparisonProductionAnalysisPolicyDTO = {
  status: "not_approved" | "review_required" | "approved_for_production_analysis";
  reasons: string[];
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  medicalMeasurementAllowed: false;
  patientDeliveryAllowed: false;
  clinicalOutputGenerated: false;
};

type LesionComparisonReviewerAssignmentDTO = {
  status:
    | "unassigned"
    | "assigned"
    | "second_review_required"
    | "second_review_assigned"
    | "second_review_completed"
    | "assignment_blocked";
  reasons: string[];
  assignedAt: string | null;
  reviewerIdentityExposed: false;
  patientDeliveryAllowed: false;
  medicalMeasurementAllowed: false;
};

type LesionComparisonSecondReviewDTO = {
  status: "not_required" | "required" | "assigned" | "completed" | "blocked";
  reasons: string[];
  reviewedAt: string | null;
  reviewerIdentityExposed: false;
  patientDeliveryAllowed: false;
  medicalMeasurementAllowed: false;
};

export interface SelfHostedLesionComparisonViewerQaDTO extends LesionComparisonViewerQaPayload {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  doctorUserId: string | null;
  review: {
    status: "unreviewed" | "technical_ready" | "needs_recapture" | "not_suitable_for_comparison";
    reasons: string[];
    reviewedAt: string | null;
    reviewedByUserId: string | null;
  };
  reviewerWorkflow: {
    status: "technical_gate_blocked" | "ready_for_reviewer" | "reviewer_accepted" | "reviewer_rejected";
    reasons: string[];
    reviewedAt: string | null;
    reviewedByUserId: string | null;
    gate: {
      technicalReviewReady: boolean;
      calibrationReady: boolean;
      captureMetadataReady: boolean;
      markerGateReady: boolean;
      measurementPolicyApproved: boolean;
      productionAnalysisPolicyApproved: boolean;
      reviewerAssignmentReady: boolean;
      secondReviewReady: boolean;
      medicalMeasurementAllowed: false;
      patientDeliveryAllowed: false;
      clinicalConclusionGenerated: false;
    };
  };
  measurementPolicy: LesionComparisonMeasurementPolicyDTO;
  productionAnalysisPolicy: LesionComparisonProductionAnalysisPolicyDTO;
  reviewerAssignment: LesionComparisonReviewerAssignmentDTO;
  secondReview: LesionComparisonSecondReviewDTO;
  medicalMeasurementAllowed: false;
  patientDeliveryAllowed: false;
  protectedFieldsExposed: false;
  createdAt: string | null;
  updatedAt: string | null;
}

export type LesionComparisonViewerQaReviewQueueStatus =
  | "actionable"
  | "all"
  | "unreviewed"
  | "technical_ready"
  | "needs_recapture"
  | "not_suitable_for_comparison";

export interface SelfHostedLesionComparisonViewerQaReviewQueueDTO {
  clinicId: string | null;
  patientId: string | null;
  visitId: string;
  filters: {
    status: LesionComparisonViewerQaReviewQueueStatus;
    limit: number;
  };
  summary: {
    total: number;
    unreviewed: number;
    technicalReady: number;
    needsRecapture: number;
    notSuitableForComparison: number;
    measurementPolicyRequired: number;
    productionAnalysisPolicyRequired: number;
    reviewerAssignmentRequired: number;
    secondReviewRequired: number;
    actionable: number;
  };
  items: Array<{
    queueNumber: number;
    lesionId: string;
    lesionLabel: string;
    bodyZone: string | null;
    bodySurface: string | null;
    review: {
      status: "unreviewed" | "technical_ready" | "needs_recapture" | "not_suitable_for_comparison";
      reasons: string[];
      reviewedAt: string | null;
      reviewedByUserId: string | null;
    };
    measurementPolicy: LesionComparisonMeasurementPolicyDTO;
    productionAnalysisPolicy: LesionComparisonProductionAnalysisPolicyDTO;
    reviewerAssignment: LesionComparisonReviewerAssignmentDTO;
    secondReview: LesionComparisonSecondReviewDTO;
    calibrationStatus: string;
    calibrationReasons: string[];
    captureMetadataStatus: string;
    technicalMarkerCount: number;
    updatedAt: string | null;
    nextAction:
      | "review_pair"
      | "request_recapture"
      | "exclude_from_dynamic_review"
      | "approve_measurement_policy"
      | "approve_production_analysis_policy"
      | "assign_reviewer"
      | "complete_second_review"
      | "continue_review";
  }>;
  boundaries: {
    patientDeliveryAllowed: false;
    medicalMeasurementAllowed: false;
    protectedFieldsExposed: false;
    pairKeysExposed: false;
    imageIdsExposed: false;
    clinicalConclusionGenerated: false;
  };
}

export interface SelfHostedLesionLongitudinalHistorySummaryDTO {
  visitCount: number;
  imageCount: number;
  candidatePairCount: number;
  comparablePairCount: number;
  warningPairCount: number;
  blockedPairCount: number;
  assessmentCount: number;
}

export interface SelfHostedLesionLongitudinalHistoryVisitDTO {
  visitId: string;
  startedAt: string | null;
  signedAt: string | null;
  status: string;
  imageCount: number;
  dermoscopyCount: number;
  overviewCount: number;
  assessmentCount: number;
  capturedAtFirst: string | null;
  capturedAtLast: string | null;
}

export interface SelfHostedLesionLongitudinalHistoryPairDTO {
  previousVisitId: string;
  currentVisitId: string;
  previousImageId: string;
  currentImageId: string;
  kind: string;
  status: "ready" | "warning" | "blocked";
  reasons: string[];
}

export interface SelfHostedLesionLongitudinalHistoryDTO {
  clinicId: string | null;
  patientId: string | null;
  lesionId: string;
  label: string | null;
  bodyZone: string | null;
  bodySurface: string | null;
  status: string;
  summary: SelfHostedLesionLongitudinalHistorySummaryDTO;
  visits: SelfHostedLesionLongitudinalHistoryVisitDTO[];
  candidatePairs: SelfHostedLesionLongitudinalHistoryPairDTO[];
  boundaries: {
    patientDeliveryAllowed: false;
    protectedFieldsExposed: false;
    storagePathsExposed: false;
    signedUrlsIssued: false;
    rawImageBytesExposed: false;
    doctorOnlyTextExposed: false;
    clinicalConclusionGenerated: false;
  };
}

export type SelfHostedLesionLongitudinalQaStatus = "blocked" | "needs_review" | "technical_ready";
export type SelfHostedLesionLongitudinalQaAction =
  | "review_queue"
  | "request_recapture"
  | "exclude_from_dynamic_review"
  | "verify_production_asset"
  | "complete_capture_metadata"
  | "complete_device_metadata"
  | "check_device_bridge"
  | "complete_capture_protocol"
  | "complete_calibration"
  | "place_markers"
  | "approve_measurement_policy"
  | "approve_production_analysis_policy"
  | "assign_reviewer"
  | "complete_second_review"
  | "continue_review";

export interface SelfHostedLesionLongitudinalQaDTO {
  clinicId: string | null;
  patientId: string | null;
  lesionId: string;
  label: string | null;
  readiness: {
    status: SelfHostedLesionLongitudinalQaStatus;
    visitCount: number;
    imageCount: number;
    candidatePairCount: number;
    reviewedPairCount: number;
    technicalReadyPairCount: number;
    needsRecaptureCount: number;
    notSuitableForComparisonCount: number;
    unreviewedPairCount: number;
    productionAssetNotReadyCount: number;
    missingCaptureMetadataCount: number;
    deviceEvidenceNotReadyCount: number;
    deviceBridgeQualityNotReadyCount: number;
    captureProtocolNotReadyCount: number;
    calibrationBlockedCount: number;
    markerMissingCount: number;
    measurementPolicyNotReadyCount: number;
    productionAnalysisPolicyNotReadyCount: number;
    reviewerAssignmentNotReadyCount: number;
    secondReviewNotReadyCount: number;
    technicalRolloutReady: boolean;
    dynamicConclusionAllowed: false;
  };
  blockers: Array<{
    code:
      | "no_candidate_pairs"
      | "recapture_required"
      | "not_suitable_for_comparison"
      | "unreviewed_pairs"
      | "production_asset_not_ready"
      | "missing_capture_metadata"
      | "device_metadata_not_ready"
      | "device_bridge_quality_not_ready"
      | "capture_protocol_not_ready"
      | "calibration_not_ready"
      | "technical_markers_missing"
      | "measurement_policy_required"
      | "production_analysis_policy_required"
      | "reviewer_assignment_required"
      | "second_review_required";
    label: string;
    count: number;
    nextAction: SelfHostedLesionLongitudinalQaAction;
  }>;
  nextActions: SelfHostedLesionLongitudinalQaAction[];
  boundaries: {
    patientDeliveryAllowed: false;
    medicalMeasurementAllowed: false;
    protectedFieldsExposed: false;
    pairKeysExposed: false;
    imageIdsExposed: false;
    storagePathsExposed: false;
    signedUrlsIssued: false;
    rawImageBytesExposed: false;
    doctorOnlyTextExposed: false;
    clinicalConclusionGenerated: false;
  };
}

export type SelfHostedVisitLongitudinalDatasetValidationStatus =
  | "blocked"
  | "needs_review"
  | "ready_for_rollout";

export type SelfHostedVisitLongitudinalTimelineRolloutStatus =
  | "not_approved"
  | "review_required"
  | "approved_for_clinical_operations";

export interface VisitLongitudinalTimelineRolloutPayload {
  rolloutStatus: SelfHostedVisitLongitudinalTimelineRolloutStatus;
  rolloutReasons: string[];
}

export interface SelfHostedVisitLongitudinalTimelineRolloutDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  status: SelfHostedVisitLongitudinalTimelineRolloutStatus;
  reasons: string[];
  validationStatus: SelfHostedVisitLongitudinalDatasetValidationStatus;
  lesionCount: number;
  readyTimelineCount: number;
  needsReviewTimelineCount: number;
  blockedTimelineCount: number;
  candidatePairCount: number;
  reviewerWorkflowReadyCount: number;
  patientDeliveryAllowed: false;
  medicalMeasurementAllowed: false;
  protectedFieldsExposed: false;
  clinicalOutputGenerated: false;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SelfHostedVisitLongitudinalDatasetValidationDTO {
  clinicId: string | null;
  patientId: string | null;
  visitId: string;
  readiness: {
    status: SelfHostedVisitLongitudinalDatasetValidationStatus;
    lesionCount: number;
    timelineCandidateCount: number;
    readyTimelineCount: number;
    needsReviewTimelineCount: number;
    blockedTimelineCount: number;
    imageCount: number;
    candidatePairCount: number;
    reviewedPairCount: number;
    technicalReadyPairCount: number;
    productionAssetNotReadyCount: number;
    missingCaptureMetadataCount: number;
    deviceEvidenceNotReadyCount: number;
    deviceBridgeQualityNotReadyCount: number;
    captureProtocolNotReadyCount: number;
    calibrationBlockedCount: number;
    markerMissingCount: number;
    measurementPolicyNotReadyCount: number;
    productionAnalysisPolicyNotReadyCount: number;
    reviewerAssignmentNotReadyCount: number;
    secondReviewNotReadyCount: number;
    reviewerWorkflowReadyCount: number;
    dynamicConclusionAllowed: false;
  };
  items: Array<{
    queueNumber: number;
    lesionId: string;
    lesionLabel: string;
    bodyZone: string | null;
    bodySurface: string | null;
    status: SelfHostedVisitLongitudinalDatasetValidationStatus;
    visitCount: number;
    imageCount: number;
    candidatePairCount: number;
    reviewedPairCount: number;
    technicalReadyPairCount: number;
    productionAssetNotReadyCount: number;
    missingCaptureMetadataCount: number;
    deviceEvidenceNotReadyCount: number;
    deviceBridgeQualityNotReadyCount: number;
    captureProtocolNotReadyCount: number;
    calibrationBlockedCount: number;
    markerMissingCount: number;
    measurementPolicyNotReadyCount: number;
    productionAnalysisPolicyNotReadyCount: number;
    reviewerAssignmentNotReadyCount: number;
    secondReviewNotReadyCount: number;
    reviewerWorkflowReadyCount: number;
    nextAction: SelfHostedLesionLongitudinalQaAction;
  }>;
  blockers: SelfHostedLesionLongitudinalQaDTO["blockers"];
  timelineRollout: SelfHostedVisitLongitudinalTimelineRolloutDTO;
  nextActions: SelfHostedLesionLongitudinalQaAction[];
  boundaries: SelfHostedLesionLongitudinalQaDTO["boundaries"];
}

export const SAFE_LESION_LONGITUDINAL_QA_BOUNDARIES: SelfHostedLesionLongitudinalQaDTO["boundaries"] = {
  patientDeliveryAllowed: false,
  medicalMeasurementAllowed: false,
  protectedFieldsExposed: false,
  pairKeysExposed: false,
  imageIdsExposed: false,
  storagePathsExposed: false,
  signedUrlsIssued: false,
  rawImageBytesExposed: false,
  doctorOnlyTextExposed: false,
  clinicalConclusionGenerated: false,
};

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

interface VisitArgs extends BaseArgs {
  visitId: string;
}

interface PatchAssessmentArgs extends VisitArgs {
  payload: ClinicalAssessmentPayload;
}

interface PatchConclusionArgs extends VisitArgs {
  payload: ClinicalConclusionPayload;
}

interface PatchReportArgs extends VisitArgs {
  payload: VisitReportPayload;
}

interface PatchLesionComparisonDraftArgs extends VisitArgs {
  payload: LesionComparisonDraftPayload;
}

interface PatchAssetCaptureMetadataArgs extends VisitArgs {
  assetId: string;
  payload: AssetCaptureMetadataPayload;
}

interface PatchLesionComparisonViewerQaArgs extends VisitArgs {
  payload: LesionComparisonViewerQaPayload;
}

interface PatchLesionComparisonViewerQaReviewArgs extends VisitArgs {
  payload: LesionComparisonViewerQaReviewPayload;
}

interface PatchLesionComparisonViewerQaReviewerWorkflowArgs extends VisitArgs {
  payload: LesionComparisonViewerQaReviewerWorkflowPayload;
}

interface PatchLesionComparisonMeasurementPolicyArgs extends VisitArgs {
  payload: LesionComparisonMeasurementPolicyPayload;
}

interface PatchLesionComparisonProductionAnalysisPolicyArgs extends VisitArgs {
  payload: LesionComparisonProductionAnalysisPolicyPayload;
}

interface PatchLesionComparisonReviewerAssignmentArgs extends VisitArgs {
  payload: LesionComparisonReviewerAssignmentPayload;
}

interface VisitViewerQaReviewQueueArgs extends VisitArgs {
  status?: LesionComparisonViewerQaReviewQueueStatus;
  limit?: number;
}

interface PatchVisitLongitudinalTimelineRolloutArgs extends VisitArgs {
  payload: VisitLongitudinalTimelineRolloutPayload;
}

interface LesionLongitudinalHistoryArgs extends BaseArgs {
  patientId: string;
  lesionId: string;
}

interface ProtectedLesionImageArgs extends LesionLongitudinalHistoryArgs {
  assetId: string;
}

export interface SelfHostedProtectedLesionImageDTO {
  bytes: Blob;
  contentType: string;
  objectUrl: string | null;
  patientDeliveryAllowed: false;
  signedUrlsIssued: false;
  storagePathsExposed: false;
}

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Self-hosted backend-сессия не подключена.",
};

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function ensureConfigured(args: BaseArgs): SelfHostedApiError | null {
  return args.apiToken ? null : NOT_CONFIGURED;
}

function authHeaders(token: string): HeadersInit {
  return { Accept: "application/json", Authorization: `Bearer ${token}` };
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function apiErrorFromBody(response: Response, body: unknown): SelfHostedApiError {
  const errorBody =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: Record<string, unknown>; correlationId?: unknown })
      : null;
  const error = errorBody?.error;
  const details = Array.isArray(error?.details)
    ? error.details
        .filter(isRecord)
        .map((item) => ({
          field: String(item.field ?? "body"),
          message: String(item.message ?? "Некорректное значение."),
        }))
    : undefined;
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    code: String(error?.code ?? `http_${response.status}`),
    message: String(error?.message ?? `HTTP ${response.status}`),
    correlationId: errorBody?.correlationId ? String(errorBody.correlationId) : undefined,
    details,
  };
}

async function requestJson<T>(
  url: string,
  token: string,
  method: "GET" | "PATCH",
  payload: unknown,
  mapper: (item: Record<string, unknown>) => T,
): Promise<SelfHostedApiResult<T | null>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: method === "GET"
        ? authHeaders(token)
        : { ...authHeaders(token), "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(payload ?? {}),
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к self-hosted backend.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  const item = isRecord(body) && isRecord(body.item) ? body.item : null;
  return ok(item ? mapper(item) : null);
}

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function riskOrNull(value: unknown): SelfHostedClinicalAssessmentDTO["riskLevel"] {
  return value === "low" || value === "moderate" || value === "high" || value === "urgent" ? value : null;
}

function toAssessment(input: Record<string, unknown>): SelfHostedClinicalAssessmentDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    status: String(input.status ?? "draft"),
    riskLevel: riskOrNull(input.riskLevel),
    abcdTotal: numberOrNull(input.abcdTotal),
    sevenPointTotal: numberOrNull(input.sevenPointTotal),
    summary: textOrNull(input.summary),
    recommendation: textOrNull(input.recommendation),
    signedAt: textOrNull(input.signedAt),
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toConclusion(input: Record<string, unknown>): SelfHostedClinicalConclusionDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    status: String(input.status ?? "draft"),
    summary: textOrNull(input.summary),
    nextStep: textOrNull(input.nextStep),
    followUpAt: textOrNull(input.followUpAt),
    signedAt: textOrNull(input.signedAt),
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toReport(input: Record<string, unknown>): SelfHostedVisitReportDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    status: String(input.status ?? "draft"),
    physicianText: textOrNull(input.physicianText),
    patientSafeText: textOrNull(input.patientSafeText),
    signedAt: textOrNull(input.signedAt),
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map(String) : [];
}

function toRecordArray(input: unknown): Record<string, unknown>[] {
  return Array.isArray(input) ? input.filter(isRecord) : [];
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function toLesionComparisonDraft(input: Record<string, unknown>): SelfHostedLesionComparisonDraftDTO {
  const imageIds = toStringArray(input.imageIds).slice(0, 2);
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    lesionId: String(input.lesionId ?? ""),
    pairKey: String(input.pairKey ?? ""),
    imageIds: [
      imageIds[0] ?? "",
      imageIds[1] ?? "",
    ],
    action: String(input.action ?? "retake") as LesionComparisonDraftAction,
    comparability: input.comparability === "comparable" ? "comparable" : "not_comparable",
    reasons: toStringArray(input.reasons),
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toFrame(input: unknown): { width: number | null; height: number | null } {
  const row = isRecord(input) ? input : {};
  return {
    width: numberOrNull(row.width),
    height: numberOrNull(row.height),
  };
}

function toQuality(input: unknown): { score: number | null; issues: string[] } {
  const row = isRecord(input) ? input : {};
  return {
    score: numberOrNull(row.score),
    issues: toStringArray(row.issues),
  };
}

function toCalibration(input: unknown): { scaleMarkerDetected: boolean; millimetersAvailable: boolean } {
  const row = isRecord(input) ? input : {};
  return {
    scaleMarkerDetected: row.scaleMarkerDetected === true,
    millimetersAvailable: row.millimetersAvailable === true,
  };
}

function toDeviceEvidence(input: unknown): SelfHostedAssetCaptureMetadataDTO["deviceEvidence"] {
  const row = isRecord(input) ? input : {};
  const status = row.status === "ready" || row.status === "needs_review" ? row.status : "missing";
  return {
    captureProfile: String(row.captureProfile ?? "unknown"),
    lightingProfile: String(row.lightingProfile ?? "unknown"),
    focusProfile: String(row.focusProfile ?? "unknown"),
    distanceProfile: String(row.distanceProfile ?? "unknown"),
    calibrationStatus: String(row.calibrationStatus ?? "unknown"),
    calibrationCheckedAt: textOrNull(row.calibrationCheckedAt),
    status,
  };
}

function toDeviceBridgeQuality(input: unknown): SelfHostedAssetCaptureMetadataDTO["deviceBridgeQuality"] {
  const row = isRecord(input) ? input : {};
  const status = row.status === "ready" || row.status === "needs_review" ? row.status : "not_applicable";
  return {
    status,
    reasons: toStringArray(row.reasons),
  };
}

function toCaptureProtocol(input: unknown): SelfHostedAssetCaptureMetadataDTO["captureProtocol"] {
  const row = isRecord(input) ? input : {};
  const status = row.status === "ready" || row.status === "needs_review" ? row.status : "missing";
  return {
    version: String(row.version ?? "unknown"),
    lensProfile: String(row.lensProfile ?? "unknown"),
    polarizationMode: String(row.polarizationMode ?? "unknown"),
    colorReferenceStatus: String(row.colorReferenceStatus ?? "unknown"),
    clockSyncStatus: String(row.clockSyncStatus ?? "unknown"),
    status,
  };
}

function toProductionAssetReadiness(input: unknown): SelfHostedAssetCaptureMetadataDTO["productionAssetReadiness"] {
  const row = isRecord(input) ? input : {};
  const status = row.status === "ready" ? "ready" : "needs_review";
  return {
    status,
    reasons: toStringArray(row.reasons),
  };
}

function toAssetCaptureMetadata(input: Record<string, unknown>): SelfHostedAssetCaptureMetadataDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    lesionId: textOrNull(input.lesionId),
    assetId: String(input.assetId ?? ""),
    captureSource: String(input.captureSource ?? "unknown"),
    deviceId: textOrNull(input.deviceId),
    frame: toFrame(input.frame),
    quality: toQuality(input.quality),
    calibration: toCalibration(input.calibration),
    deviceEvidence: toDeviceEvidence(input.deviceEvidence),
    productionAssetReadiness: toProductionAssetReadiness(input.productionAssetReadiness),
    deviceBridgeQuality: toDeviceBridgeQuality(input.deviceBridgeQuality),
    captureProtocol: toCaptureProtocol(input.captureProtocol),
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toCaptureMetadataStatus(value: unknown): "ready" | "warning" | "missing" {
  return value === "ready" || value === "warning" ? value : "missing";
}

function toLesionCaptureMetadata(input: Record<string, unknown>): SelfHostedLesionCaptureMetadataDTO {
  const summary = isRecord(input.summary) ? input.summary : {};
  return {
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    lesionId: String(input.lesionId ?? ""),
    summary: {
      assetCount: numberOrZero(summary.assetCount),
      metadataCount: numberOrZero(summary.metadataCount),
      missingMetadataCount: numberOrZero(summary.missingMetadataCount),
      readyForTechnicalCompareCount: numberOrZero(summary.readyForTechnicalCompareCount),
      scaleReadyCount: numberOrZero(summary.scaleReadyCount),
    deviceEvidenceReadyCount: numberOrZero(summary.deviceEvidenceReadyCount),
    deviceEvidenceReviewCount: numberOrZero(summary.deviceEvidenceReviewCount),
    productionAssetReadyCount: numberOrZero(summary.productionAssetReadyCount),
    productionAssetReviewCount: numberOrZero(summary.productionAssetReviewCount),
    deviceBridgeQualityReadyCount: numberOrZero(summary.deviceBridgeQualityReadyCount),
      deviceBridgeQualityReviewCount: numberOrZero(summary.deviceBridgeQualityReviewCount),
      captureProtocolReadyCount: numberOrZero(summary.captureProtocolReadyCount),
      captureProtocolReviewCount: numberOrZero(summary.captureProtocolReviewCount),
    },
    items: toRecordArray(input.items).map((item) => ({
      assetId: String(item.assetId ?? ""),
      visitId: textOrNull(item.visitId),
      kind: String(item.kind ?? ""),
      contentType: textOrNull(item.contentType),
      capturedAt: textOrNull(item.capturedAt),
      captureSource: String(item.captureSource ?? "unknown"),
      deviceId: textOrNull(item.deviceId),
      deviceProfile: textOrNull(item.deviceProfile),
      frame: toFrame(item.frame),
      quality: toQuality(item.quality),
      calibration: toCalibration(item.calibration),
    deviceEvidence: toDeviceEvidence(item.deviceEvidence),
    productionAssetReadiness: toProductionAssetReadiness(item.productionAssetReadiness),
    deviceBridgeQuality: toDeviceBridgeQuality(item.deviceBridgeQuality),
      captureProtocol: toCaptureProtocol(item.captureProtocol),
      technicalStatus: toCaptureMetadataStatus(item.technicalStatus),
      technicalReasons: toStringArray(item.technicalReasons),
    })),
    boundaries: {
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
      doctorOnlyTextExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

function toViewerQaMarker(input: Record<string, unknown>): LesionComparisonViewerQaPayload["technicalMarkers"][number] {
  return {
    target: input.target === "B" ? "B" : "A",
    xPercent: Number(numberOrNull(input.xPercent) ?? 0),
    yPercent: Number(numberOrNull(input.yPercent) ?? 0),
  };
}

function toViewerQaReviewStatus(
  value: unknown,
): SelfHostedLesionComparisonViewerQaDTO["review"]["status"] {
  return value === "technical_ready" || value === "needs_recapture" || value === "not_suitable_for_comparison"
    ? value
    : "unreviewed";
}

function toViewerQaReviewerWorkflowStatus(
  value: unknown,
): SelfHostedLesionComparisonViewerQaDTO["reviewerWorkflow"]["status"] {
  return value === "ready_for_reviewer" || value === "reviewer_accepted" || value === "reviewer_rejected"
    ? value
    : "technical_gate_blocked";
}

function toMeasurementPolicyStatus(
  value: unknown,
): LesionComparisonMeasurementPolicyDTO["status"] {
  return value === "review_required" || value === "approved_for_technical_review" ? value : "not_approved";
}

function toProductionAnalysisPolicyStatus(
  value: unknown,
): LesionComparisonProductionAnalysisPolicyDTO["status"] {
  return value === "review_required" || value === "approved_for_production_analysis" ? value : "not_approved";
}

function toMeasurementPolicy(input: unknown): LesionComparisonMeasurementPolicyDTO {
  const policy = isRecord(input) ? input : {};
  return {
    status: toMeasurementPolicyStatus(policy.status),
    reasons: toStringArray(policy.reasons),
    reviewedAt: textOrNull(policy.reviewedAt),
    reviewedByUserId: textOrNull(policy.reviewedByUserId),
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    clinicalOutputGenerated: false,
  };
}

function toProductionAnalysisPolicy(input: unknown): LesionComparisonProductionAnalysisPolicyDTO {
  const policy = isRecord(input) ? input : {};
  return {
    status: toProductionAnalysisPolicyStatus(policy.status),
    reasons: toStringArray(policy.reasons),
    reviewedAt: textOrNull(policy.reviewedAt),
    reviewedByUserId: textOrNull(policy.reviewedByUserId),
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    clinicalOutputGenerated: false,
  };
}

function toReviewerAssignmentStatus(value: unknown): LesionComparisonReviewerAssignmentDTO["status"] {
  return value === "assigned"
    || value === "second_review_required"
    || value === "second_review_assigned"
    || value === "second_review_completed"
    || value === "assignment_blocked"
    ? value
    : "unassigned";
}

function toSecondReviewStatus(value: unknown): LesionComparisonSecondReviewDTO["status"] {
  return value === "required" || value === "assigned" || value === "completed" || value === "blocked"
    ? value
    : "not_required";
}

function toReviewerAssignment(input: unknown): LesionComparisonReviewerAssignmentDTO {
  const assignment = isRecord(input) ? input : {};
  return {
    status: toReviewerAssignmentStatus(assignment.status),
    reasons: toStringArray(assignment.reasons),
    assignedAt: textOrNull(assignment.assignedAt),
    reviewerIdentityExposed: false,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
  };
}

function toSecondReview(input: unknown): LesionComparisonSecondReviewDTO {
  const review = isRecord(input) ? input : {};
  return {
    status: toSecondReviewStatus(review.status),
    reasons: toStringArray(review.reasons),
    reviewedAt: textOrNull(review.reviewedAt),
    reviewerIdentityExposed: false,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
  };
}

function toViewerQaReviewerWorkflowGate(
  input: unknown,
): SelfHostedLesionComparisonViewerQaDTO["reviewerWorkflow"]["gate"] {
  const gate = isRecord(input) ? input : {};
  return {
    technicalReviewReady: gate.technicalReviewReady === true,
    calibrationReady: gate.calibrationReady === true,
    captureMetadataReady: gate.captureMetadataReady === true,
    markerGateReady: gate.markerGateReady === true,
    measurementPolicyApproved: gate.measurementPolicyApproved === true,
    productionAnalysisPolicyApproved: gate.productionAnalysisPolicyApproved === true,
    reviewerAssignmentReady: gate.reviewerAssignmentReady === true,
    secondReviewReady: gate.secondReviewReady === true,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    clinicalConclusionGenerated: false,
  };
}

function toLesionComparisonViewerQa(input: Record<string, unknown>): SelfHostedLesionComparisonViewerQaDTO {
  const imageIds = toStringArray(input.imageIds).slice(0, 2);
  const calibrationStatus = String(input.calibrationStatus ?? "not_ready");
  const captureMetadataStatus = String(input.captureMetadataStatus ?? "needs_review");
  const review = isRecord(input.review) ? input.review : {};
  const reviewerWorkflow = isRecord(input.reviewerWorkflow) ? input.reviewerWorkflow : {};
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    lesionId: String(input.lesionId ?? ""),
    pairKey: String(input.pairKey ?? ""),
    imageIds: [
      imageIds[0] ?? "",
      imageIds[1] ?? "",
    ],
    technicalMarkers: toRecordArray(input.technicalMarkers).slice(0, 2).map(toViewerQaMarker),
    calibrationStatus:
      calibrationStatus === "ready" || calibrationStatus === "limited" ? calibrationStatus : "not_ready",
    calibrationReasons: toStringArray(input.calibrationReasons),
    captureMetadataStatus:
      captureMetadataStatus === "ready" || captureMetadataStatus === "missing" ? captureMetadataStatus : "needs_review",
    review: {
      status: toViewerQaReviewStatus(review.status),
      reasons: toStringArray(review.reasons),
      reviewedAt: textOrNull(review.reviewedAt),
      reviewedByUserId: textOrNull(review.reviewedByUserId),
    },
    reviewerWorkflow: {
      status: toViewerQaReviewerWorkflowStatus(reviewerWorkflow.status),
      reasons: toStringArray(reviewerWorkflow.reasons),
      reviewedAt: textOrNull(reviewerWorkflow.reviewedAt),
      reviewedByUserId: textOrNull(reviewerWorkflow.reviewedByUserId),
      gate: toViewerQaReviewerWorkflowGate(reviewerWorkflow.gate),
    },
    measurementPolicy: toMeasurementPolicy(input.measurementPolicy),
    productionAnalysisPolicy: toProductionAnalysisPolicy(input.productionAnalysisPolicy),
    reviewerAssignment: toReviewerAssignment(input.reviewerAssignment),
    secondReview: toSecondReview(input.secondReview),
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toViewerQaReviewQueueStatus(value: unknown): LesionComparisonViewerQaReviewQueueStatus {
  return value === "all"
    || value === "unreviewed"
    || value === "technical_ready"
    || value === "needs_recapture"
    || value === "not_suitable_for_comparison"
    ? value
    : "actionable";
}

function toViewerQaReviewQueueNextAction(
  value: unknown,
): SelfHostedLesionComparisonViewerQaReviewQueueDTO["items"][number]["nextAction"] {
  return value === "request_recapture"
    || value === "exclude_from_dynamic_review"
    || value === "approve_measurement_policy"
    || value === "approve_production_analysis_policy"
    || value === "assign_reviewer"
    || value === "complete_second_review"
    || value === "continue_review"
    ? value
    : "review_pair";
}

function toLesionComparisonViewerQaReviewQueue(
  input: Record<string, unknown>,
): SelfHostedLesionComparisonViewerQaReviewQueueDTO {
  const filters = isRecord(input.filters) ? input.filters : {};
  const summary = isRecord(input.summary) ? input.summary : {};
  return {
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: String(input.visitId ?? ""),
    filters: {
      status: toViewerQaReviewQueueStatus(filters.status),
      limit: numberOrZero(filters.limit) || 20,
    },
    summary: {
      total: numberOrZero(summary.total),
      unreviewed: numberOrZero(summary.unreviewed),
      technicalReady: numberOrZero(summary.technicalReady),
      needsRecapture: numberOrZero(summary.needsRecapture),
      notSuitableForComparison: numberOrZero(summary.notSuitableForComparison),
      measurementPolicyRequired: numberOrZero(summary.measurementPolicyRequired),
      productionAnalysisPolicyRequired: numberOrZero(summary.productionAnalysisPolicyRequired),
      reviewerAssignmentRequired: numberOrZero(summary.reviewerAssignmentRequired),
      secondReviewRequired: numberOrZero(summary.secondReviewRequired),
      actionable: numberOrZero(summary.actionable),
    },
    items: toRecordArray(input.items).map((item) => {
      const review = isRecord(item.review) ? item.review : {};
      const measurementPolicy = isRecord(item.measurementPolicy) ? item.measurementPolicy : {};
      const productionAnalysisPolicy = isRecord(item.productionAnalysisPolicy) ? item.productionAnalysisPolicy : {};
      const reviewerAssignment = isRecord(item.reviewerAssignment) ? item.reviewerAssignment : {};
      const secondReview = isRecord(item.secondReview) ? item.secondReview : {};
      return {
        queueNumber: numberOrZero(item.queueNumber),
        lesionId: String(item.lesionId ?? ""),
        lesionLabel: String(item.lesionLabel ?? item.lesionId ?? ""),
        bodyZone: textOrNull(item.bodyZone),
        bodySurface: textOrNull(item.bodySurface),
        review: {
          status: toViewerQaReviewStatus(review.status),
          reasons: toStringArray(review.reasons),
          reviewedAt: textOrNull(review.reviewedAt),
          reviewedByUserId: textOrNull(review.reviewedByUserId),
        },
        measurementPolicy: toMeasurementPolicy(measurementPolicy),
        productionAnalysisPolicy: toProductionAnalysisPolicy(productionAnalysisPolicy),
        reviewerAssignment: toReviewerAssignment(reviewerAssignment),
        secondReview: toSecondReview(secondReview),
        calibrationStatus: String(item.calibrationStatus ?? "not_ready"),
        calibrationReasons: toStringArray(item.calibrationReasons),
        captureMetadataStatus: String(item.captureMetadataStatus ?? "needs_review"),
        technicalMarkerCount: numberOrZero(item.technicalMarkerCount),
        updatedAt: textOrNull(item.updatedAt),
        nextAction: toViewerQaReviewQueueNextAction(item.nextAction),
      };
    }),
    boundaries: {
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
      protectedFieldsExposed: false,
      pairKeysExposed: false,
      imageIdsExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

function toLongitudinalPairStatus(value: unknown): SelfHostedLesionLongitudinalHistoryPairDTO["status"] {
  return value === "ready" || value === "warning" ? value : "blocked";
}

function toLesionLongitudinalHistory(input: Record<string, unknown>): SelfHostedLesionLongitudinalHistoryDTO {
  const summary = isRecord(input.summary) ? input.summary : {};
  return {
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    lesionId: String(input.lesionId ?? ""),
    label: textOrNull(input.label),
    bodyZone: textOrNull(input.bodyZone),
    bodySurface: textOrNull(input.bodySurface),
    status: String(input.status ?? "active"),
    summary: {
      visitCount: numberOrZero(summary.visitCount),
      imageCount: numberOrZero(summary.imageCount),
      candidatePairCount: numberOrZero(summary.candidatePairCount),
      comparablePairCount: numberOrZero(summary.comparablePairCount),
      warningPairCount: numberOrZero(summary.warningPairCount),
      blockedPairCount: numberOrZero(summary.blockedPairCount),
      assessmentCount: numberOrZero(summary.assessmentCount),
    },
    visits: toRecordArray(input.visits).map((visit) => ({
      visitId: String(visit.visitId ?? ""),
      startedAt: textOrNull(visit.startedAt),
      signedAt: textOrNull(visit.signedAt),
      status: String(visit.status ?? "draft"),
      imageCount: numberOrZero(visit.imageCount),
      dermoscopyCount: numberOrZero(visit.dermoscopyCount),
      overviewCount: numberOrZero(visit.overviewCount),
      assessmentCount: numberOrZero(visit.assessmentCount),
      capturedAtFirst: textOrNull(visit.capturedAtFirst),
      capturedAtLast: textOrNull(visit.capturedAtLast),
    })),
    candidatePairs: toRecordArray(input.candidatePairs).map((pair) => ({
      previousVisitId: String(pair.previousVisitId ?? ""),
      currentVisitId: String(pair.currentVisitId ?? ""),
      previousImageId: String(pair.previousImageId ?? ""),
      currentImageId: String(pair.currentImageId ?? ""),
      kind: String(pair.kind ?? ""),
      status: toLongitudinalPairStatus(pair.status),
      reasons: toStringArray(pair.reasons),
    })),
    boundaries: {
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
      doctorOnlyTextExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

const LONGITUDINAL_QA_BLOCKER_CODES = new Set<SelfHostedLesionLongitudinalQaDTO["blockers"][number]["code"]>([
  "no_candidate_pairs",
  "recapture_required",
  "not_suitable_for_comparison",
  "unreviewed_pairs",
  "production_asset_not_ready",
  "missing_capture_metadata",
  "device_metadata_not_ready",
  "device_bridge_quality_not_ready",
  "capture_protocol_not_ready",
  "calibration_not_ready",
  "technical_markers_missing",
  "measurement_policy_required",
  "production_analysis_policy_required",
  "reviewer_assignment_required",
  "second_review_required",
]);

function toLongitudinalQaStatus(value: unknown): SelfHostedLesionLongitudinalQaStatus {
  return value === "needs_review" || value === "technical_ready" ? value : "blocked";
}

function toLongitudinalQaAction(value: unknown): SelfHostedLesionLongitudinalQaAction | null {
  return value === "review_queue"
    || value === "request_recapture"
    || value === "exclude_from_dynamic_review"
    || value === "verify_production_asset"
    || value === "complete_capture_metadata"
    || value === "complete_device_metadata"
    || value === "check_device_bridge"
    || value === "complete_capture_protocol"
    || value === "complete_calibration"
    || value === "place_markers"
    || value === "approve_measurement_policy"
    || value === "approve_production_analysis_policy"
    || value === "assign_reviewer"
    || value === "complete_second_review"
    || value === "continue_review"
    ? value
    : null;
}

function toLesionLongitudinalQa(input: Record<string, unknown>): SelfHostedLesionLongitudinalQaDTO {
  const readiness = isRecord(input.readiness) ? input.readiness : {};
  const blockers = toRecordArray(input.blockers)
    .map((blocker) => {
      const code = String(blocker.code ?? "") as SelfHostedLesionLongitudinalQaDTO["blockers"][number]["code"];
      const nextAction = toLongitudinalQaAction(blocker.nextAction);
      const count = numberOrZero(blocker.count);
      if (!LONGITUDINAL_QA_BLOCKER_CODES.has(code) || !nextAction || count < 1) return null;
      return {
        code,
        label: String(blocker.label ?? code),
        count,
        nextAction,
      };
    })
    .filter((item): item is SelfHostedLesionLongitudinalQaDTO["blockers"][number] => Boolean(item));
  const nextActions = [
    ...new Set(toStringArray(input.nextActions).map(toLongitudinalQaAction).filter(Boolean)),
  ] as SelfHostedLesionLongitudinalQaAction[];

  return {
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    lesionId: String(input.lesionId ?? ""),
    label: textOrNull(input.label),
    readiness: {
      status: toLongitudinalQaStatus(readiness.status),
      visitCount: numberOrZero(readiness.visitCount),
      imageCount: numberOrZero(readiness.imageCount),
      candidatePairCount: numberOrZero(readiness.candidatePairCount),
      reviewedPairCount: numberOrZero(readiness.reviewedPairCount),
      technicalReadyPairCount: numberOrZero(readiness.technicalReadyPairCount),
      needsRecaptureCount: numberOrZero(readiness.needsRecaptureCount),
      notSuitableForComparisonCount: numberOrZero(readiness.notSuitableForComparisonCount),
      unreviewedPairCount: numberOrZero(readiness.unreviewedPairCount),
      productionAssetNotReadyCount: numberOrZero(readiness.productionAssetNotReadyCount),
      missingCaptureMetadataCount: numberOrZero(readiness.missingCaptureMetadataCount),
      deviceEvidenceNotReadyCount: numberOrZero(readiness.deviceEvidenceNotReadyCount),
      deviceBridgeQualityNotReadyCount: numberOrZero(readiness.deviceBridgeQualityNotReadyCount),
      captureProtocolNotReadyCount: numberOrZero(readiness.captureProtocolNotReadyCount),
      calibrationBlockedCount: numberOrZero(readiness.calibrationBlockedCount),
      markerMissingCount: numberOrZero(readiness.markerMissingCount),
      measurementPolicyNotReadyCount: numberOrZero(readiness.measurementPolicyNotReadyCount),
      productionAnalysisPolicyNotReadyCount: numberOrZero(readiness.productionAnalysisPolicyNotReadyCount),
      reviewerAssignmentNotReadyCount: numberOrZero(readiness.reviewerAssignmentNotReadyCount),
      secondReviewNotReadyCount: numberOrZero(readiness.secondReviewNotReadyCount),
      technicalRolloutReady: readiness.technicalRolloutReady === true,
      dynamicConclusionAllowed: false,
    },
    blockers,
    nextActions,
    boundaries: SAFE_LESION_LONGITUDINAL_QA_BOUNDARIES,
  };
}

function toVisitLongitudinalDatasetValidationStatus(
  value: unknown,
): SelfHostedVisitLongitudinalDatasetValidationStatus {
  return value === "needs_review" || value === "ready_for_rollout" ? value : "blocked";
}

function toVisitLongitudinalTimelineRolloutStatus(
  value: unknown,
): SelfHostedVisitLongitudinalTimelineRolloutStatus {
  return value === "review_required" || value === "approved_for_clinical_operations" ? value : "not_approved";
}

function toVisitLongitudinalTimelineRollout(input: unknown): SelfHostedVisitLongitudinalTimelineRolloutDTO {
  const rollout = isRecord(input) ? input : {};
  return {
    id: String(rollout.id ?? ""),
    clinicId: textOrNull(rollout.clinicId),
    patientId: textOrNull(rollout.patientId),
    visitId: textOrNull(rollout.visitId),
    status: toVisitLongitudinalTimelineRolloutStatus(rollout.status),
    reasons: toStringArray(rollout.reasons),
    validationStatus: toVisitLongitudinalDatasetValidationStatus(rollout.validationStatus),
    lesionCount: numberOrZero(rollout.lesionCount),
    readyTimelineCount: numberOrZero(rollout.readyTimelineCount),
    needsReviewTimelineCount: numberOrZero(rollout.needsReviewTimelineCount),
    blockedTimelineCount: numberOrZero(rollout.blockedTimelineCount),
    candidatePairCount: numberOrZero(rollout.candidatePairCount),
    reviewerWorkflowReadyCount: numberOrZero(rollout.reviewerWorkflowReadyCount),
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: textOrNull(rollout.reviewedAt),
    createdAt: textOrNull(rollout.createdAt),
    updatedAt: textOrNull(rollout.updatedAt),
  };
}

function toVisitLongitudinalDatasetValidation(
  input: Record<string, unknown>,
): SelfHostedVisitLongitudinalDatasetValidationDTO {
  const readiness = isRecord(input.readiness) ? input.readiness : {};
  const blockers = toRecordArray(input.blockers)
    .map((blocker) => {
      const code = String(blocker.code ?? "") as SelfHostedLesionLongitudinalQaDTO["blockers"][number]["code"];
      const nextAction = toLongitudinalQaAction(blocker.nextAction);
      const count = numberOrZero(blocker.count);
      if (!LONGITUDINAL_QA_BLOCKER_CODES.has(code) || !nextAction || count < 1) return null;
      return {
        code,
        label: String(blocker.label ?? code),
        count,
        nextAction,
      };
    })
    .filter((item): item is SelfHostedLesionLongitudinalQaDTO["blockers"][number] => Boolean(item));
  const nextActions = [
    ...new Set(toStringArray(input.nextActions).map(toLongitudinalQaAction).filter(Boolean)),
  ] as SelfHostedLesionLongitudinalQaAction[];

  return {
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: String(input.visitId ?? ""),
    readiness: {
      status: toVisitLongitudinalDatasetValidationStatus(readiness.status),
      lesionCount: numberOrZero(readiness.lesionCount),
      timelineCandidateCount: numberOrZero(readiness.timelineCandidateCount),
      readyTimelineCount: numberOrZero(readiness.readyTimelineCount),
      needsReviewTimelineCount: numberOrZero(readiness.needsReviewTimelineCount),
      blockedTimelineCount: numberOrZero(readiness.blockedTimelineCount),
      imageCount: numberOrZero(readiness.imageCount),
      candidatePairCount: numberOrZero(readiness.candidatePairCount),
      reviewedPairCount: numberOrZero(readiness.reviewedPairCount),
      technicalReadyPairCount: numberOrZero(readiness.technicalReadyPairCount),
      productionAssetNotReadyCount: numberOrZero(readiness.productionAssetNotReadyCount),
      missingCaptureMetadataCount: numberOrZero(readiness.missingCaptureMetadataCount),
      deviceEvidenceNotReadyCount: numberOrZero(readiness.deviceEvidenceNotReadyCount),
      deviceBridgeQualityNotReadyCount: numberOrZero(readiness.deviceBridgeQualityNotReadyCount),
      captureProtocolNotReadyCount: numberOrZero(readiness.captureProtocolNotReadyCount),
      calibrationBlockedCount: numberOrZero(readiness.calibrationBlockedCount),
      markerMissingCount: numberOrZero(readiness.markerMissingCount),
      measurementPolicyNotReadyCount: numberOrZero(readiness.measurementPolicyNotReadyCount),
      productionAnalysisPolicyNotReadyCount: numberOrZero(readiness.productionAnalysisPolicyNotReadyCount),
      reviewerAssignmentNotReadyCount: numberOrZero(readiness.reviewerAssignmentNotReadyCount),
      secondReviewNotReadyCount: numberOrZero(readiness.secondReviewNotReadyCount),
      reviewerWorkflowReadyCount: numberOrZero(readiness.reviewerWorkflowReadyCount),
      dynamicConclusionAllowed: false,
    },
    items: toRecordArray(input.items).map((item) => ({
      queueNumber: numberOrZero(item.queueNumber),
      lesionId: String(item.lesionId ?? ""),
      lesionLabel: String(item.lesionLabel ?? item.lesionId ?? ""),
      bodyZone: textOrNull(item.bodyZone),
      bodySurface: textOrNull(item.bodySurface),
      status: toVisitLongitudinalDatasetValidationStatus(item.status),
      visitCount: numberOrZero(item.visitCount),
      imageCount: numberOrZero(item.imageCount),
      candidatePairCount: numberOrZero(item.candidatePairCount),
      reviewedPairCount: numberOrZero(item.reviewedPairCount),
      technicalReadyPairCount: numberOrZero(item.technicalReadyPairCount),
      productionAssetNotReadyCount: numberOrZero(item.productionAssetNotReadyCount),
      missingCaptureMetadataCount: numberOrZero(item.missingCaptureMetadataCount),
      deviceEvidenceNotReadyCount: numberOrZero(item.deviceEvidenceNotReadyCount),
      deviceBridgeQualityNotReadyCount: numberOrZero(item.deviceBridgeQualityNotReadyCount),
      captureProtocolNotReadyCount: numberOrZero(item.captureProtocolNotReadyCount),
      calibrationBlockedCount: numberOrZero(item.calibrationBlockedCount),
      markerMissingCount: numberOrZero(item.markerMissingCount),
      measurementPolicyNotReadyCount: numberOrZero(item.measurementPolicyNotReadyCount),
      productionAnalysisPolicyNotReadyCount: numberOrZero(item.productionAnalysisPolicyNotReadyCount),
      reviewerAssignmentNotReadyCount: numberOrZero(item.reviewerAssignmentNotReadyCount),
      secondReviewNotReadyCount: numberOrZero(item.secondReviewNotReadyCount),
      reviewerWorkflowReadyCount: numberOrZero(item.reviewerWorkflowReadyCount),
      nextAction: toLongitudinalQaAction(item.nextAction) ?? "review_queue",
    })),
    blockers,
    timelineRollout: toVisitLongitudinalTimelineRollout(input.timelineRollout),
    nextActions,
    boundaries: SAFE_LESION_LONGITUDINAL_QA_BOUNDARIES,
  };
}

function visitUrl(apiBaseUrl: string | null | undefined, visitId: string, suffix: string): string {
  return buildSelfHostedApiUrl(apiBaseUrl, `/api/v1/visits/${encodeURIComponent(visitId)}${suffix}`);
}

function visitViewerQaReviewQueueUrl(
  apiBaseUrl: string | null | undefined,
  visitId: string,
  status: LesionComparisonViewerQaReviewQueueStatus = "actionable",
  limit = 20,
): string {
  const base = visitUrl(apiBaseUrl, visitId, "/lesion-comparison-viewer-qa/review-queue");
  const query = new URLSearchParams({ status, limit: String(limit) });
  return `${base}?${query.toString()}`;
}

function patientLesionUrl(
  apiBaseUrl: string | null | undefined,
  patientId: string,
  lesionId: string,
  suffix: string,
): string {
  return buildSelfHostedApiUrl(
    apiBaseUrl,
    `/api/v1/patients/${encodeURIComponent(patientId)}/lesions/${encodeURIComponent(lesionId)}${suffix}`,
  );
}

function protectedLesionImageUrl(
  apiBaseUrl: string | null | undefined,
  patientId: string,
  lesionId: string,
  assetId: string,
): string {
  return buildSelfHostedApiUrl(
    apiBaseUrl,
    `/api/v1/patients/${encodeURIComponent(patientId)}/lesions/${encodeURIComponent(lesionId)}/images/${encodeURIComponent(assetId)}/render`,
  );
}

function assetCaptureMetadataUrl(
  apiBaseUrl: string | null | undefined,
  visitId: string,
  assetId: string,
): string {
  return buildSelfHostedApiUrl(
    apiBaseUrl,
    `/api/v1/visits/${encodeURIComponent(visitId)}/assets/${encodeURIComponent(assetId)}/capture-metadata`,
  );
}

export async function getSelfHostedVisitAssessment(
  args: VisitArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalAssessmentDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/assessment"), args.apiToken as string, "GET", null, toAssessment);
}

export async function updateSelfHostedVisitAssessment(
  args: PatchAssessmentArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalAssessmentDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/assessment"), args.apiToken as string, "PATCH", args.payload, toAssessment);
}

export async function getSelfHostedVisitConclusion(
  args: VisitArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalConclusionDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/conclusion"), args.apiToken as string, "GET", null, toConclusion);
}

export async function updateSelfHostedVisitConclusion(
  args: PatchConclusionArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalConclusionDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/conclusion"), args.apiToken as string, "PATCH", args.payload, toConclusion);
}

export async function getSelfHostedVisitReport(
  args: VisitArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitReportDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/report"), args.apiToken as string, "GET", null, toReport);
}

export async function updateSelfHostedVisitReportContract(
  args: PatchReportArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitReportDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/report"), args.apiToken as string, "PATCH", args.payload, toReport);
}

export async function saveSelfHostedLesionComparisonDraft(
  args: PatchLesionComparisonDraftArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonDraftDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/lesion-comparison-draft"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesionComparisonDraft,
  );
}

export async function saveSelfHostedAssetCaptureMetadata(
  args: PatchAssetCaptureMetadataArgs,
): Promise<SelfHostedApiResult<SelfHostedAssetCaptureMetadataDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    assetCaptureMetadataUrl(args.apiBaseUrl, args.visitId, args.assetId),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toAssetCaptureMetadata,
  );
}

export async function saveSelfHostedLesionComparisonViewerQa(
  args: PatchLesionComparisonViewerQaArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonViewerQaDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/lesion-comparison-viewer-qa"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesionComparisonViewerQa,
  );
}

export async function reviewSelfHostedLesionComparisonViewerQa(
  args: PatchLesionComparisonViewerQaReviewArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonViewerQaDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/lesion-comparison-viewer-qa/review"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesionComparisonViewerQa,
  );
}

export async function reviewSelfHostedLesionComparisonViewerQaReviewerWorkflow(
  args: PatchLesionComparisonViewerQaReviewerWorkflowArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonViewerQaDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/lesion-comparison-viewer-qa/reviewer-workflow"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesionComparisonViewerQa,
  );
}

export async function reviewSelfHostedLesionComparisonMeasurementPolicy(
  args: PatchLesionComparisonMeasurementPolicyArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonViewerQaDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/lesion-comparison-viewer-qa/measurement-policy"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesionComparisonViewerQa,
  );
}

export async function reviewSelfHostedLesionComparisonProductionAnalysisPolicy(
  args: PatchLesionComparisonProductionAnalysisPolicyArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonViewerQaDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/lesion-comparison-viewer-qa/production-analysis-policy"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesionComparisonViewerQa,
  );
}

export async function reviewSelfHostedLesionComparisonReviewerAssignment(
  args: PatchLesionComparisonReviewerAssignmentArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonViewerQaDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/lesion-comparison-viewer-qa/reviewer-assignment"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesionComparisonViewerQa,
  );
}

export async function getSelfHostedVisitLesionComparisonViewerQaReviewQueue(
  args: VisitViewerQaReviewQueueArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonViewerQaReviewQueueDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitViewerQaReviewQueueUrl(args.apiBaseUrl, args.visitId, args.status ?? "actionable", args.limit ?? 20),
    args.apiToken as string,
    "GET",
    null,
    toLesionComparisonViewerQaReviewQueue,
  );
}

export async function getSelfHostedVisitLongitudinalDatasetValidation(
  args: VisitArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitLongitudinalDatasetValidationDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/longitudinal-dataset-validation"),
    args.apiToken as string,
    "GET",
    null,
    toVisitLongitudinalDatasetValidation,
  );
}

export async function reviewSelfHostedVisitLongitudinalTimelineRollout(
  args: PatchVisitLongitudinalTimelineRolloutArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitLongitudinalTimelineRolloutDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/longitudinal-timeline-rollout"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toVisitLongitudinalTimelineRollout,
  );
}

export async function getSelfHostedLesionLongitudinalHistory(
  args: LesionLongitudinalHistoryArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionLongitudinalHistoryDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    patientLesionUrl(args.apiBaseUrl, args.patientId, args.lesionId, "/longitudinal-history"),
    args.apiToken as string,
    "GET",
    null,
    toLesionLongitudinalHistory,
  );
}

export async function getSelfHostedLesionLongitudinalQa(
  args: LesionLongitudinalHistoryArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionLongitudinalQaDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    patientLesionUrl(args.apiBaseUrl, args.patientId, args.lesionId, "/longitudinal-qa"),
    args.apiToken as string,
    "GET",
    null,
    toLesionLongitudinalQa,
  );
}

export async function getSelfHostedLesionCaptureMetadata(
  args: LesionLongitudinalHistoryArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionCaptureMetadataDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    patientLesionUrl(args.apiBaseUrl, args.patientId, args.lesionId, "/capture-metadata"),
    args.apiToken as string,
    "GET",
    null,
    toLesionCaptureMetadata,
  );
}

export async function downloadSelfHostedProtectedLesionImage(
  args: ProtectedLesionImageArgs,
): Promise<SelfHostedApiResult<SelfHostedProtectedLesionImageDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  let response: Response;
  try {
    response = await fetch(
      protectedLesionImageUrl(args.apiBaseUrl, args.patientId, args.lesionId, args.assetId),
      {
        method: "GET",
        headers: authHeaders(args.apiToken as string),
        credentials: "include",
      },
    );
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к self-hosted backend.",
    });
  }
  if (!response.ok) {
    const body = await parseJsonSafe(response);
    return fail(apiErrorFromBody(response, body));
  }
  const bytes = await response.blob();
  return ok({
    bytes,
    contentType: response.headers.get("content-type") || bytes.type || "application/octet-stream",
    objectUrl: null,
    patientDeliveryAllowed: false,
    signedUrlsIssued: false,
    storagePathsExposed: false,
  });
}
