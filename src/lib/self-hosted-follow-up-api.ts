// Stage 17A-17Z · self-hosted follow-up communication API client.
// Production UI uses only /api/v1/* on the operator-owned backend.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export type FollowUpPriority = "low" | "normal" | "high" | "urgent";
export type FollowUpStatus = "planned" | "in_progress" | "sent" | "acknowledged" | "completed" | "cancelled";
export type FollowUpTriageState = "new" | "queued" | "in_review" | "waiting_patient" | "escalated" | "resolved" | "blocked";
export type FollowUpEscalationLevel = "none" | "watch" | "clinic_admin" | "urgent";
export type FollowUpDeliveryState = "not_required" | "pending" | "delivered" | "failed" | "deferred";
export type FollowUpResolutionOutcome =
  | "not_reviewed"
  | "patient_reached"
  | "patient_unreachable"
  | "clinical_escalation"
  | "administrative_close";
export type FollowUpQualityReviewState = "pending" | "reviewed" | "needs_attention";
export type FollowUpRetentionReviewState = "not_due" | "due" | "reviewed" | "archived";
export type FollowUpClinicReviewState = "not_scheduled" | "scheduled" | "completed" | "needs_policy_review";
export type FollowUpSopValidationState = "not_required" | "required" | "validated" | "exception" | "blocked";
export type FollowUpSopPolicyDriftState = "not_checked" | "in_sync" | "drifted" | "missing_template" | "review_required";
export type FollowUpSopPolicyExceptionState = "none" | "open" | "accepted" | "rejected" | "closed";
export type FollowUpSopPolicyAuditState = "not_started" | "ready" | "reviewed" | "needs_followup";
export type FollowUpSopPolicyGovernanceState = "not_started" | "ready" | "reviewed" | "needs_followup";
export type FollowUpSopPolicyGovernanceClosureState = "not_started" | "ready" | "closed" | "needs_followup";
export type FollowUpSopPolicyGovernanceEvidenceState = "not_started" | "ready" | "exported" | "needs_followup";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationState = "not_started" | "ready" | "reconciled" | "mismatch" | "needs_followup";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureState = "not_started" | "ready" | "closed" | "closure_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptState = "not_started" | "ready" | "received" | "receipt_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState = "not_started" | "ready" | "archived" | "archive_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState = "not_started" | "ready" | "closed" | "closure_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState = "not_started" | "ready" | "received" | "receipt_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState = "not_started" | "ready" | "handed_off" | "handoff_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState = "not_started" | "ready" | "received" | "receipt_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState = "not_started" | "ready" | "reconciled" | "reconciliation_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState = "not_started" | "ready" | "closed" | "closure_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState = "not_started" | "ready" | "received" | "receipt_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState = "not_started" | "ready" | "archived" | "archive_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState = "not_started" | "ready" | "closed" | "closure_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState = "not_started" | "ready" | "received" | "receipt_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState = "not_started" | "ready" | "handed_off" | "handoff_exception" | "needs_rework";
export type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState = "not_started" | "ready" | "received" | "receipt_exception" | "needs_rework";

export interface SelfHostedFollowUpMessage {
  id: string;
  followUpId: string;
  senderRole: string;
  direction: string;
  channel: string;
  deliveryState: string;
  patientVisible: boolean;
  body: string | null;
  createdAt: string | null;
}

export interface SelfHostedClinicalFollowUp {
  id: string;
  clinicId?: string | null;
  patientId?: string | null;
  visitId: string | null;
  dueAt: string | null;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  reason: string | null;
  patientSummary: string | null;
  internalNote?: string | null;
  triageState: FollowUpTriageState;
  escalationLevel: FollowUpEscalationLevel;
  slaDueAt: string | null;
  deliveryState: FollowUpDeliveryState;
  deliveryAttempts: number;
  lastDeliveryAttemptAt: string | null;
  deliveryEvidence: Record<string, unknown>;
  operationsNote?: string | null;
  resolutionOutcome: FollowUpResolutionOutcome;
  qualityReviewState: FollowUpQualityReviewState;
  qualityReviewNote?: string | null;
  qualityReviewedAt?: string | null;
  retentionReviewState: FollowUpRetentionReviewState;
  retentionReviewNote?: string | null;
  retentionReviewedAt?: string | null;
  clinicReviewState: FollowUpClinicReviewState;
  clinicReviewNote?: string | null;
  clinicReviewedAt?: string | null;
  sopValidationState: FollowUpSopValidationState;
  sopPolicyVersion?: string | null;
  sopPolicyTemplateId?: string | null;
  sopPolicyTemplateCode?: string | null;
  sopPolicyDriftState: FollowUpSopPolicyDriftState;
  sopPolicyDriftReason?: string | null;
  sopPolicyAppliedAt?: string | null;
  sopPolicyDriftReviewedAt?: string | null;
  sopPolicyExceptionState: FollowUpSopPolicyExceptionState;
  sopPolicyExceptionReason?: string | null;
  sopPolicyExceptionResolution?: string | null;
  sopPolicyExceptionClosedAt?: string | null;
  sopPolicyAuditState: FollowUpSopPolicyAuditState;
  sopPolicyAuditNote?: string | null;
  sopPolicyAuditReviewedAt?: string | null;
  sopPolicyGovernanceState: FollowUpSopPolicyGovernanceState;
  sopPolicyGovernanceNote?: string | null;
  sopPolicyGovernanceReviewedAt?: string | null;
  sopPolicyGovernanceClosureState: FollowUpSopPolicyGovernanceClosureState;
  sopPolicyGovernanceClosureNote?: string | null;
  sopPolicyGovernanceClosedAt?: string | null;
  sopPolicyGovernanceEvidenceState: FollowUpSopPolicyGovernanceEvidenceState;
  sopPolicyGovernanceEvidenceNote?: string | null;
  sopPolicyGovernanceEvidenceReviewedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationState: FollowUpSopPolicyGovernanceEvidenceReconciliationState;
  sopPolicyGovernanceEvidenceReconciliationNote?: string | null;
  sopPolicyGovernanceEvidenceReconciledAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureState;
  sopPolicyGovernanceEvidenceReconciliationClosureNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceivedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceivedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandedOffAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceivedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciledAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceivedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceivedAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandedOffAt?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote?: string | null;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceivedAt?: string | null;
  sopExceptionReason?: string | null;
  sopValidatedAt?: string | null;
  resolvedAt?: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  patient?: {
    id?: string | null;
    code?: string | null;
    fullName?: string | null;
  };
  latestMessage: SelfHostedFollowUpMessage | null;
  messageCount: number;
}

