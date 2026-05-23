import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createClinicalFollowUpService,
  normalizeClinicalFollowUpClinicReviewUpdatePayload,
  normalizeClinicalFollowUpCreatePayload,
  normalizeClinicalFollowUpMessagePayload,
  normalizeClinicalFollowUpOperationsUpdatePayload,
  normalizeClinicalFollowUpQualityUpdatePayload,
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
