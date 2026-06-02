import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import {
  createClinicalWorkspaceService,
  normalizeLesionComparisonDraftPayload,
  normalizeUpdateAssessmentPayload,
  normalizeUpdateConclusionPayload,
} from "./clinical-workspace-service.mjs";
import { VisitWorkspaceValidationError } from "./visit-workspace-write-service.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

const authContext = {
  userId: USER_ID,
  roles: ["doctor"],
  clinicIds: [CLINIC_ID],
};

function createService({ auditEvents = [], repo = {} } = {}) {
  const defaults = {
    async getAssessment() {
      return { id: "assessment-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "ready" };
    },
    async upsertAssessment() {
      return { id: "assessment-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "ready" };
    },
    async getConclusion() {
      return { id: "conclusion-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "ready" };
    },
    async upsertConclusion() {
      return { id: "conclusion-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "ready" };
    },
    async getReport() {
      return { id: "report-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "draft" };
    },
    async upsertLesionComparisonDraft() {
      return {
        id: "draft-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        doctorUserId: USER_ID,
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        action: "retake",
        comparability: "not_comparable",
        reasons: ["Разные условия съёмки"],
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
  };
  return createClinicalWorkspaceService({
    visitWorkspaceRepository: {
      async getVisit() {
        return {
          id: VISIT_ID,
          patient: { id: PATIENT_ID },
          clinic: { id: CLINIC_ID },
        };
      },
    },
    clinicalWorkspaceRepository: { ...defaults, ...repo },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });
}

test("Stage 5H payload normalizers reject invalid clinical workspace writes", () => {
  assert.throws(() => normalizeUpdateAssessmentPayload({}), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateAssessmentPayload({ riskLevel: "diagnosis" }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateAssessmentPayload({ abcdTotal: 999 }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateConclusionPayload({ status: "published" }), VisitWorkspaceValidationError);
  assert.deepEqual(normalizeUpdateAssessmentPayload({ status: "ready", abcdTotal: "3.4" }).abcdTotal, 3.4);
});

test("Stage 5H lesion comparison draft normalizer rejects unsafe or clinical-claim payloads", () => {
  const valid = normalizeLesionComparisonDraftPayload({
    lesionId: "l-008",
    pairKey: "l-008:i-011+i-012",
    imageIds: ["i-011", "i-012"],
    action: "retake",
    comparability: "not_comparable",
    reasons: ["Разные условия съёмки", "Есть технические замечания"],
  });
  assert.equal(valid.patientDeliveryAllowed, false);
  assert.equal(valid.protectedFieldsExposed, false);

  assert.throws(
    () => normalizeLesionComparisonDraftPayload({ ...valid, photoRef: "mock://photo" }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonDraftPayload({ ...valid, reasons: ["вероятность меланомы"] }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonDraftPayload({ ...valid, imageIds: ["i-011"] }),
    VisitWorkspaceValidationError,
  );
});

test("Stage 5H service reads and writes assessment/conclusion/report with audit events", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const assessmentRead = await service.getAssessment(VISIT_ID, authContext, { correlationId: "c1" });
  const assessmentWrite = await service.updateAssessment(VISIT_ID, { status: "ready" }, authContext, { correlationId: "c2" });
  const conclusionRead = await service.getConclusion(VISIT_ID, authContext, { correlationId: "c3" });
  const conclusionWrite = await service.updateConclusion(VISIT_ID, { summary: "готово" }, authContext, { correlationId: "c4" });
  const reportRead = await service.getReport(VISIT_ID, authContext, { correlationId: "c5" });

  assert.equal(assessmentRead.assessment.visitId, VISIT_ID);
  assert.equal(assessmentWrite.assessment.status, "ready");
  assert.equal(conclusionRead.conclusion.visitId, VISIT_ID);
  assert.equal(conclusionWrite.conclusion.status, "ready");
  assert.equal(reportRead.report.visitId, VISIT_ID);
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["assessment.read", "assessment.update", "conclusion.read", "conclusion.update", "report.read"],
  );
});

test("Stage 5H service persists lesion comparison draft with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.saveLesionComparisonDraft(
    VISIT_ID,
    {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      action: "retake",
      comparability: "not_comparable",
      reasons: ["Разные условия съёмки"],
    },
    authContext,
    { correlationId: "c6" },
  );

  assert.equal(result.draft.patientDeliveryAllowed, false);
  assert.equal(result.draft.protectedFieldsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_draft.upsert");
  assert.equal(auditEvents.at(-1).entityType, "lesion_comparison_decision_draft");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    lesionId: "l-008",
    action: "retake",
    comparability: "not_comparable",
    imageCount: 2,
    reasonsCount: 1,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  });
  assert.doesNotMatch(JSON.stringify(auditEvents.at(-1)), /i-011|i-012|pairKey|storagePath|photoRef|token|session/i);
});

test("Stage 5H service denies assessment writes without visit write scope", async () => {
  const service = createService();
  await assert.rejects(
    () => service.updateAssessment(VISIT_ID, { status: "ready" }, {
      userId: "u",
      roles: ["assistant"],
      clinicIds: [CLINIC_ID],
    }),
    ForbiddenError,
  );
});
