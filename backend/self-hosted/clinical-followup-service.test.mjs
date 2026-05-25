import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createClinicalFollowUpService,
  normalizeClinicalFollowUpClinicReviewUpdatePayload,
  normalizeClinicalFollowUpCreatePayload,
  normalizeClinicalFollowUpMessagePayload,
  normalizeClinicalFollowUpOperationsUpdatePayload,
  normalizeClinicalFollowUpQualityUpdatePayload,
  normalizeClinicalFollowUpSopPolicyApplicationPayload,
  normalizeClinicalFollowUpSopPolicyAuditRollupPayload,
  normalizeClinicalFollowUpSopPolicyExceptionClosurePayload,
  normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload,
  normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload,
  normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload,
  normalizeClinicalFollowUpSopPolicyTemplatePayload,
  normalizeClinicalFollowUpSopValidationUpdatePayload,
  normalizeClinicalFollowUpUpdatePayload,
} from "./clinical-followup-service.mjs";
import { ForbiddenError } from "./rbac.mjs";

const DOCTOR = {
  userId: "10000000-0000-4000-8000-000000000101",
  roles: ["doctor"],
  clinicIds: ["10000000-0000-4000-8000-000000000001"],
};
const PATIENT = {
  userId: "10000000-0000-4000-8000-000000000901",
  roles: ["patient"],
  clinicIds: [],
};
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const FOLLOW_UP_ID = "10000000-0000-4000-8000-000000000701";
const TEMPLATE_ID = "10000000-0000-4000-8000-000000000901";

