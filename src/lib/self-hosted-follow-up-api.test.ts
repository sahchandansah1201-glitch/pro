import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSelfHostedClinicalFollowUpMessage,
  createSelfHostedClinicalFollowUpSopPolicyTemplate,
  createSelfHostedPatientFollowUpMessage,
  createSelfHostedVisitFollowUp,
  getSelfHostedClinicalFollowUpClinicReviewSummary,
  getSelfHostedClinicalFollowUpOutcomeQualitySummary,
  getSelfHostedClinicalFollowUpOperationsSummary,
  getSelfHostedClinicalFollowUpSopPolicyTemplateSummary,
  getSelfHostedClinicalFollowUpSopPolicyApplicationSummary,
  getSelfHostedClinicalFollowUpSopPolicyAuditRollupSummary,
  getSelfHostedClinicalFollowUpSopPolicyExceptionClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary,
  getSelfHostedClinicalFollowUpSopPolicyGovernanceReadinessSummary,
  getSelfHostedClinicalFollowUpSopValidationSummary,
  listSelfHostedClinicalFollowUps,
  listSelfHostedClinicalFollowUpOperations,
  listSelfHostedClinicalFollowUpSopPolicyTemplates,
  listSelfHostedPatientFollowUps,
  toSelfHostedClinicalFollowUp,
  toSelfHostedFollowUpSopPolicyTemplate,
  toFollowUpClinicReviewSummary,
  toFollowUpOutcomeQualitySummary,
  toFollowUpOperationsSummary,
  toFollowUpSopPolicyTemplateSummary,
  toFollowUpSopPolicyApplicationSummary,
  toFollowUpSopPolicyAuditRollupSummary,
  toFollowUpSopPolicyExceptionClosureSummary,
  toFollowUpSopPolicyGovernanceClosureSummary,
  toFollowUpSopPolicyGovernanceReadinessSummary,
  toFollowUpSopValidationSummary,
  updateSelfHostedClinicalFollowUpClinicReview,
  updateSelfHostedClinicalFollowUpQuality,
  updateSelfHostedClinicalFollowUpOperations,
  updateSelfHostedClinicalFollowUpSopPolicyTemplate,
  updateSelfHostedClinicalFollowUpSopPolicyApplication,
  updateSelfHostedClinicalFollowUpSopPolicyAuditRollup,
  updateSelfHostedClinicalFollowUpSopPolicyExceptionClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure,
  updateSelfHostedClinicalFollowUpSopPolicyGovernanceReadiness,
  updateSelfHostedClinicalFollowUpSopValidation,
  updateSelfHostedClinicalFollowUp,
} from "./self-hosted-follow-up-api";

const FOLLOW_UP = {
  id: "fu-1",
  visitId: "visit-1",
  dueAt: "2026-05-30T10:00:00.000Z",
  status: "sent",
  priority: "high",
  reason: "Контроль",
  patientSummary: "Пациент увидит это",
  internalNote: "Doctor-only",
  triageState: "escalated",
  escalationLevel: "clinic_admin",
  slaDueAt: "2026-05-29T10:00:00.000Z",
  deliveryState: "failed",
  deliveryAttempts: 2,
  deliveryEvidence: { channel: "portal", state: "failed" },
  operationsNote: "Позвонить пациенту",
  resolutionOutcome: "clinical_escalation",
  qualityReviewState: "needs_attention",
  qualityReviewNote: "Нужен разбор.",
  retentionReviewState: "due",
  retentionReviewNote: "Нужен retention review.",
  clinicReviewState: "needs_policy_review",
  clinicReviewNote: "Нужен SOP review.",
  sopValidationState: "required",
  sopPolicyVersion: "clinic-local-v1",
  sopPolicyTemplateId: "template-1",
  sopPolicyTemplateCode: "followup-standard",
  sopPolicyDriftState: "in_sync",
  sopPolicyDriftReason: "Applied active local SOP policy template.",
  sopPolicyExceptionState: "open",
  sopPolicyExceptionReason: "Clinic-specific policy exception opened.",
  sopPolicyExceptionResolution: null,
  sopPolicyAuditState: "not_started",
  sopPolicyAuditNote: null,
  sopPolicyGovernanceState: "not_started",
  sopPolicyGovernanceNote: null,
  sopPolicyGovernanceClosureState: "not_started",
  sopPolicyGovernanceClosureNote: null,
  sopExceptionReason: "Clinic-specific validation needed.",
  messageCount: 1,
  latestMessage: {
    id: "message-1",
    followUpId: "fu-1",
    senderRole: "doctor",
    direction: "clinic_to_patient",
    body: "Напоминание",
    patientVisible: true,
  },
};

