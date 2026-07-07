// Stage 4H · Live write controls for self-hosted visit workspace.
// Hidden in demo mode. Keeps the existing demo tabs untouched.

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Lesion, Visit } from "@/lib/domain";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import { selfHostedPublicErrorText } from "@/lib/self-hosted-public-error";
import {
  createSelfHostedClinicalFollowUpSopPolicyTemplate,
  createSelfHostedVisitFollowUp,
  getSelfHostedClinicalFollowUpClinicReviewSummary,
  getSelfHostedClinicalFollowUpOutcomeQualitySummary,
  getSelfHostedClinicalFollowUpOperationsSummary,
  getSelfHostedClinicalFollowUpSopPolicyTemplateSummary,
  getSelfHostedClinicalFollowUpSopPolicyApplicationSummary,
  getSelfHostedClinicalFollowUpSopPolicyAuditRollupSummary,
  getSelfHostedClinicalFollowUpSopPolicyExceptionClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceReadinessSummary,
  getSelfHostedClinicalFollowUpSopValidationSummary,
  listSelfHostedClinicalFollowUpOperations,
  listSelfHostedClinicalFollowUpSopPolicyTemplates,
  type FollowUpClinicReviewSummary,
  type FollowUpOutcomeQualitySummary,
  type FollowUpOperationsSummary,
  type FollowUpSopPolicyTemplateSummary,
  type FollowUpSopPolicyApplicationSummary,
  type FollowUpSopPolicyAuditRollupSummary,
  type FollowUpSopPolicyExceptionClosureSummary,
  type FollowUpSopPolicyGovernanceClosureSummary,
  type FollowUpSopPolicyGovernanceEvidenceSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary,
  type FollowUpSopPolicyGovernanceEvidenceReconciliationSummary,
  type FollowUpSopPolicyGovernanceReadinessSummary,
  type FollowUpSopValidationSummary,
  type SelfHostedClinicalFollowUp,
  type SelfHostedFollowUpSopPolicyTemplate,
  updateSelfHostedClinicalFollowUpClinicReview,
  updateSelfHostedClinicalFollowUpOperations,
  updateSelfHostedClinicalFollowUpQuality,
  updateSelfHostedClinicalFollowUpSopValidation,
  updateSelfHostedClinicalFollowUpSopPolicyApplication,
  updateSelfHostedClinicalFollowUpSopPolicyAuditRollup,
  updateSelfHostedClinicalFollowUpSopPolicyExceptionClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidence,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceReadiness,
} from "@/lib/self-hosted-follow-up-api";
import {
  archiveSelfHostedVisitLesion,
  buildSelfHostedVisitReportPayload,
  createSelfHostedVisitLesion,
  updateSelfHostedVisit,
  updateSelfHostedVisitLesion,
  updateSelfHostedVisitReport,
} from "@/lib/self-hosted-visit-write-api";

interface VisitWorkspaceLiveActionsProps {
  visit: Visit;
  lesions: Lesion[];
}

type BusyAction =
  | "visit"
  | "create-lesion"
  | "update-lesion"
  | "archive-lesion"
  | "report"
  | "follow-up"
  | "operations-load"
  | "operations-update"
  | "quality-update"
  | "clinic-review-update"
  | "sop-validation-update"
  | "sop-policy-template-create"
  | "sop-policy-application-update"
  | "sop-policy-exception-update"
  | "sop-policy-audit-update"
  | "sop-policy-governance-update"
  | "sop-policy-governance-closure-update"
  | "sop-policy-governance-evidence-update"
  | "sop-policy-governance-evidence-reconciliation-update"
  | "sop-policy-governance-evidence-reconciliation-closure-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-update"
  | "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt-update"
  | null;

const EMPTY_OPERATIONS_SUMMARY: FollowUpOperationsSummary = {
  totalOpen: 0,
  overdue: 0,
  waitingPatient: 0,
  escalated: 0,
  deliveryFailed: 0,
  deliveryPending: 0,
};

const EMPTY_OUTCOME_SUMMARY: FollowUpOutcomeQualitySummary = {
  totalFollowUps: 0,
  closedFollowUps: 0,
  openOverdue: 0,
  openEscalated: 0,
  closedWithEvidence: 0,
  closedMissingEvidence: 0,
  qualityReviewed: 0,
  qualityPending: 0,
  qualityNeedsAttention: 0,
  patientReached: 0,
  clinicalEscalations: 0,
  deliveryFailures: 0,
};

const EMPTY_CLINIC_REVIEW_SUMMARY: FollowUpClinicReviewSummary = {
  totalFollowUps: 0,
  retentionDue: 0,
  retentionReviewed: 0,
  retentionArchived: 0,
  clinicReviewScheduled: 0,
  clinicReviewCompleted: 0,
  clinicNeedsPolicyReview: 0,
  qualityNeedsAttention: 0,
  closedMissingEvidence: 0,
  localReviewEvents: 0,
};

const EMPTY_SOP_VALIDATION_SUMMARY: FollowUpSopValidationSummary = {
  totalFollowUps: 0,
  sopRequired: 0,
  sopValidated: 0,
  sopExceptions: 0,
  sopBlocked: 0,
  clinicNeedsPolicyReview: 0,
  qualityNeedsAttention: 0,
  openEscalated: 0,
  closedMissingEvidence: 0,
  localSopEvents: 0,
};

const EMPTY_SOP_POLICY_TEMPLATE_SUMMARY: FollowUpSopPolicyTemplateSummary = {
  totalTemplates: 0,
  activeTemplates: 0,
  inactiveTemplates: 0,
  exceptionsAllowed: 0,
  requiredByDefault: 0,
  localPolicyEvents: 0,
};

const EMPTY_SOP_POLICY_APPLICATION_SUMMARY: FollowUpSopPolicyApplicationSummary = {
  totalFollowUps: 0,
  activeTemplates: 0,
  appliedTemplates: 0,
  notChecked: 0,
  inSync: 0,
  drifted: 0,
  missingTemplate: 0,
  reviewRequired: 0,
  needsPolicyApplication: 0,
  localApplicationEvents: 0,
};

const EMPTY_SOP_POLICY_EXCEPTION_CLOSURE_SUMMARY: FollowUpSopPolicyExceptionClosureSummary = {
  totalFollowUps: 0,
  openExceptions: 0,
  closedExceptions: 0,
  acceptedExceptions: 0,
  rejectedExceptions: 0,
  unresolvedDrift: 0,
  unclosedValidationExceptions: 0,
  closedWithLocalResolution: 0,
  localExceptionEvents: 0,
};