function createService({ repositoryOverrides = {}, auditEvents = [] } = {}) {
  const followUp = {
    id: FOLLOW_UP_ID,
    clinicId: "10000000-0000-4000-8000-000000000001",
    patientId: "10000000-0000-4000-8000-000000000201",
    visitId: VISIT_ID,
    status: "planned",
    priority: "normal",
    reason: "Контроль",
  };
  return createClinicalFollowUpService({
    clinicalFollowUpRepository: {
      async listClinicalFollowUps() {
        return { items: [followUp], limit: 50, offset: 0, source: "postgres" };
      },
      async createClinicalFollowUp() {
        return followUp;
      },
      async updateClinicalFollowUp() {
        return { ...followUp, status: "completed" };
      },
      async createClinicalFollowUpMessage() {
        return { id: "message-1", followUpId: FOLLOW_UP_ID, patientVisible: true };
      },
      async listPatientFollowUps() {
        return { items: [{ id: FOLLOW_UP_ID, reason: "Контроль" }], source: "postgres" };
      },
      async createPatientFollowUpMessage() {
        return { id: "message-2", followUpId: FOLLOW_UP_ID, direction: "patient_to_clinic" };
      },
      async listClinicalFollowUpOperations() {
        return { items: [{ ...followUp, triageState: "escalated", deliveryState: "failed" }], limit: 50, offset: 0, source: "postgres" };
      },
      async getClinicalFollowUpOperationsSummary() {
        return { totalOpen: 2, overdue: 1, waitingPatient: 1, escalated: 1, deliveryFailed: 1, deliveryPending: 0, source: "postgres" };
      },
      async getClinicalFollowUpOutcomeQualitySummary() {
        return {
          totalFollowUps: 4,
          closedFollowUps: 2,
          closedWithEvidence: 1,
          closedMissingEvidence: 1,
          qualityReviewed: 1,
          qualityPending: 2,
          qualityNeedsAttention: 1,
          source: "postgres",
        };
      },
      async getClinicalFollowUpClinicReviewSummary() {
        return {
          totalFollowUps: 4,
          retentionDue: 1,
          retentionReviewed: 1,
          retentionArchived: 0,
          clinicReviewScheduled: 1,
          clinicReviewCompleted: 1,
          clinicNeedsPolicyReview: 1,
          qualityNeedsAttention: 1,
          closedMissingEvidence: 1,
          localReviewEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopValidationSummary() {
        return {
          totalFollowUps: 4,
          sopRequired: 2,
          sopValidated: 1,
          sopExceptions: 1,
          sopBlocked: 0,
          clinicNeedsPolicyReview: 1,
          qualityNeedsAttention: 1,
          openEscalated: 1,
          closedMissingEvidence: 1,
          localSopEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyTemplateSummary() {
        return {
          totalTemplates: 2,
          activeTemplates: 1,
          inactiveTemplates: 1,
          exceptionsAllowed: 1,
          requiredByDefault: 1,
          localPolicyEvents: 3,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyApplicationSummary() {
        return {
          totalFollowUps: 4,
          activeTemplates: 1,
          appliedTemplates: 1,
          notChecked: 1,
          inSync: 1,
          drifted: 0,
          missingTemplate: 0,
          reviewRequired: 1,
          needsPolicyApplication: 1,
          localApplicationEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyExceptionClosureSummary() {
        return {
          totalFollowUps: 4,
          openExceptions: 1,
          closedExceptions: 1,
          acceptedExceptions: 1,
          rejectedExceptions: 0,
          unresolvedDrift: 1,
          unclosedValidationExceptions: 1,
          closedWithLocalResolution: 1,
          localExceptionEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyAuditRollupSummary() {
        return {
          totalFollowUps: 4,
          auditReady: 2,
          needsAuditReview: 1,
          reviewedAudits: 1,
          needsFollowUp: 0,
          unresolvedPolicyDrift: 1,
          openExceptions: 1,
          missingPolicyTemplate: 1,
          localPolicyAuditEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceReadinessSummary() {
        return {
          totalFollowUps: 4,
          governanceReady: 1,
          needsGovernanceReview: 1,
          reviewedGovernance: 1,
          governanceNeedsFollowUp: 0,
          reviewedPolicyAudits: 1,
          unresolvedPolicyDrift: 1,
          openExceptions: 0,
          localGovernanceEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceClosureSummary() {
        return {
          totalFollowUps: 4,
          closureReady: 1,
          needsClosureReview: 1,
          closedGovernanceReviews: 1,
          closureNeedsFollowUp: 0,
          reviewedGovernance: 1,
          unresolvedPolicyDrift: 0,
          openExceptions: 0,
          localGovernanceClosureEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceSummary() {
        return {
          totalFollowUps: 4,
          evidenceReady: 1,
          needsEvidenceReview: 1,
          exportedGovernanceEvidence: 1,
          evidenceNeedsFollowUp: 0,
          closedGovernanceReviews: 1,
          unresolvedPolicyDrift: 0,
          openExceptions: 0,
          localGovernanceEvidenceEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary() {
        return {
          totalFollowUps: 4,
          reconciliationReady: 1,
          needsReconciliation: 1,
          reconciledGovernanceEvidence: 1,
          evidenceMismatches: 0,
          reconciliationNeedsFollowUp: 0,
          exportedGovernanceEvidence: 1,
          closedGovernanceReviews: 1,
          localGovernanceEvidenceReconciliationEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary() {
        return {
          totalFollowUps: 4,
          reconciliationClosureReady: 1,
          needsReconciliationClosure: 1,
          closedReconciliationEvidence: 1,
          reconciliationClosureExceptions: 0,
          reconciliationClosureNeedsRework: 0,
          reconciledGovernanceEvidence: 1,
          openReconciliationMismatches: 0,
          localGovernanceEvidenceReconciliationClosureEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary() {
        return {
          totalFollowUps: 4,
          closureReceiptReady: 1,
          needsClosureReceipt: 1,
          receivedClosureReceipts: 1,
          closureReceiptExceptions: 0,
          closureReceiptNeedsRework: 0,
          closedReconciliationEvidence: 1,
          reconciledGovernanceEvidence: 1,
          localGovernanceEvidenceReconciliationClosureReceiptEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary() {
        return {
          totalFollowUps: 4,
          archiveReadinessReady: 1,
          needsArchiveReadiness: 1,
          archivedLocal: 0,
          archiveReadinessExceptions: 0,
          archiveReadinessNeedsRework: 0,
          receivedClosureReceipts: 1,
          closedReconciliationEvidence: 1,
          localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary() {
        return {
          totalFollowUps: 4,
          archiveClosureReady: 1,
          needsArchiveClosure: 1,
          closedLocalArchives: 1,
          archiveClosureExceptions: 0,
          archiveClosureNeedsRework: 0,
          archiveReadinessMarked: 1,
          receivedClosureReceipts: 1,
          localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary() {
        return {
          totalFollowUps: 4,
          archiveClosureReceiptReady: 1,
          needsArchiveClosureReceipt: 1,
          receivedArchiveClosureReceipts: 1,
          archiveClosureReceiptExceptions: 0,
          archiveClosureReceiptNeedsRework: 0,
          closedLocalArchives: 1,
          archiveReadinessMarked: 1,
          localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary() {
        return {
          totalFollowUps: 4,
          archiveClosureReceiptHandoffReady: 1,
          needsArchiveClosureReceiptHandoff: 1,
          handedOffArchiveClosureReceipts: 1,
          archiveClosureReceiptHandoffExceptions: 0,
          archiveClosureReceiptHandoffNeedsRework: 0,
          receivedArchiveClosureReceipts: 1,
          closedLocalArchives: 1,
          localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary() {
        return {
          totalFollowUps: 4,
          archiveClosureReceiptHandoffReceiptReady: 1,
          needsArchiveClosureReceiptHandoffReceipt: 1,
          receivedArchiveClosureReceiptHandoffReceipts: 1,
          archiveClosureReceiptHandoffReceiptExceptions: 0,
          archiveClosureReceiptHandoffReceiptNeedsRework: 0,
          handedOffArchiveClosureReceipts: 1,
          receivedArchiveClosureReceipts: 1,
          localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: 2,
          source: "postgres",
        };
      },
      async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary() {
        return {
          totalFollowUps: 4,
          archiveClosureReceiptHandoffReceiptReconciliationReady: 1,
          needsArchiveClosureReceiptHandoffReceiptReconciliation: 1,
          reconciledArchiveClosureReceiptHandoffReceipts: 1,
          archiveClosureReceiptHandoffReceiptReconciliationExceptions: 0,
          archiveClosureReceiptHandoffReceiptReconciliationNeedsRework: 0,
          receivedArchiveClosureReceiptHandoffReceipts: 1,
          handedOffArchiveClosureReceipts: 1,
          receivedArchiveClosureReceipts: 1,
          localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: 2,
          source: "postgres",
        };
      },
      async listClinicalFollowUpSopPolicyTemplates() {
        return {
          items: [{
            id: TEMPLATE_ID,
            clinicId: "10000000-0000-4000-8000-000000000001",
            code: "followup-standard",
            title: "Follow-up standard SOP",
            version: "clinic-local-v1",
            requiredValidationStates: ["required", "blocked"],
            defaultValidationState: "required",
            exceptionAllowed: true,
            active: true,
          }],
          limit: 25,
          offset: 0,
          source: "postgres",
        };
      },
      async createClinicalFollowUpSopPolicyTemplate() {
        return {
          id: TEMPLATE_ID,
          clinicId: "10000000-0000-4000-8000-000000000001",
          code: "followup-standard",
          title: "Follow-up standard SOP",
          version: "clinic-local-v1",
          requiredValidationStates: ["required", "blocked"],
          defaultValidationState: "required",
          exceptionAllowed: true,
          active: true,
        };
      },
      async updateClinicalFollowUpSopPolicyTemplate() {
        return {
          id: TEMPLATE_ID,
          clinicId: "10000000-0000-4000-8000-000000000001",
          code: "followup-standard",
          title: "Follow-up standard SOP",
          version: "clinic-local-v2",
          requiredValidationStates: ["required", "blocked"],
          defaultValidationState: "required",
          exceptionAllowed: true,
          active: true,
        };
      },
      async updateClinicalFollowUpOperations() {
        return { ...followUp, triageState: "resolved", escalationLevel: "none", deliveryState: "delivered" };
      },
      async updateClinicalFollowUpQuality() {
        return {
          ...followUp,
          resolutionOutcome: "patient_reached",
          qualityReviewState: "reviewed",
          qualityReviewNote: "QA ok.",
        };
      },
      async updateClinicalFollowUpClinicReview() {
        return {
          ...followUp,
          retentionReviewState: "reviewed",
          retentionReviewNote: "Retention ok.",
          clinicReviewState: "completed",
          clinicReviewNote: "Clinic review complete.",
        };
      },
      async updateClinicalFollowUpSopValidation() {
        return {
          ...followUp,
          sopValidationState: "validated",
          sopPolicyVersion: "clinic-local-v1",
          sopExceptionReason: null,
        };
      },
      async updateClinicalFollowUpSopPolicyApplication() {
        return {
          ...followUp,
          sopValidationState: "required",
          sopPolicyVersion: "clinic-local-v1",
          sopPolicyTemplateId: TEMPLATE_ID,
          sopPolicyTemplateCode: "followup-standard",
          sopPolicyDriftState: "in_sync",
          sopPolicyDriftReason: "Applied active local SOP policy template.",
        };
      },
      async updateClinicalFollowUpSopPolicyExceptionClosure() {
        return {
          ...followUp,
          sopValidationState: "exception",
          sopPolicyDriftState: "review_required",
          sopPolicyExceptionState: "accepted",
          sopPolicyExceptionReason: "Local exception accepted.",
          sopPolicyExceptionResolution: "Closed inside clinic policy review.",
        };
      },
      async updateClinicalFollowUpSopPolicyAuditRollup() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyAuditNote: "Local SOP policy audit reviewed.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceReadiness() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceClosure() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceClosureNote: "Local SOP policy governance closure completed.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidence() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceNote: "Local SOP policy governance evidence export marked.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationNote: "Local SOP policy governance evidence reconciled.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure completed.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt recorded.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closed.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded.",
        };
      },
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation() {
        return {
          ...followUp,
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation recorded.",
        };
      },
      ...repositoryOverrides,
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: `audit-${auditEvents.length}` };
      },
    },
  });
}

test("validates create, update, and message payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpCreatePayload({
      dueAt: "2026-05-30T10:00:00.000Z",
      reason: "  Контроль  ",
      priority: "urgent",
    }),
    {
      dueAt: "2026-05-30T10:00:00.000Z",
      reason: "Контроль",
      patientSummary: null,
      internalNote: null,
      priority: "urgent",
      assignedUserId: null,
    },
  );

  assert.deepEqual(normalizeClinicalFollowUpUpdatePayload({ status: "completed" }), {
    status: "completed",
  });
  assert.deepEqual(normalizeClinicalFollowUpMessagePayload({ body: " Ответ " }), {
    body: "Ответ",
    patientVisible: true,
  });
  assert.throws(() => normalizeClinicalFollowUpCreatePayload({ reason: "" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpUpdatePayload({}), /validation/i);
});

test("validates operations hardening payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpOperationsUpdatePayload({
      triageState: "escalated",
      escalationLevel: "clinic_admin",
      deliveryState: "failed",
      slaDueAt: "2026-05-22T10:00:00.000Z",
      deliveryEvidence: { channel: "portal", state: "failed", secret: "ignored" },
      operationsNote: "  Call patient  ",
    }),
    {
      triageState: "escalated",
      escalationLevel: "clinic_admin",
      deliveryState: "failed",
      slaDueAt: "2026-05-22T10:00:00.000Z",
      deliveryEvidence: { channel: "portal", state: "failed", checkedAt: null },
      operationsNote: "Call patient",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpOperationsUpdatePayload({ triageState: "bad" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpOperationsUpdatePayload({}), /validation/i);
});

test("validates outcome quality payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpQualityUpdatePayload({
      resolutionOutcome: "patient_reached",
      qualityReviewState: "reviewed",
      qualityReviewNote: "  QA ok.  ",
    }),
    {
      resolutionOutcome: "patient_reached",
      qualityReviewState: "reviewed",
      qualityReviewNote: "QA ok.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpQualityUpdatePayload({ qualityReviewState: "bad" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpQualityUpdatePayload({}), /validation/i);
});

test("validates retention and clinic review payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpClinicReviewUpdatePayload({
      retentionReviewState: "reviewed",
      retentionReviewNote: "  Retention ok.  ",
      clinicReviewState: "completed",
      clinicReviewNote: "  Clinic review complete.  ",
    }),
    {
      retentionReviewState: "reviewed",
      retentionReviewNote: "Retention ok.",
      clinicReviewState: "completed",
      clinicReviewNote: "Clinic review complete.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpClinicReviewUpdatePayload({ clinicReviewState: "bad" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpClinicReviewUpdatePayload({}), /validation/i);
});

test("validates clinic-specific SOP validation payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopValidationUpdatePayload({
      sopValidationState: "validated",
      sopPolicyVersion: "  clinic-local-v1  ",
      sopExceptionReason: "  Exception not needed.  ",
    }),
    {
      sopValidationState: "validated",
      sopPolicyVersion: "clinic-local-v1",
      sopExceptionReason: "Exception not needed.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopValidationUpdatePayload({ sopValidationState: "bad" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopValidationUpdatePayload({}), /validation/i);
});

test("validates local SOP policy template payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyTemplatePayload({
      code: "  followup-standard  ",
      title: "  Follow-up standard SOP  ",
      version: "  clinic-local-v1  ",
      description: "  Local only.  ",
      appliesTo: { workspace: "visit-follow-up" },
      requiredValidationStates: ["required", "blocked", "required"],
      defaultValidationState: "required",
      exceptionAllowed: true,
      active: true,
    }, { create: true }),
    {
      clinicId: null,
      code: "followup-standard",
      title: "Follow-up standard SOP",
      version: "clinic-local-v1",
      description: "Local only.",
      appliesTo: { workspace: "visit-follow-up" },
      requiredValidationStates: ["required", "blocked"],
      defaultValidationState: "required",
      exceptionAllowed: true,
      active: true,
    },
  );
  assert.deepEqual(normalizeClinicalFollowUpSopPolicyTemplatePayload({ active: false }), { active: false });
  assert.throws(() => normalizeClinicalFollowUpSopPolicyTemplatePayload({ code: "bad code" }, { create: true }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyTemplatePayload({}), /validation/i);
});

test("validates local SOP policy application payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyApplicationPayload({
      sopPolicyTemplateId: TEMPLATE_ID,
      sopPolicyTemplateCode: "  followup-standard  ",
      sopPolicyVersion: "  clinic-local-v1  ",
      sopValidationState: "required",
      sopPolicyDriftState: "review_required",
      sopPolicyDriftReason: "  Review active local policy drift.  ",
    }),
    {
      sopPolicyTemplateId: TEMPLATE_ID,
      sopPolicyTemplateCode: "followup-standard",
      sopPolicyVersion: "clinic-local-v1",
      sopValidationState: "required",
      sopPolicyDriftState: "review_required",
      sopPolicyDriftReason: "Review active local policy drift.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyApplicationPayload({ sopPolicyTemplateId: "bad-id" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyApplicationPayload({ sopPolicyDriftState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyApplicationPayload({}), /validation/i);
});

test("validates local SOP policy exception closure payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyExceptionClosurePayload({
      sopPolicyExceptionState: "accepted",
      sopPolicyExceptionReason: "  Local policy drift accepted.  ",
      sopPolicyExceptionResolution: "  Closed inside clinic policy review.  ",
    }),
    {
      sopPolicyExceptionState: "accepted",
      sopPolicyExceptionReason: "Local policy drift accepted.",
      sopPolicyExceptionResolution: "Closed inside clinic policy review.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyExceptionClosurePayload({ sopPolicyExceptionState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyExceptionClosurePayload({ sopPolicyExceptionState: "accepted" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyExceptionClosurePayload({}), /validation/i);
});

test("validates local SOP policy audit rollup payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyAuditRollupPayload({
      sopPolicyAuditState: "reviewed",
      sopPolicyAuditNote: "  Local audit reviewed.  ",
    }),
    {
      sopPolicyAuditState: "reviewed",
      sopPolicyAuditNote: "Local audit reviewed.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyAuditRollupPayload({ sopPolicyAuditState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyAuditRollupPayload({ sopPolicyAuditState: "needs_followup" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyAuditRollupPayload({}), /validation/i);
});

test("validates local SOP policy governance readiness payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload({
      sopPolicyGovernanceState: "reviewed",
      sopPolicyGovernanceNote: "  Local governance reviewed.  ",
    }),
    {
      sopPolicyGovernanceState: "reviewed",
      sopPolicyGovernanceNote: "Local governance reviewed.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload({ sopPolicyGovernanceState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload({ sopPolicyGovernanceState: "needs_followup" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload({}), /validation/i);
});

test("validates local SOP policy governance closure payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload({
      sopPolicyGovernanceClosureState: "closed",
      sopPolicyGovernanceClosureNote: "  Local governance closure completed.  ",
    }),
    {
      sopPolicyGovernanceClosureState: "closed",
      sopPolicyGovernanceClosureNote: "Local governance closure completed.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload({ sopPolicyGovernanceClosureState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload({ sopPolicyGovernanceClosureState: "needs_followup" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload({}), /validation/i);
});

test("validates local SOP policy governance evidence payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload({
      sopPolicyGovernanceEvidenceState: "exported",
      sopPolicyGovernanceEvidenceNote: "  Local governance evidence export marked.  ",
    }),
    {
      sopPolicyGovernanceEvidenceState: "exported",
      sopPolicyGovernanceEvidenceNote: "Local governance evidence export marked.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload({ sopPolicyGovernanceEvidenceState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload({ sopPolicyGovernanceEvidenceState: "needs_followup" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload({
      sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
      sopPolicyGovernanceEvidenceReconciliationNote: "  Local governance evidence reconciled.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
      sopPolicyGovernanceEvidenceReconciliationNote: "Local governance evidence reconciled.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload({ sopPolicyGovernanceEvidenceReconciliationState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload({ sopPolicyGovernanceEvidenceReconciliationState: "mismatch" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload({
      sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureNote: "  Local governance evidence reconciliation closed.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local governance evidence reconciliation closed.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload({ sopPolicyGovernanceEvidenceReconciliationClosureState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload({ sopPolicyGovernanceEvidenceReconciliationClosureState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "  Local governance evidence reconciliation closure receipt recorded.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local governance evidence reconciliation closure receipt recorded.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt archive readiness payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "  Local archive readiness marked.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local archive readiness marked.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt archive closure payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "  Local archive closed.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local archive closed.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt archive closure receipt payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "  Local archive closure receipt recorded.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local archive closure receipt recorded.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "  Local archive closure receipt handoff completed.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local archive closure receipt handoff completed.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "  Local archive closure receipt handoff receipt recorded.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local archive closure receipt handoff receipt recorded.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "  Local archive closure receipt handoff receipt reconciliation recorded.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "Local archive closure receipt handoff receipt reconciliation recorded.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: "  Local archive readiness closure closed.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: "Local archive readiness closure closed.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload({}), /validation/i);
});

test("validates local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload({
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: "  Local archive readiness closure receipt received.  ",
    }),
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: "Local archive readiness closure receipt received.",
    },
  );
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "external_approved" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload({ sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "needs_rework" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload({}), /validation/i);
});

