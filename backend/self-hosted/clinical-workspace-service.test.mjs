import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import {
  createClinicalWorkspaceService,
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