export interface CreateFollowUpPayload {
  dueAt: string;
  reason: string;
  priority?: FollowUpPriority;
  patientSummary?: string | null;
  internalNote?: string | null;
}

export interface UpdateFollowUpPayload {
  dueAt?: string;
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  reason?: string;
  patientSummary?: string | null;
  internalNote?: string | null;
}

export interface CreateFollowUpMessagePayload {
  body: string;
  patientVisible?: boolean;
}

export interface FollowUpOperationsSummary {
  totalOpen: number;
  overdue: number;
  waitingPatient: number;
  escalated: number;
  deliveryFailed: number;
  deliveryPending: number;
  source?: string;
}

export interface FollowUpOutcomeQualitySummary {
  totalFollowUps: number;
  closedFollowUps: number;
  openOverdue: number;
  openEscalated: number;
  closedWithEvidence: number;
  closedMissingEvidence: number;
  qualityReviewed: number;
  qualityPending: number;
  qualityNeedsAttention: number;
  patientReached: number;
  clinicalEscalations: number;
  deliveryFailures: number;
  source?: string;
}

export interface FollowUpClinicReviewSummary {
  totalFollowUps: number;
  retentionDue: number;
  retentionReviewed: number;
  retentionArchived: number;
  clinicReviewScheduled: number;
  clinicReviewCompleted: number;
  clinicNeedsPolicyReview: number;
  qualityNeedsAttention: number;
  closedMissingEvidence: number;
  localReviewEvents: number;
  source?: string;
}