test("doctor can create, update, list, and message clinical follow-ups with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const created = await service.createClinicalFollowUp(
    VISIT_ID,
    { dueAt: "2026-05-30T10:00:00.000Z", reason: "Контроль" },
    DOCTOR,
    { correlationId: "corr-1" },
  );
  const listed = await service.listClinicalFollowUps({ status: "planned" }, DOCTOR, { correlationId: "corr-2" });
  const updated = await service.updateClinicalFollowUp(
    FOLLOW_UP_ID,
    { status: "completed" },
    DOCTOR,
    { correlationId: "corr-3" },
  );
  const message = await service.createClinicalFollowUpMessage(
    FOLLOW_UP_ID,
    { body: "Контроль назначен." },
    DOCTOR,
    { correlationId: "corr-4" },
  );

  assert.equal(created.followUp.id, FOLLOW_UP_ID);
  assert.equal(listed.result.items.length, 1);
  assert.equal(updated.followUp.status, "completed");
  assert.equal(message.message.patientVisible, true);
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.create",
      "clinical_follow_up.list",
      "clinical_follow_up.update",
      "clinical_follow_up.message.create",
    ],
  );
});

test("patient can list visible follow-ups and reply through portal scope", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const list = await service.listPatientFollowUps(PATIENT, { correlationId: "corr-5" });
  const message = await service.createPatientFollowUpMessage(
    FOLLOW_UP_ID,
    { body: "Подтверждаю." },
    PATIENT,
    { correlationId: "corr-6" },
  );

  assert.equal(list.result.items[0].id, FOLLOW_UP_ID);
  assert.equal(message.message.direction, "patient_to_clinic");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["patient_portal.follow_up.list", "patient_portal.follow_up.message.create"],
  );
});