const SOP_POLICY_TEMPLATE = {
  id: "template-1",
  clinicId: "clinic-1",
  code: "followup-standard",
  title: "Follow-up standard SOP",
  version: "clinic-local-v1",
  description: "Local only.",
  appliesTo: { workspace: "visit-follow-up" },
  requiredValidationStates: ["required", "blocked"],
  defaultValidationState: "required",
  exceptionAllowed: true,
  active: true,
};

describe("self-hosted follow-up API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes follow-up DTOs and messages", () => {
    const item = toSelfHostedClinicalFollowUp(FOLLOW_UP);
    expect(item.id).toBe("fu-1");
    expect(item.status).toBe("sent");
    expect(item.priority).toBe("high");
    expect(item.latestMessage?.body).toBe("Напоминание");
    expect(item.internalNote).toBe("Doctor-only");
    expect(item.triageState).toBe("escalated");
    expect(item.escalationLevel).toBe("clinic_admin");
    expect(item.deliveryState).toBe("failed");
    expect(item.deliveryAttempts).toBe(2);
    expect(item.resolutionOutcome).toBe("clinical_escalation");
    expect(item.qualityReviewState).toBe("needs_attention");
    expect(item.retentionReviewState).toBe("due");
    expect(item.clinicReviewState).toBe("needs_policy_review");
    expect(item.sopValidationState).toBe("required");
    expect(item.sopPolicyVersion).toBe("clinic-local-v1");
    expect(item.sopPolicyDriftState).toBe("in_sync");
    expect(item.sopPolicyExceptionState).toBe("open");
    expect(item.sopPolicyAuditState).toBe("not_started");
    expect(item.sopPolicyGovernanceState).toBe("not_started");
    expect(item.sopPolicyGovernanceClosureState).toBe("not_started");
    expect(toSelfHostedFollowUpSopPolicyTemplate(SOP_POLICY_TEMPLATE).version).toBe("clinic-local-v1");
    expect(toFollowUpOperationsSummary({ totalOpen: 2, overdue: 1 }).overdue).toBe(1);
    expect(toFollowUpOutcomeQualitySummary({ closedMissingEvidence: 2 }).closedMissingEvidence).toBe(2);
    expect(toFollowUpClinicReviewSummary({ retentionDue: 3 }).retentionDue).toBe(3);
    expect(toFollowUpSopValidationSummary({ sopRequired: 4 }).sopRequired).toBe(4);
    expect(toFollowUpSopPolicyTemplateSummary({ activeTemplates: 1 }).activeTemplates).toBe(1);
    expect(toFollowUpSopPolicyApplicationSummary({ reviewRequired: 2 }).reviewRequired).toBe(2);
    expect(toFollowUpSopPolicyExceptionClosureSummary({ openExceptions: 2 }).openExceptions).toBe(2);
    expect(toFollowUpSopPolicyAuditRollupSummary({ auditReady: 2 }).auditReady).toBe(2);
    expect(toFollowUpSopPolicyGovernanceReadinessSummary({ governanceReady: 2 }).governanceReady).toBe(2);
    expect(toFollowUpSopPolicyGovernanceClosureSummary({ closureReady: 2 }).closureReady).toBe(2);
  });

  it("lists staff and patient follow-ups with bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [FOLLOW_UP] }),
    } as Response);

    const staff = await listSelfHostedClinicalFollowUps({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "token",
      status: "sent",
      visitId: "visit-1",
    });
    const patient = await listSelfHostedPatientFollowUps({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "token",
    });

    expect(staff.ok).toBe(true);
    expect(patient.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/clinical/follow-ups?status=sent&visitId=visit-1");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/v1/me/follow-ups");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer token" });
  });

  it("creates, updates, and messages follow-ups", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ item: FOLLOW_UP }),
    } as Response);
    const args = { apiBaseUrl: "http://localhost:3001", apiToken: "token" };

    await createSelfHostedVisitFollowUp({
      ...args,
      visitId: "visit-1",
      payload: { dueAt: "2026-05-30T10:00:00.000Z", reason: "Контроль" },
    });
    await updateSelfHostedClinicalFollowUp({
      ...args,
      followUpId: "fu-1",
      payload: { status: "completed" },
    });
    await createSelfHostedClinicalFollowUpMessage({
      ...args,
      followUpId: "fu-1",
      payload: { body: "Готово" },
    });
    await createSelfHostedPatientFollowUpMessage({
      ...args,
      followUpId: "fu-1",
      payload: { body: "Спасибо" },
    });
    await updateSelfHostedClinicalFollowUpOperations({
      ...args,
      followUpId: "fu-1",
      payload: { triageState: "resolved", deliveryState: "delivered" },
    });
    await updateSelfHostedClinicalFollowUpQuality({
      ...args,
      followUpId: "fu-1",
      payload: { resolutionOutcome: "patient_reached", qualityReviewState: "reviewed" },
    });
    await updateSelfHostedClinicalFollowUpClinicReview({
      ...args,
      followUpId: "fu-1",
      payload: { retentionReviewState: "reviewed", clinicReviewState: "completed" },
    });
    await updateSelfHostedClinicalFollowUpSopValidation({
      ...args,
      followUpId: "fu-1",
      payload: { sopValidationState: "validated", sopPolicyVersion: "clinic-local-v1" },
    });
    await updateSelfHostedClinicalFollowUpSopPolicyApplication({
      ...args,
      followUpId: "fu-1",
      payload: { sopPolicyTemplateId: "template-1", sopPolicyDriftState: "in_sync" },
    });
    await updateSelfHostedClinicalFollowUpSopPolicyExceptionClosure({
      ...args,
      followUpId: "fu-1",
      payload: {
        sopPolicyExceptionState: "accepted",
        sopPolicyExceptionResolution: "Closed inside clinic policy review.",
      },
    });
    await updateSelfHostedClinicalFollowUpSopPolicyAuditRollup({
      ...args,
      followUpId: "fu-1",
      payload: {
        sopPolicyAuditState: "reviewed",
        sopPolicyAuditNote: "Local SOP policy audit reviewed.",
      },
    });
    await updateSelfHostedClinicalFollowUpSopPolicyGovernanceReadiness({
      ...args,
      followUpId: "fu-1",
      payload: {
        sopPolicyGovernanceState: "reviewed",
        sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
      },
    });
    await updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure({
      ...args,
      followUpId: "fu-1",
      payload: {
        sopPolicyGovernanceClosureState: "closed",
        sopPolicyGovernanceClosureNote: "Local SOP policy governance closure completed.",
      },
    });
    await createSelfHostedClinicalFollowUpSopPolicyTemplate({
      ...args,
      payload: {
        code: "followup-standard",
        title: "Follow-up standard SOP",
        version: "clinic-local-v1",
      },
    });
    await updateSelfHostedClinicalFollowUpSopPolicyTemplate({
      ...args,
      templateId: "template-1",
      payload: { version: "clinic-local-v2" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(15);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/visits/visit-1/follow-ups");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[2][0]).toContain("/api/v1/clinical/follow-ups/fu-1/messages");
    expect(fetchMock.mock.calls[3][0]).toContain("/api/v1/me/follow-ups/fu-1/messages");
    expect(fetchMock.mock.calls[4][0]).toContain("/api/v1/clinical/follow-ups/fu-1/operations");
    expect(fetchMock.mock.calls[5][0]).toContain("/api/v1/clinical/follow-ups/fu-1/quality");
    expect(fetchMock.mock.calls[6][0]).toContain("/api/v1/clinical/follow-ups/fu-1/clinic-review");
    expect(fetchMock.mock.calls[7][0]).toContain("/api/v1/clinical/follow-ups/fu-1/sop-validation");
    expect(fetchMock.mock.calls[8][0]).toContain("/api/v1/clinical/follow-ups/fu-1/sop-policy-application");
    expect(fetchMock.mock.calls[9][0]).toContain("/api/v1/clinical/follow-ups/fu-1/sop-policy-exception");
    expect(fetchMock.mock.calls[10][0]).toContain("/api/v1/clinical/follow-ups/fu-1/sop-policy-audit");
    expect(fetchMock.mock.calls[11][0]).toContain("/api/v1/clinical/follow-ups/fu-1/sop-policy-governance");
    expect(fetchMock.mock.calls[12][0]).toContain("/api/v1/clinical/follow-ups/fu-1/sop-policy-governance-closure");
    expect(fetchMock.mock.calls[13][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-templates");
    expect(fetchMock.mock.calls[14][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-templates/template-1");
  });

  it("lists and summarizes follow-up operations queue", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      return {
        ok: true,
        json: async () => url.includes("/summary")
          ? { item: url.includes("sop-policy-templates")
              ? { totalTemplates: 2, activeTemplates: 1, localPolicyEvents: 3 }
              : url.includes("sop-policy-application")
              ? { activeTemplates: 1, appliedTemplates: 1, reviewRequired: 1, needsPolicyApplication: 1, localApplicationEvents: 2 }
              : url.includes("sop-policy-exceptions")
              ? { totalFollowUps: 2, openExceptions: 1, closedExceptions: 1, unresolvedDrift: 1, localExceptionEvents: 2 }
              : url.includes("sop-policy-audit")
              ? { totalFollowUps: 2, auditReady: 1, needsAuditReview: 1, reviewedAudits: 0, localPolicyAuditEvents: 1 }
              : url.includes("sop-policy-governance-closure")
              ? { totalFollowUps: 2, closureReady: 1, needsClosureReview: 1, closedGovernanceReviews: 1, localGovernanceClosureEvents: 1 }
              : url.includes("sop-policy-governance")
              ? { totalFollowUps: 2, governanceReady: 1, needsGovernanceReview: 1, reviewedGovernance: 0, localGovernanceEvents: 1 }
              : url.includes("clinic-review")
              ? { retentionDue: 1, clinicNeedsPolicyReview: 1, localReviewEvents: 2 }
              : url.includes("sop-validation")
                ? { sopRequired: 1, sopValidated: 1, localSopEvents: 2 }
              : { totalOpen: 3, overdue: 1, waitingPatient: 1, escalated: 1, deliveryFailed: 1, deliveryPending: 0 } }
          : { items: url.includes("sop-policy-templates") ? [SOP_POLICY_TEMPLATE] : [FOLLOW_UP] },
      } as Response;
    });

    const args = { apiBaseUrl: "http://localhost:3001", apiToken: "token" };
    const queue = await listSelfHostedClinicalFollowUpOperations({
      ...args,
      visitId: "visit-1",
      overdueOnly: true,
    });
    const summary = await getSelfHostedClinicalFollowUpOperationsSummary(args);
    const outcomes = await getSelfHostedClinicalFollowUpOutcomeQualitySummary(args);
    const clinicReview = await getSelfHostedClinicalFollowUpClinicReviewSummary(args);
    const sopValidation = await getSelfHostedClinicalFollowUpSopValidationSummary(args);
    const sopPolicySummary = await getSelfHostedClinicalFollowUpSopPolicyTemplateSummary(args);
    const sopPolicyApplication = await getSelfHostedClinicalFollowUpSopPolicyApplicationSummary(args);
    const sopPolicyExceptions = await getSelfHostedClinicalFollowUpSopPolicyExceptionClosureSummary(args);
    const sopPolicyAudit = await getSelfHostedClinicalFollowUpSopPolicyAuditRollupSummary(args);
    const sopPolicyGovernance = await getSelfHostedClinicalFollowUpSopPolicyGovernanceReadinessSummary(args);
    const sopPolicyGovernanceClosure = await getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary(args);
    const sopPolicies = await listSelfHostedClinicalFollowUpSopPolicyTemplates({ ...args, activeOnly: true });

    expect(queue.ok).toBe(true);
    expect(queue.value?.[0]?.triageState).toBe("escalated");
    expect(summary.value?.deliveryFailed).toBe(1);
    expect(outcomes.ok).toBe(true);
    expect(clinicReview.value?.clinicNeedsPolicyReview).toBe(1);
    expect(sopValidation.value?.sopValidated).toBe(1);
    expect(sopPolicySummary.value?.activeTemplates).toBe(1);
    expect(sopPolicyApplication.value?.reviewRequired).toBe(1);
    expect(sopPolicyExceptions.value?.openExceptions).toBe(1);
    expect(sopPolicyAudit.value?.auditReady).toBe(1);
    expect(sopPolicyGovernance.value?.governanceReady).toBe(1);
    expect(sopPolicyGovernanceClosure.value?.closureReady).toBe(1);
    expect(sopPolicies.value?.[0]?.code).toBe("followup-standard");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/clinical/follow-ups/operations?visitId=visit-1&overdueOnly=true");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/v1/clinical/follow-ups/operations/summary");
    expect(fetchMock.mock.calls[2][0]).toContain("/api/v1/clinical/follow-ups/outcomes/summary");
    expect(fetchMock.mock.calls[3][0]).toContain("/api/v1/clinical/follow-ups/clinic-review/summary");
    expect(fetchMock.mock.calls[4][0]).toContain("/api/v1/clinical/follow-ups/sop-validation/summary");
    expect(fetchMock.mock.calls[5][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-templates/summary");
    expect(fetchMock.mock.calls[6][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-application/summary");
    expect(fetchMock.mock.calls[7][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-exceptions/summary");
    expect(fetchMock.mock.calls[8][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-audit/summary");
    expect(fetchMock.mock.calls[9][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-governance/summary");
    expect(fetchMock.mock.calls[10][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary");
    expect(fetchMock.mock.calls[11][0]).toContain("/api/v1/clinical/follow-ups/sop-policy-templates?activeOnly=true");
  });

  it("returns not_configured without a token", async () => {
    const result = await listSelfHostedPatientFollowUps({ apiBaseUrl: "/api", apiToken: null });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });
});
