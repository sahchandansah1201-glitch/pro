import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import {
  createVisitWorkspaceWriteService,
  normalizeCreateLesionPayload,
  normalizeUpdateReportPayload,
  normalizeUpdateVisitPayload,
  VisitWorkspaceValidationError,
} from "./visit-workspace-write-service.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const LESION_ID = "10000000-0000-4000-8000-000000000401";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

const authContext = {
  userId: USER_ID,
  roles: ["doctor"],
  clinicIds: [CLINIC_ID],
};

function createService({ auditEvents = [], repo = {} } = {}) {
  const defaults = {
    async updateVisit() {
      return { id: VISIT_ID, clinicId: CLINIC_ID, status: "in_progress", chiefComplaint: "контроль" };
    },
    async createLesion() {
      return { id: LESION_ID, clinicId: CLINIC_ID, visitId: VISIT_ID, label: "L1" };
    },
    async updateLesion() {
      return { id: LESION_ID, clinicId: CLINIC_ID, visitId: VISIT_ID, label: "L2" };
    },
    async archiveLesion() {
      return { id: LESION_ID, clinicId: CLINIC_ID, visitId: VISIT_ID, status: "archived" };
    },
    async upsertReport() {
      return { id: "10000000-0000-4000-8000-000000000501", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "draft" };
    },
  };
  return createVisitWorkspaceWriteService({
    visitWorkspaceRepository: {
      async getVisit() {
        return {
          id: VISIT_ID,
          patient: { id: "10000000-0000-4000-8000-000000000201" },
          clinic: { id: CLINIC_ID },
        };
      },
    },
    visitWorkspaceWriteRepository: { ...defaults, ...repo },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });
}

test("payload normalizers reject empty or invalid visit workspace writes", () => {
  assert.throws(() => normalizeUpdateVisitPayload({}), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateVisitPayload({ status: "closed" }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeCreateLesionPayload({ label: "" }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeCreateLesionPayload({ label: "L1", riskLevel: "diagnosis" }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateReportPayload({ status: "published" }), VisitWorkspaceValidationError);
});

test("service updates visit, lesion, archive and report with audit events", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const visit = await service.updateVisit(VISIT_ID, { chiefComplaint: "контроль" }, authContext, { correlationId: "c1" });
  const created = await service.createLesion(VISIT_ID, { label: "L1" }, authContext, { correlationId: "c2" });
  const updated = await service.updateLesion(LESION_ID, { label: "L2" }, authContext, { correlationId: "c3" });
  const archived = await service.archiveLesion(LESION_ID, authContext, { correlationId: "c4" });
  const report = await service.updateReport(VISIT_ID, { physicianText: "для врача" }, authContext, { correlationId: "c5" });

  assert.equal(visit.visit.id, VISIT_ID);
  assert.equal(created.lesion.label, "L1");
  assert.equal(updated.lesion.label, "L2");
  assert.equal(archived.lesion.status, "archived");
  assert.equal(report.report.visitId, VISIT_ID);
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["visit.update", "lesion.create", "lesion.update", "lesion.archive", "report.update"],
  );
});

test("service denies roles without visit write scope", async () => {
  const service = createService();
  await assert.rejects(
    () => service.updateVisit(VISIT_ID, { chiefComplaint: "x" }, { userId: "u", roles: ["clinic_admin"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});