test("doctor can list, summarize, and update operations queue with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const list = await service.listClinicalFollowUpOperations(
    { triageState: "escalated" },
    DOCTOR,
    { correlationId: "ops-1" },
  );
  const summary = await service.getClinicalFollowUpOperationsSummary(
    { now: "2026-05-22T10:00:00.000Z" },
    DOCTOR,
    { correlationId: "ops-2" },
  );
  const updated = await service.updateClinicalFollowUpOperations(
    FOLLOW_UP_ID,
    { triageState: "resolved", deliveryState: "delivered" },
    DOCTOR,
    { correlationId: "ops-3" },
  );

  assert.equal(list.result.items[0].triageState, "escalated");
  assert.equal(summary.summary.overdue, 1);
  assert.equal(updated.followUp.triageState, "resolved");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.operations.list",
      "clinical_follow_up.operations.summary",
      "clinical_follow_up.operations.update",
    ],
  );
});

test("doctor can summarize outcomes and update quality review with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpOutcomeQualitySummary(
    { now: "2026-05-22T10:00:00.000Z" },
    DOCTOR,
    { correlationId: "qa-1" },
  );
  const updated = await service.updateClinicalFollowUpQuality(
    FOLLOW_UP_ID,
    {
      resolutionOutcome: "patient_reached",
      qualityReviewState: "reviewed",
      qualityReviewNote: "QA ok.",
    },
    DOCTOR,
    { correlationId: "qa-2" },
  );

  assert.equal(summary.summary.closedMissingEvidence, 1);
  assert.equal(updated.followUp.qualityReviewState, "reviewed");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.outcomes.summary",
      "clinical_follow_up.quality.update",
    ],
  );
});