export interface FollowUpSopValidationSummary {
  totalFollowUps: number;
  sopRequired: number;
  sopValidated: number;
  sopExceptions: number;
  sopBlocked: number;
  clinicNeedsPolicyReview: number;
  qualityNeedsAttention: number;
  openEscalated: number;
  closedMissingEvidence: number;
  localSopEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyTemplateSummary {
  totalTemplates: number;
  activeTemplates: number;
  inactiveTemplates: number;
  exceptionsAllowed: number;
  requiredByDefault: number;
  localPolicyEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyApplicationSummary {
  totalFollowUps: number;
  activeTemplates: number;
  appliedTemplates: number;
  notChecked: number;
  inSync: number;
  drifted: number;
  missingTemplate: number;
  reviewRequired: number;
  needsPolicyApplication: number;
  localApplicationEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyExceptionClosureSummary {
  totalFollowUps: number;
  openExceptions: number;
  closedExceptions: number;
  acceptedExceptions: number;
  rejectedExceptions: number;
  unresolvedDrift: number;
  unclosedValidationExceptions: number;
  closedWithLocalResolution: number;
  localExceptionEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyAuditRollupSummary {
  totalFollowUps: number;
  auditReady: number;
  needsAuditReview: number;
  reviewedAudits: number;
  needsFollowUp: number;
  unresolvedPolicyDrift: number;
  openExceptions: number;
  missingPolicyTemplate: number;
  localPolicyAuditEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceReadinessSummary {
  totalFollowUps: number;
  governanceReady: number;
  needsGovernanceReview: number;
  reviewedGovernance: number;
  governanceNeedsFollowUp: number;
  reviewedPolicyAudits: number;
  unresolvedPolicyDrift: number;
  openExceptions: number;
  localGovernanceEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceClosureSummary {
  totalFollowUps: number;
  closureReady: number;
  needsClosureReview: number;
  closedGovernanceReviews: number;
  closureNeedsFollowUp: number;
  reviewedGovernance: number;
  unresolvedPolicyDrift: number;
  openExceptions: number;
  localGovernanceClosureEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceSummary {
  totalFollowUps: number;
  evidenceReady: number;
  needsEvidenceReview: number;
  exportedGovernanceEvidence: number;
  evidenceNeedsFollowUp: number;
  closedGovernanceReviews: number;
  unresolvedPolicyDrift: number;
  openExceptions: number;
  localGovernanceEvidenceEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationSummary {
  totalFollowUps: number;
  reconciliationReady: number;
  needsReconciliation: number;
  reconciledGovernanceEvidence: number;
  evidenceMismatches: number;
  reconciliationNeedsFollowUp: number;
  exportedGovernanceEvidence: number;
  closedGovernanceReviews: number;
  localGovernanceEvidenceReconciliationEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary {
  totalFollowUps: number;
  reconciliationClosureReady: number;
  needsReconciliationClosure: number;
  closedReconciliationEvidence: number;
  reconciliationClosureExceptions: number;
  reconciliationClosureNeedsRework: number;
  reconciledGovernanceEvidence: number;
  openReconciliationMismatches: number;
  localGovernanceEvidenceReconciliationClosureEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary {
  totalFollowUps: number;
  closureReceiptReady: number;
  needsClosureReceipt: number;
  receivedClosureReceipts: number;
  closureReceiptExceptions: number;
  closureReceiptNeedsRework: number;
  closedReconciliationEvidence: number;
  reconciledGovernanceEvidence: number;
  localGovernanceEvidenceReconciliationClosureReceiptEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary {
  totalFollowUps: number;
  archiveReadinessReady: number;
  needsArchiveReadiness: number;
  archivedLocal: number;
  archiveReadinessExceptions: number;
  archiveReadinessNeedsRework: number;
  receivedClosureReceipts: number;
  closedReconciliationEvidence: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary {
  totalFollowUps: number;
  archiveClosureReady: number;
  needsArchiveClosure: number;
  closedLocalArchives: number;
  archiveClosureExceptions: number;
  archiveClosureNeedsRework: number;
  archiveReadinessMarked: number;
  receivedClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary {
  totalFollowUps: number;
  archiveClosureReceiptReady: number;
  needsArchiveClosureReceipt: number;
  receivedArchiveClosureReceipts: number;
  archiveClosureReceiptExceptions: number;
  archiveClosureReceiptNeedsRework: number;
  closedLocalArchives: number;
  archiveReadinessMarked: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReady: number;
  needsArchiveClosureReceiptHandoff: number;
  handedOffArchiveClosureReceipts: number;
  archiveClosureReceiptHandoffExceptions: number;
  archiveClosureReceiptHandoffNeedsRework: number;
  receivedArchiveClosureReceipts: number;
  closedLocalArchives: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReady: number;
  needsArchiveClosureReceiptHandoffReceipt: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  archiveClosureReceiptHandoffReceiptExceptions: number;
  archiveClosureReceiptHandoffReceiptNeedsRework: number;
  handedOffArchiveClosureReceipts: number;
  receivedArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReconciliationReady: number;
  needsArchiveClosureReceiptHandoffReceiptReconciliation: number;
  reconciledArchiveClosureReceiptHandoffReceipts: number;
  archiveClosureReceiptHandoffReceiptReconciliationExceptions: number;
  archiveClosureReceiptHandoffReceiptReconciliationNeedsRework: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  handedOffArchiveClosureReceipts: number;
  receivedArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReady: number;
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosure: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliations: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework: number;
  reconciledArchiveClosureReceiptHandoffReceipts: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  handedOffArchiveClosureReceipts: number;
  receivedArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: number;
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliations: number;
  reconciledArchiveClosureReceiptHandoffReceipts: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  handedOffArchiveClosureReceipts: number;
  receivedArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady: number;
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: number;
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliations: number;
  reconciledArchiveClosureReceiptHandoffReceipts: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  handedOffArchiveClosureReceipts: number;
  receivedArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady: number;
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureExceptions: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNeedsRework: number;
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliations: number;
  reconciledArchiveClosureReceiptHandoffReceipts: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  handedOffArchiveClosureReceipts: number;
  receivedArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureEvents: number;
  source?: string;
}
export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady: number;
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptExceptions: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNeedsRework: number;
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliations: number;
  reconciledArchiveClosureReceiptHandoffReceipts: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  handedOffArchiveClosureReceipts: number;
  receivedArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReady: number;
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff: number;
  handedOffArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffs: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffExceptions: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNeedsRework: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: number;
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliations: number;
  reconciledArchiveClosureReceiptHandoffReceipts: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  handedOffArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffEvents: number;
  source?: string;
}
export interface FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary {
  totalFollowUps: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReady: number;
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptExceptions: number;
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNeedsRework: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: number;
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: number;
  closedArchiveClosureReceiptHandoffReceiptReconciliations: number;
  reconciledArchiveClosureReceiptHandoffReceipts: number;
  receivedArchiveClosureReceiptHandoffReceipts: number;
  handedOffArchiveClosureReceipts: number;
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptEvents: number;
  source?: string;
}

export interface SelfHostedFollowUpSopPolicyTemplate {
  id: string;
  clinicId: string | null;
  code: string;
  title: string;
  version: string;
  description: string | null;
  appliesTo: Record<string, unknown>;
  requiredValidationStates: FollowUpSopValidationState[];
  defaultValidationState: FollowUpSopValidationState;
  exceptionAllowed: boolean;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdateFollowUpOperationsPayload {
  triageState?: FollowUpTriageState;
  escalationLevel?: FollowUpEscalationLevel;
  slaDueAt?: string | null;
  deliveryState?: FollowUpDeliveryState;
  deliveryEvidence?: Record<string, unknown>;
  operationsNote?: string | null;
}

export interface UpdateFollowUpQualityPayload {
  resolutionOutcome?: FollowUpResolutionOutcome;
  qualityReviewState?: FollowUpQualityReviewState;
  qualityReviewNote?: string | null;
}

export interface UpdateFollowUpClinicReviewPayload {
  retentionReviewState?: FollowUpRetentionReviewState;
  retentionReviewNote?: string | null;
  clinicReviewState?: FollowUpClinicReviewState;
  clinicReviewNote?: string | null;
}

export interface UpdateFollowUpSopValidationPayload {
  sopValidationState?: FollowUpSopValidationState;
  sopPolicyVersion?: string | null;
  sopExceptionReason?: string | null;
}

export interface UpdateFollowUpSopPolicyApplicationPayload {
  sopPolicyTemplateId?: string;
  sopPolicyTemplateCode?: string | null;
  sopPolicyVersion?: string | null;
  sopValidationState?: FollowUpSopValidationState;
  sopPolicyDriftState?: FollowUpSopPolicyDriftState;
  sopPolicyDriftReason?: string | null;
}

export interface UpdateFollowUpSopPolicyExceptionClosurePayload {
  sopPolicyExceptionState?: FollowUpSopPolicyExceptionState;
  sopPolicyExceptionReason?: string | null;
  sopPolicyExceptionResolution?: string | null;
}

export interface UpdateFollowUpSopPolicyAuditRollupPayload {
  sopPolicyAuditState?: FollowUpSopPolicyAuditState;
  sopPolicyAuditNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceReadinessPayload {
  sopPolicyGovernanceState?: FollowUpSopPolicyGovernanceState;
  sopPolicyGovernanceNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceClosurePayload {
  sopPolicyGovernanceClosureState?: FollowUpSopPolicyGovernanceClosureState;
  sopPolicyGovernanceClosureNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidencePayload {
  sopPolicyGovernanceEvidenceState?: FollowUpSopPolicyGovernanceEvidenceState;
  sopPolicyGovernanceEvidenceNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationPayload {
  sopPolicyGovernanceEvidenceReconciliationState?: FollowUpSopPolicyGovernanceEvidenceReconciliationState;
  sopPolicyGovernanceEvidenceReconciliationNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload {
  sopPolicyGovernanceEvidenceReconciliationClosureState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureState;
  sopPolicyGovernanceEvidenceReconciliationClosureNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosurePayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote?: string | null;
}
export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote?: string | null;
}
export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptPayload {
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState?: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState;
  sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote?: string | null;
}

export interface CreateFollowUpSopPolicyTemplatePayload {
  clinicId?: string | null;
  code: string;
  title: string;
  version: string;
  description?: string | null;
  appliesTo?: Record<string, unknown>;
  requiredValidationStates?: FollowUpSopValidationState[];
  defaultValidationState?: FollowUpSopValidationState;
  exceptionAllowed?: boolean;
  active?: boolean;
}

export type UpdateFollowUpSopPolicyTemplatePayload = Partial<CreateFollowUpSopPolicyTemplatePayload>;

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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function numberOrZero(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toStatus(value: unknown): FollowUpStatus {
  const status = String(value ?? "planned");
  return ["planned", "in_progress", "sent", "acknowledged", "completed", "cancelled"].includes(status)
    ? (status as FollowUpStatus)
    : "planned";
}

function toPriority(value: unknown): FollowUpPriority {
  const priority = String(value ?? "normal");
  return ["low", "normal", "high", "urgent"].includes(priority)
    ? (priority as FollowUpPriority)
    : "normal";
}

function toTriageState(value: unknown): FollowUpTriageState {
  const state = String(value ?? "new");
  return ["new", "queued", "in_review", "waiting_patient", "escalated", "resolved", "blocked"].includes(state)
    ? (state as FollowUpTriageState)
    : "new";
}

function toEscalationLevel(value: unknown): FollowUpEscalationLevel {
  const level = String(value ?? "none");
  return ["none", "watch", "clinic_admin", "urgent"].includes(level)
    ? (level as FollowUpEscalationLevel)
    : "none";
}

function toDeliveryState(value: unknown): FollowUpDeliveryState {
  const state = String(value ?? "not_required");
  return ["not_required", "pending", "delivered", "failed", "deferred"].includes(state)
    ? (state as FollowUpDeliveryState)
    : "not_required";
}

function toResolutionOutcome(value: unknown): FollowUpResolutionOutcome {
  const outcome = String(value ?? "not_reviewed");
  return ["not_reviewed", "patient_reached", "patient_unreachable", "clinical_escalation", "administrative_close"].includes(outcome)
    ? (outcome as FollowUpResolutionOutcome)
    : "not_reviewed";
}

function toQualityReviewState(value: unknown): FollowUpQualityReviewState {
  const state = String(value ?? "pending");
  return ["pending", "reviewed", "needs_attention"].includes(state)
    ? (state as FollowUpQualityReviewState)
    : "pending";
}

function toRetentionReviewState(value: unknown): FollowUpRetentionReviewState {
  const state = String(value ?? "not_due");
  return ["not_due", "due", "reviewed", "archived"].includes(state)
    ? (state as FollowUpRetentionReviewState)
    : "not_due";
}

function toClinicReviewState(value: unknown): FollowUpClinicReviewState {
  const state = String(value ?? "not_scheduled");
  return ["not_scheduled", "scheduled", "completed", "needs_policy_review"].includes(state)
    ? (state as FollowUpClinicReviewState)
    : "not_scheduled";
}

function toSopValidationState(value: unknown): FollowUpSopValidationState {
  const state = String(value ?? "not_required");
  return ["not_required", "required", "validated", "exception", "blocked"].includes(state)
    ? (state as FollowUpSopValidationState)
    : "not_required";
}

function toSopPolicyDriftState(value: unknown): FollowUpSopPolicyDriftState {
  const state = String(value ?? "not_checked");
  return ["not_checked", "in_sync", "drifted", "missing_template", "review_required"].includes(state)
    ? (state as FollowUpSopPolicyDriftState)
    : "not_checked";
}

function toSopPolicyExceptionState(value: unknown): FollowUpSopPolicyExceptionState {
  const state = String(value ?? "none");
  return ["none", "open", "accepted", "rejected", "closed"].includes(state)
    ? (state as FollowUpSopPolicyExceptionState)
    : "none";
}

function toSopPolicyAuditState(value: unknown): FollowUpSopPolicyAuditState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "reviewed", "needs_followup"].includes(state)
    ? (state as FollowUpSopPolicyAuditState)
    : "not_started";
}

function toSopPolicyGovernanceState(value: unknown): FollowUpSopPolicyGovernanceState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "reviewed", "needs_followup"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceState)
    : "not_started";
}

function toSopPolicyGovernanceClosureState(value: unknown): FollowUpSopPolicyGovernanceClosureState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "closed", "needs_followup"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceClosureState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceState(value: unknown): FollowUpSopPolicyGovernanceEvidenceState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "exported", "needs_followup"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "reconciled", "mismatch", "needs_followup"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "closed", "closure_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "received", "receipt_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "archived", "archive_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "closed", "closure_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "received", "receipt_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "handed_off", "handoff_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "received", "receipt_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "reconciled", "reconciliation_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "closed", "closure_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "received", "receipt_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "archived", "archive_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "closed", "closure_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState)
    : "not_started";
}
function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "received", "receipt_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState)
    : "not_started";
}
function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "handed_off", "handoff_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState)
    : "not_started";
}

function toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState(value: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "received", "receipt_exception", "needs_rework"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState)
    : "not_started";
}

export function toSelfHostedFollowUpMessage(input: unknown): SelfHostedFollowUpMessage {
  const row = isRecord(input) ? input : {};
  return {
    id: String(row.id ?? ""),
    followUpId: String(row.followUpId ?? ""),
    senderRole: String(row.senderRole ?? ""),
    direction: String(row.direction ?? ""),
    channel: String(row.channel ?? "portal"),
    deliveryState: String(row.deliveryState ?? "local_only"),
    patientVisible: Boolean(row.patientVisible ?? true),
    body: textOrNull(row.body),
    createdAt: textOrNull(row.createdAt),
  };
}

export function toSelfHostedClinicalFollowUp(input: unknown): SelfHostedClinicalFollowUp {
  const row = isRecord(input) ? input : {};
  const patient = isRecord(row.patient) ? row.patient : {};
  return {
    id: String(row.id ?? ""),
    clinicId: textOrNull(row.clinicId),
    patientId: textOrNull(row.patientId),
    visitId: textOrNull(row.visitId),
    dueAt: textOrNull(row.dueAt),
    status: toStatus(row.status),
    priority: toPriority(row.priority),
    reason: textOrNull(row.reason),
    patientSummary: textOrNull(row.patientSummary),
    internalNote: textOrNull(row.internalNote),
    triageState: toTriageState(row.triageState),
    escalationLevel: toEscalationLevel(row.escalationLevel),
    slaDueAt: textOrNull(row.slaDueAt),
    deliveryState: toDeliveryState(row.deliveryState),
    deliveryAttempts: Number(row.deliveryAttempts ?? 0),
    lastDeliveryAttemptAt: textOrNull(row.lastDeliveryAttemptAt),
    deliveryEvidence: isRecord(row.deliveryEvidence) ? row.deliveryEvidence : {},
    operationsNote: textOrNull(row.operationsNote),
    resolutionOutcome: toResolutionOutcome(row.resolutionOutcome),
    qualityReviewState: toQualityReviewState(row.qualityReviewState),
    qualityReviewNote: textOrNull(row.qualityReviewNote),
    qualityReviewedAt: textOrNull(row.qualityReviewedAt),
    retentionReviewState: toRetentionReviewState(row.retentionReviewState),
    retentionReviewNote: textOrNull(row.retentionReviewNote),
    retentionReviewedAt: textOrNull(row.retentionReviewedAt),
    clinicReviewState: toClinicReviewState(row.clinicReviewState),
    clinicReviewNote: textOrNull(row.clinicReviewNote),
    clinicReviewedAt: textOrNull(row.clinicReviewedAt),
    sopValidationState: toSopValidationState(row.sopValidationState),
    sopPolicyVersion: textOrNull(row.sopPolicyVersion),
    sopPolicyTemplateId: textOrNull(row.sopPolicyTemplateId),
    sopPolicyTemplateCode: textOrNull(row.sopPolicyTemplateCode),
    sopPolicyDriftState: toSopPolicyDriftState(row.sopPolicyDriftState),
    sopPolicyDriftReason: textOrNull(row.sopPolicyDriftReason),
    sopPolicyAppliedAt: textOrNull(row.sopPolicyAppliedAt),
    sopPolicyDriftReviewedAt: textOrNull(row.sopPolicyDriftReviewedAt),
    sopPolicyExceptionState: toSopPolicyExceptionState(row.sopPolicyExceptionState),
    sopPolicyExceptionReason: textOrNull(row.sopPolicyExceptionReason),
    sopPolicyExceptionResolution: textOrNull(row.sopPolicyExceptionResolution),
    sopPolicyExceptionClosedAt: textOrNull(row.sopPolicyExceptionClosedAt),
    sopPolicyAuditState: toSopPolicyAuditState(row.sopPolicyAuditState),
    sopPolicyAuditNote: textOrNull(row.sopPolicyAuditNote),
    sopPolicyAuditReviewedAt: textOrNull(row.sopPolicyAuditReviewedAt),
    sopPolicyGovernanceState: toSopPolicyGovernanceState(row.sopPolicyGovernanceState),
    sopPolicyGovernanceNote: textOrNull(row.sopPolicyGovernanceNote),
    sopPolicyGovernanceReviewedAt: textOrNull(row.sopPolicyGovernanceReviewedAt),
    sopPolicyGovernanceClosureState: toSopPolicyGovernanceClosureState(row.sopPolicyGovernanceClosureState),
    sopPolicyGovernanceClosureNote: textOrNull(row.sopPolicyGovernanceClosureNote),
    sopPolicyGovernanceClosedAt: textOrNull(row.sopPolicyGovernanceClosedAt),
    sopPolicyGovernanceEvidenceState: toSopPolicyGovernanceEvidenceState(row.sopPolicyGovernanceEvidenceState),
    sopPolicyGovernanceEvidenceNote: textOrNull(row.sopPolicyGovernanceEvidenceNote),
    sopPolicyGovernanceEvidenceReviewedAt: textOrNull(row.sopPolicyGovernanceEvidenceReviewedAt),
    sopPolicyGovernanceEvidenceReconciliationState: toSopPolicyGovernanceEvidenceReconciliationState(row.sopPolicyGovernanceEvidenceReconciliationState),
    sopPolicyGovernanceEvidenceReconciliationNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationNote),
    sopPolicyGovernanceEvidenceReconciledAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciledAt),
    sopPolicyGovernanceEvidenceReconciliationClosureState: toSopPolicyGovernanceEvidenceReconciliationClosureState(row.sopPolicyGovernanceEvidenceReconciliationClosureState),
    sopPolicyGovernanceEvidenceReconciliationClosureNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureNote),
    sopPolicyGovernanceEvidenceReconciliationClosedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceivedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceivedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandedOffAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandedOffAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceivedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceivedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciledAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciledAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceivedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceivedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceivedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceivedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandedOffAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandedOffAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState: toSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceivedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceivedAt),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceivedAt: textOrNull(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceivedAt),
    sopExceptionReason: textOrNull(row.sopExceptionReason),
    sopValidatedAt: textOrNull(row.sopValidatedAt),
    resolvedAt: textOrNull(row.resolvedAt),
    lastMessageAt: textOrNull(row.lastMessageAt),
    createdAt: textOrNull(row.createdAt),
    updatedAt: textOrNull(row.updatedAt),
    patient: {
      id: textOrNull(patient.id),
      code: textOrNull(patient.code),
      fullName: textOrNull(patient.fullName),
    },
    latestMessage: row.latestMessage ? toSelfHostedFollowUpMessage(row.latestMessage) : null,
    messageCount: Number(row.messageCount ?? 0),
  };
}

export function toFollowUpOperationsSummary(input: unknown): FollowUpOperationsSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalOpen: Number(row.totalOpen ?? 0),
    overdue: Number(row.overdue ?? 0),
    waitingPatient: Number(row.waitingPatient ?? 0),
    escalated: Number(row.escalated ?? 0),
    deliveryFailed: Number(row.deliveryFailed ?? 0),
    deliveryPending: Number(row.deliveryPending ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

export function toFollowUpOutcomeQualitySummary(input: unknown): FollowUpOutcomeQualitySummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: Number(row.totalFollowUps ?? 0),
    closedFollowUps: Number(row.closedFollowUps ?? 0),
    openOverdue: Number(row.openOverdue ?? 0),
    openEscalated: Number(row.openEscalated ?? 0),
    closedWithEvidence: Number(row.closedWithEvidence ?? 0),
    closedMissingEvidence: Number(row.closedMissingEvidence ?? 0),
    qualityReviewed: Number(row.qualityReviewed ?? 0),
    qualityPending: Number(row.qualityPending ?? 0),
    qualityNeedsAttention: Number(row.qualityNeedsAttention ?? 0),
    patientReached: Number(row.patientReached ?? 0),
    clinicalEscalations: Number(row.clinicalEscalations ?? 0),
    deliveryFailures: Number(row.deliveryFailures ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

export function toFollowUpClinicReviewSummary(input: unknown): FollowUpClinicReviewSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: Number(row.totalFollowUps ?? 0),
    retentionDue: Number(row.retentionDue ?? 0),
    retentionReviewed: Number(row.retentionReviewed ?? 0),
    retentionArchived: Number(row.retentionArchived ?? 0),
    clinicReviewScheduled: Number(row.clinicReviewScheduled ?? 0),
    clinicReviewCompleted: Number(row.clinicReviewCompleted ?? 0),
    clinicNeedsPolicyReview: Number(row.clinicNeedsPolicyReview ?? 0),
    qualityNeedsAttention: Number(row.qualityNeedsAttention ?? 0),
    closedMissingEvidence: Number(row.closedMissingEvidence ?? 0),
    localReviewEvents: Number(row.localReviewEvents ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

export function toFollowUpSopValidationSummary(input: unknown): FollowUpSopValidationSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    sopRequired: numberOrZero(row.sopRequired),
    sopValidated: numberOrZero(row.sopValidated),
    sopExceptions: numberOrZero(row.sopExceptions),
    sopBlocked: numberOrZero(row.sopBlocked),
    clinicNeedsPolicyReview: numberOrZero(row.clinicNeedsPolicyReview),
    qualityNeedsAttention: numberOrZero(row.qualityNeedsAttention),
    openEscalated: numberOrZero(row.openEscalated),
    closedMissingEvidence: numberOrZero(row.closedMissingEvidence),
    localSopEvents: numberOrZero(row.localSopEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyTemplateSummary(input: unknown): FollowUpSopPolicyTemplateSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalTemplates: numberOrZero(row.totalTemplates),
    activeTemplates: numberOrZero(row.activeTemplates),
    inactiveTemplates: numberOrZero(row.inactiveTemplates),
    exceptionsAllowed: numberOrZero(row.exceptionsAllowed),
    requiredByDefault: numberOrZero(row.requiredByDefault),
    localPolicyEvents: numberOrZero(row.localPolicyEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyApplicationSummary(input: unknown): FollowUpSopPolicyApplicationSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    activeTemplates: numberOrZero(row.activeTemplates),
    appliedTemplates: numberOrZero(row.appliedTemplates),
    notChecked: numberOrZero(row.notChecked),
    inSync: numberOrZero(row.inSync),
    drifted: numberOrZero(row.drifted),
    missingTemplate: numberOrZero(row.missingTemplate),
    reviewRequired: numberOrZero(row.reviewRequired),
    needsPolicyApplication: numberOrZero(row.needsPolicyApplication),
    localApplicationEvents: numberOrZero(row.localApplicationEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyExceptionClosureSummary(input: unknown): FollowUpSopPolicyExceptionClosureSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    openExceptions: numberOrZero(row.openExceptions),
    closedExceptions: numberOrZero(row.closedExceptions),
    acceptedExceptions: numberOrZero(row.acceptedExceptions),
    rejectedExceptions: numberOrZero(row.rejectedExceptions),
    unresolvedDrift: numberOrZero(row.unresolvedDrift),
    unclosedValidationExceptions: numberOrZero(row.unclosedValidationExceptions),
    closedWithLocalResolution: numberOrZero(row.closedWithLocalResolution),
    localExceptionEvents: numberOrZero(row.localExceptionEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyAuditRollupSummary(input: unknown): FollowUpSopPolicyAuditRollupSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    auditReady: numberOrZero(row.auditReady),
    needsAuditReview: numberOrZero(row.needsAuditReview),
    reviewedAudits: numberOrZero(row.reviewedAudits),
    needsFollowUp: numberOrZero(row.needsFollowUp),
    unresolvedPolicyDrift: numberOrZero(row.unresolvedPolicyDrift),
    openExceptions: numberOrZero(row.openExceptions),
    missingPolicyTemplate: numberOrZero(row.missingPolicyTemplate),
    localPolicyAuditEvents: numberOrZero(row.localPolicyAuditEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceReadinessSummary(input: unknown): FollowUpSopPolicyGovernanceReadinessSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    governanceReady: numberOrZero(row.governanceReady),
    needsGovernanceReview: numberOrZero(row.needsGovernanceReview),
    reviewedGovernance: numberOrZero(row.reviewedGovernance),
    governanceNeedsFollowUp: numberOrZero(row.governanceNeedsFollowUp),
    reviewedPolicyAudits: numberOrZero(row.reviewedPolicyAudits),
    unresolvedPolicyDrift: numberOrZero(row.unresolvedPolicyDrift),
    openExceptions: numberOrZero(row.openExceptions),
    localGovernanceEvents: numberOrZero(row.localGovernanceEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceClosureSummary(input: unknown): FollowUpSopPolicyGovernanceClosureSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    closureReady: numberOrZero(row.closureReady),
    needsClosureReview: numberOrZero(row.needsClosureReview),
    closedGovernanceReviews: numberOrZero(row.closedGovernanceReviews),
    closureNeedsFollowUp: numberOrZero(row.closureNeedsFollowUp),
    reviewedGovernance: numberOrZero(row.reviewedGovernance),
    unresolvedPolicyDrift: numberOrZero(row.unresolvedPolicyDrift),
    openExceptions: numberOrZero(row.openExceptions),
    localGovernanceClosureEvents: numberOrZero(row.localGovernanceClosureEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    evidenceReady: numberOrZero(row.evidenceReady),
    needsEvidenceReview: numberOrZero(row.needsEvidenceReview),
    exportedGovernanceEvidence: numberOrZero(row.exportedGovernanceEvidence),
    evidenceNeedsFollowUp: numberOrZero(row.evidenceNeedsFollowUp),
    closedGovernanceReviews: numberOrZero(row.closedGovernanceReviews),
    unresolvedPolicyDrift: numberOrZero(row.unresolvedPolicyDrift),
    openExceptions: numberOrZero(row.openExceptions),
    localGovernanceEvidenceEvents: numberOrZero(row.localGovernanceEvidenceEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    reconciliationReady: numberOrZero(row.reconciliationReady),
    needsReconciliation: numberOrZero(row.needsReconciliation),
    reconciledGovernanceEvidence: numberOrZero(row.reconciledGovernanceEvidence),
    evidenceMismatches: numberOrZero(row.evidenceMismatches),
    reconciliationNeedsFollowUp: numberOrZero(row.reconciliationNeedsFollowUp),
    exportedGovernanceEvidence: numberOrZero(row.exportedGovernanceEvidence),
    closedGovernanceReviews: numberOrZero(row.closedGovernanceReviews),
    localGovernanceEvidenceReconciliationEvents: numberOrZero(row.localGovernanceEvidenceReconciliationEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    reconciliationClosureReady: numberOrZero(row.reconciliationClosureReady),
    needsReconciliationClosure: numberOrZero(row.needsReconciliationClosure),
    closedReconciliationEvidence: numberOrZero(row.closedReconciliationEvidence),
    reconciliationClosureExceptions: numberOrZero(row.reconciliationClosureExceptions),
    reconciliationClosureNeedsRework: numberOrZero(row.reconciliationClosureNeedsRework),
    reconciledGovernanceEvidence: numberOrZero(row.reconciledGovernanceEvidence),
    openReconciliationMismatches: numberOrZero(row.openReconciliationMismatches),
    localGovernanceEvidenceReconciliationClosureEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    closureReceiptReady: numberOrZero(row.closureReceiptReady),
    needsClosureReceipt: numberOrZero(row.needsClosureReceipt),
    receivedClosureReceipts: numberOrZero(row.receivedClosureReceipts),
    closureReceiptExceptions: numberOrZero(row.closureReceiptExceptions),
    closureReceiptNeedsRework: numberOrZero(row.closureReceiptNeedsRework),
    closedReconciliationEvidence: numberOrZero(row.closedReconciliationEvidence),
    reconciledGovernanceEvidence: numberOrZero(row.reconciledGovernanceEvidence),
    localGovernanceEvidenceReconciliationClosureReceiptEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveReadinessReady: numberOrZero(row.archiveReadinessReady),
    needsArchiveReadiness: numberOrZero(row.needsArchiveReadiness),
    archivedLocal: numberOrZero(row.archivedLocal),
    archiveReadinessExceptions: numberOrZero(row.archiveReadinessExceptions),
    archiveReadinessNeedsRework: numberOrZero(row.archiveReadinessNeedsRework),
    receivedClosureReceipts: numberOrZero(row.receivedClosureReceipts),
    closedReconciliationEvidence: numberOrZero(row.closedReconciliationEvidence),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReady: numberOrZero(row.archiveClosureReady),
    needsArchiveClosure: numberOrZero(row.needsArchiveClosure),
    closedLocalArchives: numberOrZero(row.closedLocalArchives),
    archiveClosureExceptions: numberOrZero(row.archiveClosureExceptions),
    archiveClosureNeedsRework: numberOrZero(row.archiveClosureNeedsRework),
    archiveReadinessMarked: numberOrZero(row.archiveReadinessMarked),
    receivedClosureReceipts: numberOrZero(row.receivedClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptReady: numberOrZero(row.archiveClosureReceiptReady),
    needsArchiveClosureReceipt: numberOrZero(row.needsArchiveClosureReceipt),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    archiveClosureReceiptExceptions: numberOrZero(row.archiveClosureReceiptExceptions),
    archiveClosureReceiptNeedsRework: numberOrZero(row.archiveClosureReceiptNeedsRework),
    closedLocalArchives: numberOrZero(row.closedLocalArchives),
    archiveReadinessMarked: numberOrZero(row.archiveReadinessMarked),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReady: numberOrZero(row.archiveClosureReceiptHandoffReady),
    needsArchiveClosureReceiptHandoff: numberOrZero(row.needsArchiveClosureReceiptHandoff),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    archiveClosureReceiptHandoffExceptions: numberOrZero(row.archiveClosureReceiptHandoffExceptions),
    archiveClosureReceiptHandoffNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffNeedsRework),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    closedLocalArchives: numberOrZero(row.closedLocalArchives),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReady),
    needsArchiveClosureReceiptHandoffReceipt: numberOrZero(row.needsArchiveClosureReceiptHandoffReceipt),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    archiveClosureReceiptHandoffReceiptExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptExceptions),
    archiveClosureReceiptHandoffReceiptNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptNeedsRework),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReconciliationReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationReady),
    needsArchiveClosureReceiptHandoffReceiptReconciliation: numberOrZero(row.needsArchiveClosureReceiptHandoffReceiptReconciliation),
    reconciledArchiveClosureReceiptHandoffReceipts: numberOrZero(row.reconciledArchiveClosureReceiptHandoffReceipts),
    archiveClosureReceiptHandoffReceiptReconciliationExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationExceptions),
    archiveClosureReceiptHandoffReceiptReconciliationNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationNeedsRework),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReady),
    needsArchiveClosureReceiptHandoffReceiptReconciliationClosure: numberOrZero(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosure),
    closedArchiveClosureReceiptHandoffReceiptReconciliations: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliations),
    archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions),
    archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework),
    reconciledArchiveClosureReceiptHandoffReceipts: numberOrZero(row.reconciledArchiveClosureReceiptHandoffReceipts),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady),
    needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: numberOrZero(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework),
    closedArchiveClosureReceiptHandoffReceiptReconciliations: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliations),
    reconciledArchiveClosureReceiptHandoffReceipts: numberOrZero(row.reconciledArchiveClosureReceiptHandoffReceipts),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady),
    needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: numberOrZero(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness),
    archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    closedArchiveClosureReceiptHandoffReceiptReconciliations: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliations),
    reconciledArchiveClosureReceiptHandoffReceipts: numberOrZero(row.reconciledArchiveClosureReceiptHandoffReceipts),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady),
    needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure: numberOrZero(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure),
    closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureExceptions),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNeedsRework),
    archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    closedArchiveClosureReceiptHandoffReceiptReconciliations: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliations),
    reconciledArchiveClosureReceiptHandoffReceipts: numberOrZero(row.reconciledArchiveClosureReceiptHandoffReceipts),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureEvents),
    source: textOrNull(row.source) || undefined,
  };
}
export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady),
    needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt: numberOrZero(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptExceptions),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNeedsRework),
    archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    closedArchiveClosureReceiptHandoffReceiptReconciliations: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliations),
    reconciledArchiveClosureReceiptHandoffReceipts: numberOrZero(row.reconciledArchiveClosureReceiptHandoffReceipts),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    receivedArchiveClosureReceipts: numberOrZero(row.receivedArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReady),
    needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff: numberOrZero(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff),
    handedOffArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffs: numberOrZero(row.handedOffArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffs),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffExceptions),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNeedsRework),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts),
    closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures),
    archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    closedArchiveClosureReceiptHandoffReceiptReconciliations: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliations),
    reconciledArchiveClosureReceiptHandoffReceipts: numberOrZero(row.reconciledArchiveClosureReceiptHandoffReceipts),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toSelfHostedFollowUpSopPolicyTemplate(input: unknown): SelfHostedFollowUpSopPolicyTemplate {
  const row = isRecord(input) ? input : {};
  const states = Array.isArray(row.requiredValidationStates)
    ? row.requiredValidationStates.map(toSopValidationState)
    : [];
  return {
    id: String(row.id ?? ""),
    clinicId: textOrNull(row.clinicId),
    code: String(row.code ?? ""),
    title: String(row.title ?? ""),
    version: String(row.version ?? ""),
    description: textOrNull(row.description),
    appliesTo: isRecord(row.appliesTo) ? row.appliesTo : {},
    requiredValidationStates: states,
    defaultValidationState: toSopValidationState(row.defaultValidationState),
    exceptionAllowed: Boolean(row.exceptionAllowed ?? true),
    active: Boolean(row.active ?? true),
    createdAt: textOrNull(row.createdAt),
    updatedAt: textOrNull(row.updatedAt),
  };
}