const EMPTY_SOP_POLICY_AUDIT_ROLLUP_SUMMARY: FollowUpSopPolicyAuditRollupSummary = {
  totalFollowUps: 0,
  auditReady: 0,
  needsAuditReview: 0,
  reviewedAudits: 0,
  needsFollowUp: 0,
  unresolvedPolicyDrift: 0,
  openExceptions: 0,
  missingPolicyTemplate: 0,
  localPolicyAuditEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_READINESS_SUMMARY: FollowUpSopPolicyGovernanceReadinessSummary = {
  totalFollowUps: 0,
  governanceReady: 0,
  needsGovernanceReview: 0,
  reviewedGovernance: 0,
  governanceNeedsFollowUp: 0,
  reviewedPolicyAudits: 0,
  unresolvedPolicyDrift: 0,
  openExceptions: 0,
  localGovernanceEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_CLOSURE_SUMMARY: FollowUpSopPolicyGovernanceClosureSummary = {
  totalFollowUps: 0,
  closureReady: 0,
  needsClosureReview: 0,
  closedGovernanceReviews: 0,
  closureNeedsFollowUp: 0,
  reviewedGovernance: 0,
  unresolvedPolicyDrift: 0,
  openExceptions: 0,
  localGovernanceClosureEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_SUMMARY: FollowUpSopPolicyGovernanceEvidenceSummary = {
  totalFollowUps: 0,
  evidenceReady: 0,
  needsEvidenceReview: 0,
  exportedGovernanceEvidence: 0,
  evidenceNeedsFollowUp: 0,
  closedGovernanceReviews: 0,
  unresolvedPolicyDrift: 0,
  openExceptions: 0,
  localGovernanceEvidenceEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationSummary = {
  totalFollowUps: 0,
  reconciliationReady: 0,
  needsReconciliation: 0,
  reconciledGovernanceEvidence: 0,
  evidenceMismatches: 0,
  reconciliationNeedsFollowUp: 0,
  exportedGovernanceEvidence: 0,
  closedGovernanceReviews: 0,
  localGovernanceEvidenceReconciliationEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary = {
  totalFollowUps: 0,
  reconciliationClosureReady: 0,
  needsReconciliationClosure: 0,
  closedReconciliationEvidence: 0,
  reconciliationClosureExceptions: 0,
  reconciliationClosureNeedsRework: 0,
  reconciledGovernanceEvidence: 0,
  openReconciliationMismatches: 0,
  localGovernanceEvidenceReconciliationClosureEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary = {
  totalFollowUps: 0,
  closureReceiptReady: 0,
  needsClosureReceipt: 0,
  receivedClosureReceipts: 0,
  closureReceiptExceptions: 0,
  closureReceiptNeedsRework: 0,
  closedReconciliationEvidence: 0,
  reconciledGovernanceEvidence: 0,
  localGovernanceEvidenceReconciliationClosureReceiptEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary = {
  totalFollowUps: 0,
  archiveReadinessReady: 0,
  needsArchiveReadiness: 0,
  archivedLocal: 0,
  archiveReadinessExceptions: 0,
  archiveReadinessNeedsRework: 0,
  receivedClosureReceipts: 0,
  closedReconciliationEvidence: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary = {
  totalFollowUps: 0,
  archiveClosureReady: 0,
  needsArchiveClosure: 0,
  closedLocalArchives: 0,
  archiveClosureExceptions: 0,
  archiveClosureNeedsRework: 0,
  archiveReadinessMarked: 0,
  receivedClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptReady: 0,
  needsArchiveClosureReceipt: 0,
  receivedArchiveClosureReceipts: 0,
  archiveClosureReceiptExceptions: 0,
  archiveClosureReceiptNeedsRework: 0,
  closedLocalArchives: 0,
  archiveReadinessMarked: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReady: 0,
  needsArchiveClosureReceiptHandoff: 0,
  handedOffArchiveClosureReceipts: 0,
  archiveClosureReceiptHandoffExceptions: 0,
  archiveClosureReceiptHandoffNeedsRework: 0,
  receivedArchiveClosureReceipts: 0,
  closedLocalArchives: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReady: 0,
  needsArchiveClosureReceiptHandoffReceipt: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  archiveClosureReceiptHandoffReceiptExceptions: 0,
  archiveClosureReceiptHandoffReceiptNeedsRework: 0,
  handedOffArchiveClosureReceipts: 0,
  receivedArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliation: 0,
  reconciledArchiveClosureReceiptHandoffReceipts: 0,
  archiveClosureReceiptHandoffReceiptReconciliationExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationNeedsRework: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  handedOffArchiveClosureReceipts: 0,
  receivedArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosure: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliations: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework: 0,
  reconciledArchiveClosureReceiptHandoffReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  handedOffArchiveClosureReceipts: 0,
  receivedArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliations: 0,
  reconciledArchiveClosureReceiptHandoffReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  handedOffArchiveClosureReceipts: 0,
  receivedArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: 0,
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliations: 0,
  reconciledArchiveClosureReceiptHandoffReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  handedOffArchiveClosureReceipts: 0,
  receivedArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNeedsRework: 0,
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliations: 0,
  reconciledArchiveClosureReceiptHandoffReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  handedOffArchiveClosureReceipts: 0,
  receivedArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNeedsRework: 0,
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliations: 0,
  reconciledArchiveClosureReceiptHandoffReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  handedOffArchiveClosureReceipts: 0,
  receivedArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff: 0,
  handedOffArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffs: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNeedsRework: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: 0,
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliations: 0,
  reconciledArchiveClosureReceiptHandoffReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  handedOffArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNeedsRework: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: 0,
  archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliations: 0,
  reconciledArchiveClosureReceiptHandoffReceipts: 0,
  receivedArchiveClosureReceiptHandoffReceipts: 0,
  handedOffArchiveClosureReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation: 0,
  reconciledArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationNeedsRework: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosures: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureNeedsRework: 0,
  reconciledArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureEvents: 0,
};

const EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_SUMMARY: FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary = {
  totalFollowUps: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: 0,
  needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt: 0,
  receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: 0,
  archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: 0,
  closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosures: 0,
  localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: 0,
};


function publicMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code === "validation_error") return "Проверьте поля: система клиники вернула ошибку.";
  return selfHostedPublicErrorText(error, "Не удалось сохранить изменения.");
}

const STATE_LABELS: Record<string, string> = {
  active: "активно",
  applied: "применено",
  archived: "в архиве",
  blocked: "заблокировано",
  clinic_admin: "администратор",
  closed: "закрыто",
  completed: "завершено",
  confirmed: "подтверждено",
  delivered: "доставлено",
  drifted: "есть расхождение",
  escalated: "передано",
  failed: "ошибка",
  handed_off: "передано",
  in_sync: "согласовано",
  missing_template: "нет шаблона",
  needs_attention: "нужен разбор",
  needs_policy_review: "нужен разбор правил",
  needs_review: "нужен разбор",
  needs_rework: "нужна доработка",
  no_exception: "без исключений",
  not_applied: "не применено",
  not_set: "не задано",
  open: "открыто",
  patient_reached: "пациент на связи",
  pending: "ожидает",
  ready: "готово",
  ready_for_archive: "готово к архиву",
  received: "получено",
  reconciled: "сверено",
  review_required: "нужен разбор",
  reviewed: "проверено",
  resolved: "закрыто",
  waiting_patient: "ждёт пациента",
};

function stateLabel(value: string | null | undefined): string {
  if (!value) return "не задано";
  return STATE_LABELS[value] ?? "уточнить";
}

function noteLabel(value: string | null | undefined): string {
  return value ? "отметка есть" : "нет отметки";
}

function versionLabel(value: string | null | undefined): string {
  return value ? "версия задана" : "не задано";
}

export function VisitWorkspaceLiveActions({ visit, lesions }: VisitWorkspaceLiveActionsProps) {
  const session = useSelfHostedApiSession();
  const configured = isSelfHostedApiConfigured(session);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [status, setStatus] = useState("Рабочая запись доступна после входа в систему клиники.");
  const [complaint, setComplaint] = useState(visit.complaint || "");
  const [visitStatus, setVisitStatus] = useState<"draft" | "in_progress" | "signed" | "cancelled">("in_progress");
  const [newLesionLabel, setNewLesionLabel] = useState("Новый очаг");
  const [newLesionZone, setNewLesionZone] = useState("");
  const [selectedLesionId, setSelectedLesionId] = useState(lesions[0]?.id ?? "");
  const [selectedLesionLabel, setSelectedLesionLabel] = useState(lesions[0]?.label ?? "");
  const [physicianText, setPhysicianText] = useState("");
  const [patientText, setPatientText] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpReason, setFollowUpReason] = useState("Контроль после визита");
  const [followUpPatientSummary, setFollowUpPatientSummary] = useState("");
  const [followUpInternalNote, setFollowUpInternalNote] = useState("");
  const [operationsSummary, setOperationsSummary] = useState<FollowUpOperationsSummary>(EMPTY_OPERATIONS_SUMMARY);
  const [outcomeSummary, setOutcomeSummary] = useState<FollowUpOutcomeQualitySummary>(EMPTY_OUTCOME_SUMMARY);
  const [clinicReviewSummary, setClinicReviewSummary] = useState<FollowUpClinicReviewSummary>(EMPTY_CLINIC_REVIEW_SUMMARY);
  const [sopValidationSummary, setSopValidationSummary] = useState<FollowUpSopValidationSummary>(EMPTY_SOP_VALIDATION_SUMMARY);
  const [sopPolicyTemplateSummary, setSopPolicyTemplateSummary] = useState<FollowUpSopPolicyTemplateSummary>(EMPTY_SOP_POLICY_TEMPLATE_SUMMARY);
  const [sopPolicyApplicationSummary, setSopPolicyApplicationSummary] = useState<FollowUpSopPolicyApplicationSummary>(EMPTY_SOP_POLICY_APPLICATION_SUMMARY);
  const [sopPolicyExceptionClosureSummary, setSopPolicyExceptionClosureSummary] = useState<FollowUpSopPolicyExceptionClosureSummary>(EMPTY_SOP_POLICY_EXCEPTION_CLOSURE_SUMMARY);
  const [sopPolicyAuditRollupSummary, setSopPolicyAuditRollupSummary] = useState<FollowUpSopPolicyAuditRollupSummary>(EMPTY_SOP_POLICY_AUDIT_ROLLUP_SUMMARY);
  const [sopPolicyGovernanceReadinessSummary, setSopPolicyGovernanceReadinessSummary] = useState<FollowUpSopPolicyGovernanceReadinessSummary>(EMPTY_SOP_POLICY_GOVERNANCE_READINESS_SUMMARY);
  const [sopPolicyGovernanceClosureSummary, setSopPolicyGovernanceClosureSummary] = useState<FollowUpSopPolicyGovernanceClosureSummary>(EMPTY_SOP_POLICY_GOVERNANCE_CLOSURE_SUMMARY);
  const [sopPolicyGovernanceEvidenceSummary, setSopPolicyGovernanceEvidenceSummary] = useState<FollowUpSopPolicyGovernanceEvidenceSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationSummary, setSopPolicyGovernanceEvidenceReconciliationSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureSummary, setSopPolicyGovernanceEvidenceReconciliationClosureSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_SUMMARY);
  const [sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary, setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary] = useState<FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary>(EMPTY_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_SUMMARY);
  const [operationsQueue, setOperationsQueue] = useState<SelfHostedClinicalFollowUp[]>([]);
  const [sopPolicyTemplates, setSopPolicyTemplates] = useState<SelfHostedFollowUpSopPolicyTemplate[]>([]);
  const [sopTemplateCode, setSopTemplateCode] = useState("правила-контроля");
  const [sopTemplateTitle, setSopTemplateTitle] = useState("Правила контрольного контакта");
  const [sopTemplateVersion, setSopTemplateVersion] = useState("версия-1");
  const [sopTemplateDescription, setSopTemplateDescription] = useState("");

  const selectedLesion = useMemo(
    () => lesions.find((lesion) => lesion.id === selectedLesionId) ?? null,
    [lesions, selectedLesionId],
  );

  const baseArgs = {
    apiBaseUrl: session.apiBaseUrl,
    apiToken: session.apiToken,
  };

  const activeSopPolicyTemplate = useMemo(
    () => sopPolicyTemplates.find((template) => template.active) ?? null,
    [sopPolicyTemplates],
  );
  const activeSopPolicyVersion = activeSopPolicyTemplate?.version || "clinic-local-v1";

  async function loadOperationsQueue() {
    if (!configured) return;
    setBusy((current) => current ?? "operations-load");
    const [summary, outcomes, clinicReview, sopValidation, sopPolicySummary, sopPolicyApplication, sopPolicyExceptions, sopPolicyAudit, sopPolicyGovernance, sopPolicyGovernanceClosure, sopPolicyGovernanceEvidence, sopPolicyGovernanceEvidenceReconciliation, sopPolicyGovernanceEvidenceReconciliationClosure, sopPolicyGovernanceEvidenceReconciliationClosureReceipt, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure, sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt, sopPolicies, queue] = await Promise.all([
      getSelfHostedClinicalFollowUpOperationsSummary(baseArgs),
      getSelfHostedClinicalFollowUpOutcomeQualitySummary(baseArgs),
      getSelfHostedClinicalFollowUpClinicReviewSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopValidationSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyTemplateSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyApplicationSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyExceptionClosureSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyAuditRollupSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceReadinessSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary(baseArgs),
      getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(baseArgs),
      listSelfHostedClinicalFollowUpSopPolicyTemplates({
        ...baseArgs,
        activeOnly: true,
      }),
      listSelfHostedClinicalFollowUpOperations({
        ...baseArgs,
        visitId: visit.id,
      }),
    ]);
    if (summary.ok) setOperationsSummary(summary.value);
    if (outcomes.ok) setOutcomeSummary(outcomes.value);
    if (clinicReview.ok) setClinicReviewSummary(clinicReview.value);
    if (sopValidation.ok) setSopValidationSummary(sopValidation.value);
    if (sopPolicySummary.ok) setSopPolicyTemplateSummary(sopPolicySummary.value);
    if (sopPolicyApplication.ok) setSopPolicyApplicationSummary(sopPolicyApplication.value);
    if (sopPolicyExceptions.ok) setSopPolicyExceptionClosureSummary(sopPolicyExceptions.value);
    if (sopPolicyAudit.ok) setSopPolicyAuditRollupSummary(sopPolicyAudit.value);
    if (sopPolicyGovernance.ok) setSopPolicyGovernanceReadinessSummary(sopPolicyGovernance.value);
    if (sopPolicyGovernanceClosure.ok) setSopPolicyGovernanceClosureSummary(sopPolicyGovernanceClosure.value);
    if (sopPolicyGovernanceEvidence.ok) setSopPolicyGovernanceEvidenceSummary(sopPolicyGovernanceEvidence.value);
    if (sopPolicyGovernanceEvidenceReconciliation.ok) setSopPolicyGovernanceEvidenceReconciliationSummary(sopPolicyGovernanceEvidenceReconciliation.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosure.ok) setSopPolicyGovernanceEvidenceReconciliationClosureSummary(sopPolicyGovernanceEvidenceReconciliationClosure.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceipt.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceipt.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure.value);
    if (sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt.ok) setSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt.value);
    if (sopPolicies.ok) setSopPolicyTemplates(sopPolicies.value);
    if (queue.ok) setOperationsQueue(queue.value);
    setBusy((current) => current === "operations-load" ? null : current);
    if (!summary.ok || !outcomes.ok || !clinicReview.ok || !sopValidation.ok || !sopPolicySummary.ok || !sopPolicyApplication.ok || !sopPolicyExceptions.ok || !sopPolicyAudit.ok || !sopPolicyGovernance.ok || !sopPolicyGovernanceClosure.ok || !sopPolicyGovernanceEvidence.ok || !sopPolicyGovernanceEvidenceReconciliation.ok || !sopPolicyGovernanceEvidenceReconciliationClosure.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceipt.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure.ok || !sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt.ok || !sopPolicies.ok || !queue.ok) {
      setStatus(publicMessage(summary.error || outcomes.error || clinicReview.error || sopValidation.error || sopPolicySummary.error || sopPolicyApplication.error || sopPolicyExceptions.error || sopPolicyAudit.error || sopPolicyGovernance.error || sopPolicyGovernanceClosure.error || sopPolicyGovernanceEvidence.error || sopPolicyGovernanceEvidenceReconciliation.error || sopPolicyGovernanceEvidenceReconciliationClosure.error || sopPolicyGovernanceEvidenceReconciliationClosureReceipt.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure.error || sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt.error || sopPolicies.error || queue.error));
    }
  }

  useEffect(() => {
    void loadOperationsQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, session.apiBaseUrl, session.apiToken, visit.id]);

  if (!configured) {
    return null;
  }

  async function submitVisit(event: FormEvent) {
    event.preventDefault();
    setBusy("visit");
    const result = await updateSelfHostedVisit({
      ...baseArgs,
      visitId: visit.id,
      payload: { chiefComplaint: complaint, status: visitStatus },
    });
    setBusy(null);
    setStatus(
      result.ok
        ? "Визит сохранён в системе клиники."
        : publicMessage(result.error),
    );
  }

  async function submitCreateLesion(event: FormEvent) {
    event.preventDefault();
    setBusy("create-lesion");
    const result = await createSelfHostedVisitLesion({
      ...baseArgs,
      visitId: visit.id,
      payload: {
        label: newLesionLabel,
        bodyZone: newLesionZone || null,
        status: "active",
      },
    });
    setBusy(null);
    setStatus(
      result.ok
        ? `Очаг ${result.value?.label ?? ""} создан в системе клиники.`
        : publicMessage(result.error),
    );
  }

  async function submitUpdateLesion(event: FormEvent) {
    event.preventDefault();
    if (!selectedLesionId) return;
    setBusy("update-lesion");
    const result = await updateSelfHostedVisitLesion({
      ...baseArgs,
      lesionId: selectedLesionId,
      payload: { label: selectedLesionLabel || selectedLesion?.label || "Очаг" },
    });
    setBusy(null);
    setStatus(
      result.ok
        ? `Очаг ${result.value?.label ?? ""} обновлён в системе клиники.`
        : publicMessage(result.error),
    );
  }

  async function submitArchiveLesion() {
    if (!selectedLesionId) return;
    setBusy("archive-lesion");
    const result = await archiveSelfHostedVisitLesion({
      ...baseArgs,
      lesionId: selectedLesionId,
      reason: "Архивировано из рабочего места визита",
    });
    setBusy(null);
    setStatus(
      result.ok
        ? `Очаг ${result.value?.label ?? selectedLesionId} архивирован в системе клиники.`
        : publicMessage(result.error),
    );
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    setBusy("report");
    const result = await updateSelfHostedVisitReport({
      ...baseArgs,
      visitId: visit.id,
      payload: buildSelfHostedVisitReportPayload({ physicianText, patientText }),
    });
    setBusy(null);
    setStatus(
      result.ok
        ? "Отчёт визита сохранён в системе клиники."
        : publicMessage(result.error),
    );
  }

  async function submitFollowUp(event: FormEvent) {
    event.preventDefault();
    setBusy("follow-up");
    const result = await createSelfHostedVisitFollowUp({
      ...baseArgs,
      visitId: visit.id,
      payload: {
        dueAt: followUpDueAt,
        reason: followUpReason,
        priority: "normal",
        patientSummary: followUpPatientSummary || null,
        internalNote: followUpInternalNote || null,
      },
    });
    setBusy(null);
    setStatus(
      result.ok
        ? "Контрольный контакт создан в системе клиники."
        : publicMessage(result.error),
    );
    if (result.ok) await loadOperationsQueue();
  }

  async function updateOperationsState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpOperations>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("operations-update");
    const result = await updateSelfHostedClinicalFollowUpOperations({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateQualityState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpQuality>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("quality-update");
    const result = await updateSelfHostedClinicalFollowUpQuality({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateClinicReviewState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpClinicReview>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("clinic-review-update");
    const result = await updateSelfHostedClinicalFollowUpClinicReview({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopValidationState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopValidation>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-validation-update");
    const result = await updateSelfHostedClinicalFollowUpSopValidation({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyApplicationState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyApplication>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-application-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyApplication({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyExceptionClosureState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyExceptionClosure>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-exception-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyExceptionClosure({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyAuditRollupState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyAuditRollup>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-audit-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyAuditRollup({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceReadinessState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceReadiness>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceReadiness({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceClosureState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-closure-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidence>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidence({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }


  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt-update");
    const result = await updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }


  async function submitSopPolicyTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("sop-policy-template-create");
    const result = await createSelfHostedClinicalFollowUpSopPolicyTemplate({
      ...baseArgs,
      payload: {
        code: sopTemplateCode,
        title: sopTemplateTitle,
        version: sopTemplateVersion,
        description: sopTemplateDescription || null,
        appliesTo: { workspace: "visit-follow-up" },
        requiredValidationStates: ["required", "blocked"],
        defaultValidationState: "required",
        exceptionAllowed: true,
        active: true,
      },
    });
    setBusy(null);
    setStatus(result.ok ? "Шаблон правил создан локально." : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  return (
    <section
      aria-label="Рабочая запись визита"
      className="border-b border-border bg-surface px-4 py-3"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="h-section">Рабочая запись визита</h2>
          <p className="text-meta">
            Изменения сохраняются в системе клиники. Снимки остаются в защищённом хранилище.
          </p>
        </div>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-[12px] text-muted-foreground"
        >
          {status}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        <form onSubmit={submitVisit} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Визит</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-visit-status">
            Статус
          </label>
          <select
            id="stage4h-visit-status"
            value={visitStatus}
            onChange={(event) => setVisitStatus(event.target.value as typeof visitStatus)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
          >
            <option value="draft">Черновик</option>
            <option value="in_progress">В работе</option>
            <option value="signed">Подписан</option>
            <option value="cancelled">Отменён</option>
          </select>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-complaint">
            Жалоба
          </label>
          <Textarea
            id="stage4h-complaint"
            value={complaint}
            onChange={(event) => setComplaint(event.target.value)}
            className="min-h-20 text-[13px]"
          />
          <Button type="submit" size="sm" disabled={busy === "visit"} className="min-h-11 text-[12px]">
            {busy === "visit" ? "Сохраняем…" : "Сохранить визит"}
          </Button>
        </form>

        <form onSubmit={submitCreateLesion} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Новый очаг</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-new-lesion-label">
            Метка
          </label>
          <Input
            id="stage4h-new-lesion-label"
            value={newLesionLabel}
            onChange={(event) => setNewLesionLabel(event.target.value)}
            className="h-9 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage4h-new-lesion-zone">
            Зона
          </label>
          <Input
            id="stage4h-new-lesion-zone"
            value={newLesionZone}
            onChange={(event) => setNewLesionZone(event.target.value)}
            className="h-9 text-[13px]"
            placeholder="спина, плечо, голень"
          />
          <Button type="submit" size="sm" disabled={busy === "create-lesion"} className="min-h-11 text-[12px]">
            {busy === "create-lesion" ? "Создаём…" : "Создать очаг"}
          </Button>
        </form>

        <form onSubmit={submitUpdateLesion} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Существующий очаг</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-lesion-select">
            Очаг
          </label>
          <select
            id="stage4h-lesion-select"
            value={selectedLesionId}
            onChange={(event) => {
              const nextId = event.target.value;
              const next = lesions.find((lesion) => lesion.id === nextId);
              setSelectedLesionId(nextId);
              setSelectedLesionLabel(next?.label ?? "");
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
          >
            {lesions.map((lesion) => (
              <option key={lesion.id} value={lesion.id}>
                {lesion.label}
              </option>
            ))}
          </select>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-lesion-label">
            Новая метка
          </label>
          <Input
            id="stage4h-lesion-label"
            value={selectedLesionLabel}
            onChange={(event) => setSelectedLesionLabel(event.target.value)}
            className="h-9 text-[13px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={!selectedLesionId || busy === "update-lesion"} className="min-h-11 text-[12px]">
              {busy === "update-lesion" ? "Сохраняем…" : "Обновить очаг"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!selectedLesionId || busy === "archive-lesion"}
              onClick={submitArchiveLesion}
              className="min-h-11 text-[12px]"
            >
              {busy === "archive-lesion" ? "Архивируем…" : "Архивировать"}
            </Button>
          </div>
        </form>

        <form onSubmit={submitReport} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Отчёт</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-physician-text">
            Текст для врача
          </label>
          <Textarea
            id="stage4h-physician-text"
            value={physicianText}
            onChange={(event) => setPhysicianText(event.target.value)}
            className="min-h-16 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage4h-patient-text">
            Текст для пациента
          </label>
          <Textarea
            id="stage4h-patient-text"
            value={patientText}
            onChange={(event) => setPatientText(event.target.value)}
            className="min-h-16 text-[13px]"
          />
          <Button type="submit" size="sm" disabled={busy === "report"} className="min-h-11 text-[12px]">
            {busy === "report" ? "Сохраняем…" : "Сохранить отчёт"}
          </Button>
        </form>

        <form onSubmit={submitFollowUp} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Контроль и связь</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage17-follow-up-due-at">
            Дата и время контроля
          </label>
          <Input
            id="stage17-follow-up-due-at"
            type="datetime-local"
            value={followUpDueAt}
            onChange={(event) => setFollowUpDueAt(event.target.value)}
            className="h-9 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage17-follow-up-reason">
            Причина
          </label>
          <Input
            id="stage17-follow-up-reason"
            value={followUpReason}
            onChange={(event) => setFollowUpReason(event.target.value)}
            className="h-9 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage17-follow-up-summary">
            Текст для пациента
          </label>
          <Textarea
            id="stage17-follow-up-summary"
            value={followUpPatientSummary}
            onChange={(event) => setFollowUpPatientSummary(event.target.value)}
            className="min-h-14 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage17-follow-up-note">
            Внутренняя заметка
          </label>
          <Textarea
            id="stage17-follow-up-note"
            value={followUpInternalNote}
            onChange={(event) => setFollowUpInternalNote(event.target.value)}
            className="min-h-14 text-[13px]"
          />
          <Button type="submit" size="sm" disabled={busy === "follow-up"} className="min-h-11 text-[12px]">
            {busy === "follow-up" ? "Создаём…" : "Создать контроль"}
          </Button>
        </form>
      </div>

      <section
        aria-label="Операционный контроль"
        className="mt-3 rounded-md border border-border bg-background p-3"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="h-section text-[14px]">Операционный контроль</h3>
            <p className="text-meta">
              Сроки, разбор и подтверждения доставки ведутся в системе клиники.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy === "operations-load"}
            onClick={() => void loadOperationsQueue()}
            className="min-h-11 text-[12px]"
          >
            {busy === "operations-load" ? "Обновляем…" : "Обновить очередь"}
          </Button>
        </div>
        <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-3 lg:grid-cols-6">
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Открыто</dt>
            <dd className="text-lg font-semibold">{operationsSummary.totalOpen}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Просрочено</dt>
            <dd className="text-lg font-semibold">{operationsSummary.overdue}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Ждёт пациента</dt>
            <dd className="text-lg font-semibold">{operationsSummary.waitingPatient}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Эскалации</dt>
            <dd className="text-lg font-semibold">{operationsSummary.escalated}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Ошибки доставки</dt>
            <dd className="text-lg font-semibold">{operationsSummary.deliveryFailed}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Доставка ждёт</dt>
            <dd className="text-lg font-semibold">{operationsSummary.deliveryPending}</dd>
          </div>
        </dl>

        <section
          aria-label="Качество закрытия"
          className="mt-3 rounded-md border border-border bg-muted/20 p-3"
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="h-section text-[13px]">Качество закрытия</h4>
              <p className="text-meta">
                Итоги основаны только на локальных данных качества и доставки.
              </p>
            </div>
            <span className="text-[12px] text-muted-foreground">
              Ждёт проверки: {outcomeSummary.qualityPending}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Закрыто всего</dt>
              <dd className="text-lg font-semibold">{outcomeSummary.closedFollowUps}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">С подтвержд.</dt>
              <dd className="text-lg font-semibold">{outcomeSummary.closedWithEvidence}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Без подтвержд.</dt>
              <dd className="text-lg font-semibold">{outcomeSummary.closedMissingEvidence}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Требует внимания</dt>
              <dd className="text-lg font-semibold">{outcomeSummary.qualityNeedsAttention}</dd>
            </div>
          </dl>
        </section>

        <section
          aria-label="Срок хранения и проверка клиники"
          className="mt-3 rounded-md border border-border bg-muted/20 p-3"
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="h-section text-[13px]">Срок хранения и проверка</h4>
              <p className="text-meta">
                Обзор хранит локальные отметки срока хранения и проверки клиники.
              </p>
            </div>
            <span className="text-[12px] text-muted-foreground">
              события: {clinicReviewSummary.localReviewEvents}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-5">
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Срок нужен</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.retentionDue}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Срок проверен</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.retentionReviewed}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Клиника ждёт</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.clinicReviewScheduled}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Клиника закрыла</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.clinicReviewCompleted}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Проверка правил</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.clinicNeedsPolicyReview}</dd>
            </div>
          </dl>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
            <div className="space-y-2">
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Шаблоны правил</dt>
                  <dd className="text-lg font-semibold">{sopPolicyTemplateSummary.totalTemplates}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Активные</dt>
                  <dd className="text-lg font-semibold">{sopPolicyTemplateSummary.activeTemplates}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">События правил</dt>
                  <dd className="text-lg font-semibold">{sopPolicyTemplateSummary.localPolicyEvents}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Применено</dt>
                  <dd className="text-lg font-semibold">{sopPolicyApplicationSummary.appliedTemplates}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужно применить</dt>
                  <dd className="text-lg font-semibold">{sopPolicyApplicationSummary.needsPolicyApplication}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Разбор отклонений</dt>
                  <dd className="text-lg font-semibold">{sopPolicyApplicationSummary.reviewRequired}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Открытые исключения</dt>
                  <dd className="text-lg font-semibold">{sopPolicyExceptionClosureSummary.openExceptions}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Отклонения</dt>
                  <dd className="text-lg font-semibold">{sopPolicyExceptionClosureSummary.unresolvedDrift}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрыто локально</dt>
                  <dd className="text-lg font-semibold">{sopPolicyExceptionClosureSummary.closedExceptions}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Аудит готов</dt>
                  <dd className="text-lg font-semibold">{sopPolicyAuditRollupSummary.auditReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужен аудит</dt>
                  <dd className="text-lg font-semibold">{sopPolicyAuditRollupSummary.needsAuditReview}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Аудит проверен</dt>
                  <dd className="text-lg font-semibold">{sopPolicyAuditRollupSummary.reviewedAudits}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Контроль готов</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceReadinessSummary.governanceReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужен контроль</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceReadinessSummary.needsGovernanceReview}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Контроль проверен</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceReadinessSummary.reviewedGovernance}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрытие готово</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceClosureSummary.closureReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужно закрытие</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceClosureSummary.needsClosureReview}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрыто локально</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceClosureSummary.closedGovernanceReviews}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Подтв. готовы</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceSummary.evidenceReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужны подтв.</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceSummary.needsEvidenceReview}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Выгружено локально</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceSummary.exportedGovernanceEvidence}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Сверка готова</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationSummary.reconciliationReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна сверка</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationSummary.needsReconciliation}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Сверено</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationSummary.reconciledGovernanceEvidence}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрытие сверки</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureSummary.reconciliationClosureReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужно закрыть сверку</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureSummary.needsReconciliationClosure}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Сверка закрыта</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureSummary.closedReconciliationEvidence}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанция готова</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary.closureReceiptReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна квитанция</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary.needsClosureReceipt}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанция получена</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary.receivedClosureReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Архив готов</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary.archiveReadinessReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужен архив</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary.needsArchiveReadiness}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Архивировано</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary.archivedLocal}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрытие готово</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary.archiveClosureReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужно закрытие</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary.needsArchiveClosure}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Архивы закрыты</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary.closedLocalArchives}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанция готова</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary.archiveClosureReceiptReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна квитанция</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary.needsArchiveClosureReceipt}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанции архива</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary.receivedArchiveClosureReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Передача готова</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary.archiveClosureReceiptHandoffReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна передача</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary.needsArchiveClosureReceiptHandoff}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанции переданы</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary.handedOffArchiveClosureReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Передача квитанций</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary.archiveClosureReceiptHandoffReceiptReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна передача квитанций</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary.needsArchiveClosureReceiptHandoffReceipt}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанции передачи</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary.receivedArchiveClosureReceiptHandoffReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Сверка передачи готова</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary.archiveClosureReceiptHandoffReceiptReconciliationReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна сверка квитанций</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary.needsArchiveClosureReceiptHandoffReceiptReconciliation}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанции сверены</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary.reconciledArchiveClosureReceiptHandoffReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрытие сверки готово</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужно закрыть сверку</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosure}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Сверка квитанций закрыта</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary.closedArchiveClosureReceiptHandoffReceiptReconciliations}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанция закрытия сверки</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна квитанция закрытия</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрытия сверки получены</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Архив сверки готов</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужен архив сверки</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Сверка архивирована</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary.archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрытие архива сверки</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужно закрыть архив сверки</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Архив сверки закрыт</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary.closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанция архива сверки</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна квитанция архива</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанции архива получены</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Передача архива готова</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна передача архива</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Архив передан</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary.handedOffArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffs}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанция передачи архива</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна квитанция передачи</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанции передачи получены</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Сверка передачи архива</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна сверка передачи</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Передача архива сверена</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary.reconciledArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Закрытие сверки передачи</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужно закрыть сверку передачи</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosure}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Сверка передачи закрыта</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureSummary.closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosures}</dd>
                </div>
              </dl>
              <dl className="grid gap-2 text-[12px] sm:grid-cols-3">
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанция закрытия передачи</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptReady}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Нужна квитанция закрытия передачи</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt}</dd>
                </div>
                <div className="surface-toolbar p-2">
                  <dt className="text-muted-foreground">Квитанции закрытия передачи получены</dt>
                  <dd className="text-lg font-semibold">{sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipts}</dd>
                </div>
              </dl>
              <div className="space-y-2 text-[12px]">
                {sopPolicyTemplates.length === 0 ? (
                  <p className="text-muted-foreground">Активный шаблон правил ещё не задан.</p>
                ) : sopPolicyTemplates.map((template) => (
                  <div key={template.id} className="surface-toolbar p-2">
                    <p className="font-medium">{template.title}</p>
                    <p className="text-muted-foreground">
                      {versionLabel(template.code)} · {versionLabel(template.version)} · по умолчанию:{" "}
                      {stateLabel(template.defaultValidationState)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <form onSubmit={submitSopPolicyTemplate} className="surface-toolbar space-y-2 p-3">
              <h5 className="h-section text-[12px]">Шаблон правил</h5>
              <label className="block text-[12px] font-medium" htmlFor="stage22-sop-policy-code">
                Код
              </label>
              <Input
                id="stage22-sop-policy-code"
                value={sopTemplateCode}
                onChange={(event) => setSopTemplateCode(event.target.value)}
                className="min-h-11 text-[12px]"
              />
              <label className="block text-[12px] font-medium" htmlFor="stage22-sop-policy-title">
                Название
              </label>
              <Input
                id="stage22-sop-policy-title"
                value={sopTemplateTitle}
                onChange={(event) => setSopTemplateTitle(event.target.value)}
                className="min-h-11 text-[12px]"
              />
              <label className="block text-[12px] font-medium" htmlFor="stage22-sop-policy-version">
                Версия
              </label>
              <Input
                id="stage22-sop-policy-version"
                value={sopTemplateVersion}
                onChange={(event) => setSopTemplateVersion(event.target.value)}
                className="min-h-11 text-[12px]"
              />
              <label className="block text-[12px] font-medium" htmlFor="stage22-sop-policy-description">
                Описание
              </label>
              <Textarea
                id="stage22-sop-policy-description"
                value={sopTemplateDescription}
                onChange={(event) => setSopTemplateDescription(event.target.value)}
                className="min-h-14 text-[12px]"
              />
              <Button type="submit" size="sm" disabled={busy === "sop-policy-template-create"} className="min-h-11 text-[12px]">
                {busy === "sop-policy-template-create" ? "Создаём…" : "Создать шаблон правил"}
              </Button>
            </form>
          </div>
        </section>

        <section
          aria-label="Проверка правил контроля"
          className="mt-3 rounded-md border border-border bg-muted/20 p-3"
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="h-section text-[13px]">Проверка правил</h4>
              <p className="text-meta">
                Проверка правил хранится локально и не является клиническим выводом.
              </p>
            </div>
            <span className="text-[12px] text-muted-foreground">
              События правил: {sopValidationSummary.localSopEvents}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-5">
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Правила нужны</dt>
              <dd className="text-lg font-semibold">{sopValidationSummary.sopRequired}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Правила проверены</dt>
              <dd className="text-lg font-semibold">{sopValidationSummary.sopValidated}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Исключения</dt>
              <dd className="text-lg font-semibold">{sopValidationSummary.sopExceptions}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Заблокировано</dt>
              <dd className="text-lg font-semibold">{sopValidationSummary.sopBlocked}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Открытые передачи</dt>
              <dd className="text-lg font-semibold">{sopValidationSummary.openEscalated}</dd>
            </div>
          </dl>
        </section>

        <div className="mt-3 space-y-2" aria-label="Очередь контроля по визиту">
          {operationsQueue.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Для этого визита нет открытых задач контроля.</p>
          ) : operationsQueue.map((item) => (
            <article key={item.id} className="surface-toolbar flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{item.reason || "Контрольный контакт"}</p>
                <p className="text-[12px] text-muted-foreground">
                  Разбор: {stateLabel(item.triageState)} · передача: {stateLabel(item.escalationLevel)} · доставка: {stateLabel(item.deliveryState)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Итог: {stateLabel(item.resolutionOutcome)} · проверка: {stateLabel(item.qualityReviewState)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Хранение: {stateLabel(item.retentionReviewState)} · проверка клиники: {stateLabel(item.clinicReviewState)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Правила: {stateLabel(item.sopValidationState)} · версия: {versionLabel(item.sopPolicyVersion)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Сверка правил: {stateLabel(item.sopPolicyDriftState)} · шаблон: {versionLabel(item.sopPolicyTemplateCode)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Исключения: {stateLabel(item.sopPolicyExceptionState)} · {noteLabel(item.sopPolicyExceptionResolution || item.sopPolicyExceptionReason)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Аудит: {stateLabel(item.sopPolicyAuditState)} · {noteLabel(item.sopPolicyAuditNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Контроль: {stateLabel(item.sopPolicyGovernanceState)} · {noteLabel(item.sopPolicyGovernanceNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Закрытие: {stateLabel(item.sopPolicyGovernanceClosureState)} · {noteLabel(item.sopPolicyGovernanceClosureNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Подтверждение: {stateLabel(item.sopPolicyGovernanceEvidenceState)} · {noteLabel(item.sopPolicyGovernanceEvidenceNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Сверка: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Закрытие сверки: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Получение закрытия: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Готовность архива: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Закрытие архива: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Получение архива: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Передача архива: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Подтверждение передачи: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Сверка передачи: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Закрытие передачи: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Получение передачи: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Готовность итогового архива: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Закрытие итогового архива: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Передача итогового архива: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Получение итоговой передачи: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Сверка итоговой передачи: {stateLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationState)} · {noteLabel(item.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationNote)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "operations-update"}
                  onClick={() => void updateOperationsState(
                    item.id,
                    { triageState: "waiting_patient", deliveryState: "pending", operationsNote: "Waiting for patient confirmation." },
                    "Контроль переведён в ожидание пациента.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Ждёт пациента
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "operations-update"}
                  onClick={() => void updateOperationsState(
                    item.id,
                    { triageState: "escalated", escalationLevel: "clinic_admin", operationsNote: "Escalated locally to clinic admin." },
                    "Контроль передан администратору клиники.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Эскалировать
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === "operations-update"}
                  onClick={() => void updateOperationsState(
                    item.id,
                    { triageState: "resolved", deliveryState: "delivered", deliveryEvidence: { channel: "portal", state: "confirmed" } },
                    "Контроль закрыт в очереди.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Закрыть
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "quality-update"}
                  onClick={() => void updateQualityState(
                    item.id,
                    {
                      resolutionOutcome: "patient_reached",
                      qualityReviewState: "reviewed",
                      qualityReviewNote: "Reviewed locally in clinical workspace.",
                    },
                    "Контроль отмечен как проверенный.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Проверено
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "quality-update"}
                  onClick={() => void updateQualityState(
                    item.id,
                    {
                      resolutionOutcome: "clinical_escalation",
                      qualityReviewState: "needs_attention",
                      qualityReviewNote: "Needs local clinical review.",
                    },
                    "Контроль помечен как требующий внимания.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Требует внимания
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "clinic-review-update"}
                  onClick={() => void updateClinicReviewState(
                    item.id,
                    {
                      retentionReviewState: "reviewed",
                      retentionReviewNote: "Retention reviewed locally after follow-up closure.",
                    },
                    "Проверка срока хранения отмечена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Хранение проверено
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "clinic-review-update"}
                  onClick={() => void updateClinicReviewState(
                    item.id,
                    {
                      clinicReviewState: "needs_policy_review",
                      clinicReviewNote: "Needs clinic policy review before SOP closure.",
                    },
                    "Контроль отправлен на разбор правил клиники.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Разбор правил
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "clinic-review-update"}
                  onClick={() => void updateClinicReviewState(
                    item.id,
                    {
                      clinicReviewState: "completed",
                      clinicReviewNote: "Clinic review completed locally.",
                    },
                    "Проверка клиники завершена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Проверка клиники
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-validation-update"}
                  onClick={() => void updateSopValidationState(
                    item.id,
                    {
                      sopValidationState: "validated",
                      sopPolicyVersion: activeSopPolicyVersion,
                    },
                    "Проверка правил подтверждена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Правила проверены
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-validation-update"}
                  onClick={() => void updateSopValidationState(
                    item.id,
                    {
                      sopValidationState: "exception",
                      sopPolicyVersion: activeSopPolicyVersion,
                      sopExceptionReason: "Clinic-specific exception recorded locally.",
                    },
                    "Исключение по правилам записано локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Исключение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!activeSopPolicyTemplate || busy === "sop-policy-application-update"}
                  onClick={() => activeSopPolicyTemplate && void updateSopPolicyApplicationState(
                    item.id,
                    {
                      sopPolicyTemplateId: activeSopPolicyTemplate.id,
                      sopPolicyDriftState: "in_sync",
                    },
                    "Шаблон правил применён локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Применить правила
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-application-update"}
                  onClick={() => void updateSopPolicyApplicationState(
                    item.id,
                    {
                      sopPolicyDriftState: "review_required",
                      sopPolicyDriftReason: "Local SOP policy drift review requested from workspace.",
                    },
                    "Контроль отправлен на сверку правил.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Сверка правил
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-exception-update"}
                  onClick={() => void updateSopPolicyExceptionClosureState(
                    item.id,
                    {
                      sopPolicyExceptionState: "open",
                      sopPolicyExceptionReason: "Local SOP policy exception opened from workspace.",
                    },
                    "Исключение по правилам открыто локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Открыть исключение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-exception-update"}
                  onClick={() => void updateSopPolicyExceptionClosureState(
                    item.id,
                    {
                      sopPolicyExceptionState: "accepted",
                      sopPolicyExceptionReason: item.sopPolicyExceptionReason || "Local SOP policy exception accepted from workspace.",
                      sopPolicyExceptionResolution: "Local exception accepted and closed for clinic policy review.",
                    },
                    "Исключение по правилам закрыто локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Закрыть исключение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-audit-update"}
                  onClick={() => void updateSopPolicyAuditRollupState(
                    item.id,
                    {
                      sopPolicyAuditState: "reviewed",
                      sopPolicyAuditNote: "Local SOP policy audit reviewed from workspace.",
                    },
                    "Аудит правил отмечен как проверенный.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Аудит проверен
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-audit-update"}
                  onClick={() => void updateSopPolicyAuditRollupState(
                    item.id,
                    {
                      sopPolicyAuditState: "needs_followup",
                      sopPolicyAuditNote: "Local SOP policy audit needs follow-up from workspace.",
                    },
                    "Аудит правил отправлен на повторный контроль.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Повторный аудит
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-update"}
                  onClick={() => void updateSopPolicyGovernanceReadinessState(
                    item.id,
                    {
                      sopPolicyGovernanceState: "reviewed",
                      sopPolicyGovernanceNote: "Local SOP policy governance review completed from workspace.",
                    },
                    "Контроль правил отмечен как проверенный.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Контроль проверен
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-update"}
                  onClick={() => void updateSopPolicyGovernanceReadinessState(
                    item.id,
                    {
                      sopPolicyGovernanceState: "needs_followup",
                      sopPolicyGovernanceNote: "Local SOP policy governance review needs follow-up from workspace.",
                    },
                    "Контроль правил отправлен на повторный разбор.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Повторный контроль
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceClosureState: "closed",
                      sopPolicyGovernanceClosureNote: "Local SOP policy governance closure completed from workspace.",
                    },
                    "Закрытие контроля правил выполнено локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Закрыть контроль
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceClosureState: "needs_followup",
                      sopPolicyGovernanceClosureNote: "Local SOP policy governance closure needs follow-up from workspace.",
                    },
                    "Закрытие контроля правил отправлено на повторный разбор.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Повторное закрытие
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceState: "exported",
                      sopPolicyGovernanceEvidenceNote: "Local SOP policy governance evidence export marked from workspace.",
                    },
                    "Подтверждение правил подготовлено локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Подготовить подтверждение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceState: "needs_followup",
                      sopPolicyGovernanceEvidenceNote: "Local SOP policy governance evidence export needs follow-up from workspace.",
                    },
                    "Подтверждение правил отправлено на повторный разбор.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Повторить подтверждение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
                      sopPolicyGovernanceEvidenceReconciliationNote: "Local SOP policy governance evidence reconciled from workspace.",
                    },
                    "Сверка подтверждений выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Сверить подтверждение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationState: "mismatch",
                      sopPolicyGovernanceEvidenceReconciliationNote: "Local SOP policy governance evidence reconciliation mismatch recorded from workspace.",
                    },
                    "Сверка подтверждений помечена как несоответствие.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Есть расхождение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
                      sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closed from workspace.",
                    },
                    "Сверка подтверждений закрыта локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Закрыть сверку
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure needs rework from workspace.",
                    },
                    "Закрытие сверки отправлено на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать закрытие
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt recorded from workspace.",
                    },
                    "Получение закрытия принято локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Отметить получение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt needs rework from workspace.",
                    },
                    "Получение закрытия сверки отправлено на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать получение
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked from workspace.",
                    },
                    "Готовность архива отмечена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Архив готов
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness needs rework from workspace.",
                    },
                    "Готовность архива отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать архив
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closed from workspace.",
                    },
                    "Архив закрыт локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Закрыть архив
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure needs rework from workspace.",
                    },
                    "Закрытие архива отправлено на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать закрытие архива
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded from workspace.",
                    },
                    "Получение архива отмечено локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Получить архив
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt needs rework from workspace.",
                    },
                    "Получение архива отправлено на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать получение архива
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed from workspace.",
                    },
                    "Передача архива выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Передать архив
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff needs rework from workspace.",
                    },
                    "Передача архива отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать передачу
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded from workspace.",
                    },
                    "Получение передачи архива отмечено локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Получить передачу
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt needs rework from workspace.",
                    },
                    "Получение передачи архива отправлено на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать получение передачи
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation recorded from workspace.",
                    },
                    "Сверка передачи архива выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Сверить передачу
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation needs rework from workspace.",
                    },
                    "Сверка передачи архива отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать сверку передачи
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure recorded from workspace.",
                    },
                    "Закрытие сверки передачи выполнено локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Закрыть сверку передачи
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure needs rework from workspace.",
                    },
                    "Закрытие сверки передачи отправлено на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать закрытие сверки
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt recorded from workspace.",
                    },
                    "Получение закрытия передачи отмечено локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Получить закрытие сверки
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt needs rework from workspace.",
                    },
                    "Получение закрытия передачи отправлено на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать получение закрытия
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "archived",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness archived from workspace.",
                    },
                    "Операция контроля выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Архивировать сверку
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness needs rework from workspace.",
                    },
                    "Операция контроля отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать архив сверки
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure closed from workspace.",
                    },
                    "Операция контроля выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Закрыть архив сверки
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure needs rework from workspace.",
                    },
                    "Операция контроля отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать закрытие архива
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "received",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt received from workspace.",
                    },
                    "Операция контроля выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Получить закрытие архива
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt needs rework from workspace.",
                    },
                    "Операция контроля отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать получение архива
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState: "handed_off",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff recorded from workspace.",
                    },
                    "Операция контроля выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Передать архив сверки
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff needs rework from workspace.",
                    },
                    "Операция контроля отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать передачу архива
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState: "received",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt recorded from workspace.",
                    },
                    "Операция контроля выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Получить передачу архива
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt needs rework from workspace.",
                    },
                    "Операция контроля отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать получение передачи
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationState: "reconciled",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation recorded from workspace.",
                    },
                    "Операция контроля выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Сверить передачу архива
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation needs rework from workspace.",
                    },
                    "Операция контроля отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать сверку передачи
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure recorded from workspace.",
                    },
                    "Операция контроля выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Закрыть сверку передачи
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure needs rework from workspace.",
                    },
                    "Операция контроля отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать закрытие сверки
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt recorded from workspace.",
                    },
                    "Операция контроля выполнена локально.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Получить закрытие передачи
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt-update"}
                  onClick={() => void updateSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState(
                    item.id,
                    {
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "needs_rework",
                      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt needs rework from workspace.",
                    },
                    "Операция контроля отправлена на доработку.",
                  )}
                  className="min-h-11 text-[12px]"
                >
                  Доработать получение закрытия
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