test("doctor can summarize retention review and update clinic review with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpClinicReviewSummary(
    { now: "2026-05-22T10:00:00.000Z" },
    DOCTOR,
    { correlationId: "review-1" },
  );
  const updated = await service.updateClinicalFollowUpClinicReview(
    FOLLOW_UP_ID,
    {
      retentionReviewState: "reviewed",
      retentionReviewNote: "Retention ok.",
      clinicReviewState: "completed",
      clinicReviewNote: "Clinic review complete.",
    },
    DOCTOR,
    { correlationId: "review-2" },
  );

  assert.equal(summary.summary.retentionDue, 1);
  assert.equal(updated.followUp.clinicReviewState, "completed");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.clinic_review.summary",
      "clinical_follow_up.clinic_review.update",
    ],
  );
});

test("doctor can summarize and update SOP validation with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopValidationSummary(
    {},
    DOCTOR,
    { correlationId: "sop-1" },
  );
  const updated = await service.updateClinicalFollowUpSopValidation(
    FOLLOW_UP_ID,
    {
      sopValidationState: "validated",
      sopPolicyVersion: "clinic-local-v1",
    },
    DOCTOR,
    { correlationId: "sop-2" },
  );

  assert.equal(summary.summary.sopRequired, 2);
  assert.equal(updated.followUp.sopValidationState, "validated");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_validation.summary",
      "clinical_follow_up.sop_validation.update",
    ],
  );
});