export function toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary(input: unknown): FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReady: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReady),
    needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt: numberOrZero(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptExceptions: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptExceptions),
    archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNeedsRework: numberOrZero(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNeedsRework),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts),
    closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures),
    archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts),
    closedArchiveClosureReceiptHandoffReceiptReconciliations: numberOrZero(row.closedArchiveClosureReceiptHandoffReceiptReconciliations),
    reconciledArchiveClosureReceiptHandoffReceipts: numberOrZero(row.reconciledArchiveClosureReceiptHandoffReceipts),
    receivedArchiveClosureReceiptHandoffReceipts: numberOrZero(row.receivedArchiveClosureReceiptHandoffReceipts),
    handedOffArchiveClosureReceipts: numberOrZero(row.handedOffArchiveClosureReceipts),
    localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptEvents: numberOrZero(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptEvents),
    source: textOrNull(row.source) || undefined,
  };
}

function apiErrorFromBody(response: Response, body: unknown): SelfHostedApiError {
  const errorBody =
    isRecord(body) && isRecord(body.error)
      ? body as { error?: Record<string, unknown>; correlationId?: unknown }
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

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson(
  args: BaseArgs,
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<SelfHostedApiResult<unknown>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  const method = init.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(buildSelfHostedApiUrl(args.apiBaseUrl, path), {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.apiToken}`,
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(init.body ?? {}) }),
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
  return ok(body);
}

export async function listSelfHostedClinicalFollowUps(
  args: BaseArgs & { status?: string | null; patientId?: string | null; visitId?: string | null },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.patientId) params.set("patientId", args.patientId);
  if (args.visitId) params.set("visitId", args.visitId);
  const suffix = params.toString() ? `?${params}` : "";
  const response = await requestJson(args, `/api/v1/clinical/follow-ups${suffix}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function createSelfHostedVisitFollowUp(
  args: BaseArgs & { visitId: string; payload: CreateFollowUpPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/visits/${encodeURIComponent(args.visitId)}/follow-ups`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUp(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function createSelfHostedClinicalFollowUpMessage(
  args: BaseArgs & { followUpId: string; payload: CreateFollowUpMessagePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpMessage>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/messages`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpMessage(body.item));
}

export async function listSelfHostedClinicalFollowUpOperations(
  args: BaseArgs & {
    triageState?: string | null;
    escalationLevel?: string | null;
    deliveryState?: string | null;
    patientId?: string | null;
    visitId?: string | null;
    overdueOnly?: boolean;
  },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const params = new URLSearchParams();
  if (args.triageState) params.set("triageState", args.triageState);
  if (args.escalationLevel) params.set("escalationLevel", args.escalationLevel);
  if (args.deliveryState) params.set("deliveryState", args.deliveryState);
  if (args.patientId) params.set("patientId", args.patientId);
  if (args.visitId) params.set("visitId", args.visitId);
  if (args.overdueOnly) params.set("overdueOnly", "true");
  const suffix = params.toString() ? `?${params}` : "";
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/operations${suffix}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function getSelfHostedClinicalFollowUpOperationsSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpOperationsSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/operations/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpOperationsSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpOutcomeQualitySummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpOutcomeQualitySummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/outcomes/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpOutcomeQualitySummary(body.item));
}

export async function getSelfHostedClinicalFollowUpClinicReviewSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpClinicReviewSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/clinic-review/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpClinicReviewSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopValidationSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopValidationSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-validation/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopValidationSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyTemplateSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyTemplateSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-templates/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyTemplateSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyApplicationSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyApplicationSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-application/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyApplicationSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyExceptionClosureSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyExceptionClosureSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-exceptions/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyExceptionClosureSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyAuditRollupSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyAuditRollupSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-audit/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyAuditRollupSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceReadinessSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceReadinessSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceReadinessSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceClosureSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceClosureSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary(body.item));
}
export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary(body.item));
}
export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary(body.item));
}