test("doctor can list, create, and update SOP policy templates with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyTemplateSummary(
    {},
    DOCTOR,
    { correlationId: "policy-1" },
  );
  const list = await service.listClinicalFollowUpSopPolicyTemplates(
    { activeOnly: true },
    DOCTOR,
    { correlationId: "policy-2" },
  );
  const created = await service.createClinicalFollowUpSopPolicyTemplate(
    {
      code: "followup-standard",
      title: "Follow-up standard SOP",
      version: "clinic-local-v1",
      requiredValidationStates: ["required", "blocked"],
      defaultValidationState: "required",
    },
    DOCTOR,
    { correlationId: "policy-3" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyTemplate(
    TEMPLATE_ID,
    { version: "clinic-local-v2" },
    DOCTOR,
    { correlationId: "policy-4" },
  );

  assert.equal(summary.summary.activeTemplates, 1);
  assert.equal(list.result.items[0].id, TEMPLATE_ID);
  assert.equal(created.template.version, "clinic-local-v1");
  assert.equal(updated.template.version, "clinic-local-v2");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_template.summary",
      "clinical_follow_up.sop_policy_template.list",
      "clinical_follow_up.sop_policy_template.create",
      "clinical_follow_up.sop_policy_template.update",
    ],
  );
});

test("doctor can summarize and update SOP policy application with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyApplicationSummary(
    {},
    DOCTOR,
    { correlationId: "policy-application-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyApplication(
    FOLLOW_UP_ID,
    {
      sopPolicyTemplateId: TEMPLATE_ID,
      sopPolicyDriftState: "in_sync",
    },
    DOCTOR,
    { correlationId: "policy-application-2" },
  );

  assert.equal(summary.summary.needsPolicyApplication, 1);
  assert.equal(updated.followUp.sopPolicyTemplateId, TEMPLATE_ID);
  assert.equal(updated.followUp.sopPolicyDriftState, "in_sync");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_application.summary",
      "clinical_follow_up.sop_policy_application.update",
    ],
  );
});

test("doctor can summarize and update SOP policy exception closure with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyExceptionClosureSummary(
    {},
    DOCTOR,
    { correlationId: "policy-exception-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyExceptionClosure(
    FOLLOW_UP_ID,
    {
      sopPolicyExceptionState: "accepted",
      sopPolicyExceptionReason: "Local exception accepted.",
      sopPolicyExceptionResolution: "Closed inside clinic policy review.",
    },
    DOCTOR,
    { correlationId: "policy-exception-2" },
  );

  assert.equal(summary.summary.openExceptions, 1);
  assert.equal(updated.followUp.sopPolicyExceptionState, "accepted");
  assert.equal(updated.followUp.sopPolicyExceptionResolution, "Closed inside clinic policy review.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_exception_closure.summary",
      "clinical_follow_up.sop_policy_exception_closure.update",
    ],
  );
});

test("doctor can summarize and update SOP policy audit rollup with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyAuditRollupSummary(
    {},
    DOCTOR,
    { correlationId: "policy-audit-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyAuditRollup(
    FOLLOW_UP_ID,
    {
      sopPolicyAuditState: "reviewed",
      sopPolicyAuditNote: "Local SOP policy audit reviewed.",
    },
    DOCTOR,
    { correlationId: "policy-audit-2" },
  );

  assert.equal(summary.summary.auditReady, 2);
  assert.equal(summary.summary.needsAuditReview, 1);
  assert.equal(updated.followUp.sopPolicyAuditState, "reviewed");
  assert.equal(updated.followUp.sopPolicyAuditNote, "Local SOP policy audit reviewed.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_audit_rollup.summary",
      "clinical_follow_up.sop_policy_audit_rollup.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance readiness with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceReadinessSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceReadiness(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceState: "reviewed",
      sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
    },
    DOCTOR,
    { correlationId: "policy-governance-2" },
  );

  assert.equal(summary.summary.governanceReady, 1);
  assert.equal(summary.summary.needsGovernanceReview, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceState, "reviewed");
  assert.equal(updated.followUp.sopPolicyGovernanceNote, "Local SOP policy governance reviewed.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_readiness.summary",
      "clinical_follow_up.sop_policy_governance_readiness.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance closure with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceClosureSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-closure-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceClosure(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceClosureState: "closed",
      sopPolicyGovernanceClosureNote: "Local SOP policy governance closure completed.",
    },
    DOCTOR,
    { correlationId: "policy-governance-closure-2" },
  );

  assert.equal(summary.summary.closureReady, 1);
  assert.equal(summary.summary.needsClosureReview, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceClosureState, "closed");
  assert.equal(updated.followUp.sopPolicyGovernanceClosureNote, "Local SOP policy governance closure completed.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_closure.summary",
      "clinical_follow_up.sop_policy_governance_closure.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidence(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceState: "exported",
      sopPolicyGovernanceEvidenceNote: "Local SOP policy governance evidence export marked.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-2" },
  );

  assert.equal(summary.summary.evidenceReady, 1);
  assert.equal(summary.summary.needsEvidenceReview, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceState, "exported");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceNote, "Local SOP policy governance evidence export marked.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence.summary",
      "clinical_follow_up.sop_policy_governance_evidence.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
      sopPolicyGovernanceEvidenceReconciliationNote: "Local SOP policy governance evidence reconciled.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-2" },
  );

  assert.equal(summary.summary.reconciliationReady, 1);
  assert.equal(summary.summary.needsReconciliation, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationState, "reconciled");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationNote, "Local SOP policy governance evidence reconciled.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation closure with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure completed.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-2" },
  );

  assert.equal(summary.summary.reconciliationClosureReady, 1);
  assert.equal(summary.summary.needsReconciliationClosure, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureState, "closed");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureNote, "Local SOP policy governance evidence reconciliation closure completed.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation closure receipt with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt recorded.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-2" },
  );

  assert.equal(summary.summary.closureReceiptReady, 1);
  assert.equal(summary.summary.needsClosureReceipt, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState, "received");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote, "Local SOP policy governance evidence reconciliation closure receipt recorded.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation closure receipt archive readiness with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-readiness-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-readiness-2" },
  );

  assert.equal(summary.summary.archiveReadinessReady, 1);
  assert.equal(summary.summary.needsArchiveReadiness, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState, "ready");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote, "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation closure receipt archive closure with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closed.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-2" },
  );

  assert.equal(summary.summary.archiveClosureReady, 1);
  assert.equal(summary.summary.needsArchiveClosure, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState, "closed");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote, "Local SOP policy governance evidence reconciliation closure receipt archive closed.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation closure receipt archive closure receipt with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-2" },
  );

  assert.equal(summary.summary.archiveClosureReceiptReady, 1);
  assert.equal(summary.summary.needsArchiveClosureReceipt, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState, "received");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-2" },
  );

  assert.equal(summary.summary.archiveClosureReceiptHandoffReady, 1);
  assert.equal(summary.summary.needsArchiveClosureReceiptHandoff, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState, "handed_off");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-2" },
  );

  assert.equal(summary.summary.archiveClosureReceiptHandoffReceiptReady, 1);
  assert.equal(summary.summary.needsArchiveClosureReceiptHandoffReceipt, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState, "received");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.update",
    ],
  );
});