export async function listSelfHostedClinicalFollowUpSopPolicyTemplates(
  args: BaseArgs & { activeOnly?: boolean },
): Promise<SelfHostedApiResult<SelfHostedFollowUpSopPolicyTemplate[]>> {
  const params = new URLSearchParams();
  if (args.activeOnly) params.set("activeOnly", "true");
  const suffix = params.toString() ? `?${params}` : "";
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/sop-policy-templates${suffix}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedFollowUpSopPolicyTemplate).filter((item) => item.id));
}

export async function updateSelfHostedClinicalFollowUpOperations(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpOperationsPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/operations`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpQuality(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpQualityPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/quality`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpClinicReview(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpClinicReviewPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/clinic-review`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopValidation(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopValidationPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-validation`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyApplication(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyApplicationPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-application`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyExceptionClosure(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyExceptionClosurePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-exception`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyAuditRollup(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyAuditRollupPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-audit`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceReadiness(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceReadinessPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceClosurePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-closure`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidence(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidencePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosurePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}
export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}
export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function createSelfHostedClinicalFollowUpSopPolicyTemplate(
  args: BaseArgs & { payload: CreateFollowUpSopPolicyTemplatePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpSopPolicyTemplate>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-templates", {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpSopPolicyTemplate(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyTemplate(
  args: BaseArgs & { templateId: string; payload: UpdateFollowUpSopPolicyTemplatePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpSopPolicyTemplate>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/sop-policy-templates/${encodeURIComponent(args.templateId)}`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpSopPolicyTemplate(body.item));
}

export async function listSelfHostedPatientFollowUps(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const response = await requestJson(args, "/api/v1/me/follow-ups");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function createSelfHostedPatientFollowUpMessage(
  args: BaseArgs & { followUpId: string; payload: CreateFollowUpMessagePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpMessage>> {
  const response = await requestJson(args, `/api/v1/me/follow-ups/${encodeURIComponent(args.followUpId)}/messages`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpMessage(body.item));
}