test("doctor can summarize and update SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const summary = await service.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(
    {},
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-1" },
  );
  const updated = await service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation(
    FOLLOW_UP_ID,
    {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation recorded.",
    },
    DOCTOR,
    { correlationId: "policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-2" },
  );

  assert.equal(summary.summary.archiveClosureReceiptHandoffReceiptReconciliationReady, 1);
  assert.equal(summary.summary.needsArchiveClosureReceiptHandoffReceiptReconciliation, 1);
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState, "reconciled");
  assert.equal(updated.followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote, "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation recorded.");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation.summary",
      "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation.update",
    ],
  );
});

test("operator cannot mutate SOP policy templates and missing template maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpSopPolicyTemplate() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.createClinicalFollowUpSopPolicyTemplate(
      { code: "followup-standard", title: "Follow-up standard SOP", version: "clinic-local-v1" },
      { ...DOCTOR, roles: ["operator"] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyTemplate(TEMPLATE_ID, { version: "clinic-local-v2" }, DOCTOR),
    /SOP policy template was not found/i,
  );
});

test("operator cannot update SOP policy application and missing active template maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpSopPolicyApplication() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyApplication(
      FOLLOW_UP_ID,
      { sopPolicyTemplateId: TEMPLATE_ID },
      { userId: "op", roles: ["operator"], clinicIds: [] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyApplication(FOLLOW_UP_ID, { sopPolicyTemplateId: TEMPLATE_ID }, DOCTOR),
    /active SOP policy template was not found/i,
  );
});

test("operator cannot update SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff and missing handoff maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff(
      FOLLOW_UP_ID,
      { sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off" },
      { userId: "op", roles: ["operator"], clinicIds: [] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff(
      FOLLOW_UP_ID,
      { sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off" },
      DOCTOR,
    ),
    /archive closure receipt handoff was not found/i,
  );
});

test("operator cannot update SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt and missing handoff receipt maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt(
      FOLLOW_UP_ID,
      { sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received" },
      { userId: "op", roles: ["operator"], clinicIds: [] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt(
      FOLLOW_UP_ID,
      { sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received" },
      DOCTOR,
    ),
    /archive closure receipt handoff receipt was not found/i,
  );
});

test("operator cannot update SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation and missing reconciliation maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation(
      FOLLOW_UP_ID,
      { sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled" },
      { userId: "op", roles: ["operator"], clinicIds: [] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation(
      FOLLOW_UP_ID,
      { sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled" },
      DOCTOR,
    ),
    /archive closure receipt handoff receipt reconciliation was not found/i,
  );
});

test("operator cannot update SOP policy exception closure and missing exception maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpSopPolicyExceptionClosure() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyExceptionClosure(
      FOLLOW_UP_ID,
      {
        sopPolicyExceptionState: "accepted",
        sopPolicyExceptionResolution: "Closed inside clinic policy review.",
      },
      { userId: "op", roles: ["operator"], clinicIds: [] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpSopPolicyExceptionClosure(
      FOLLOW_UP_ID,
      {
        sopPolicyExceptionState: "accepted",
        sopPolicyExceptionResolution: "Closed inside clinic policy review.",
      },
      DOCTOR,
    ),
    /SOP policy exception was not found/i,
  );
});

test("operator cannot update SOP validation and missing SOP row maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpSopValidation() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpSopValidation(
      FOLLOW_UP_ID,
      { sopValidationState: "validated" },
      { ...DOCTOR, roles: ["operator"] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpSopValidation(FOLLOW_UP_ID, { sopValidationState: "validated" }, DOCTOR),
    /Clinical follow-up was not found/i,
  );
});

test("operator cannot update clinic review and missing clinic review row maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpClinicReview() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpClinicReview(
      FOLLOW_UP_ID,
      { clinicReviewState: "completed" },
      { ...DOCTOR, roles: ["operator"] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpClinicReview(FOLLOW_UP_ID, { clinicReviewState: "completed" }, DOCTOR),
    /Clinical follow-up was not found/i,
  );
});

test("operator cannot update quality review and missing quality row maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpQuality() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpQuality(
      FOLLOW_UP_ID,
      { qualityReviewState: "reviewed" },
      { ...DOCTOR, roles: ["operator"] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpQuality(FOLLOW_UP_ID, { qualityReviewState: "reviewed" }, DOCTOR),
    /Clinical follow-up was not found/i,
  );
});

test("operator cannot update operations queue and missing operation row maps to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateClinicalFollowUpOperations() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.updateClinicalFollowUpOperations(
      FOLLOW_UP_ID,
      { triageState: "resolved" },
      { ...DOCTOR, roles: ["operator"] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateClinicalFollowUpOperations(FOLLOW_UP_ID, { triageState: "resolved" }, DOCTOR),
    /Clinical follow-up was not found/i,
  );
});

test("operator cannot mutate clinical follow-ups and missing rows map to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async createClinicalFollowUp() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.createClinicalFollowUp(
      VISIT_ID,
      { dueAt: "2026-05-30T10:00:00.000Z", reason: "Контроль" },
      { ...DOCTOR, roles: ["operator"] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.createClinicalFollowUp(
      VISIT_ID,
      { dueAt: "2026-05-30T10:00:00.000Z", reason: "Контроль" },
      DOCTOR,
    ),
    /Visit was not found/i,
  );
});
