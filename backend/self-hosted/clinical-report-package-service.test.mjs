import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import { createClinicalReportPackageService } from "./clinical-report-package-service.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

const doctorAuth = {
  userId: USER_ID,
  roles: ["doctor"],
  clinicIds: [CLINIC_ID],
};

function readyPackage(overrides = {}) {
  return {
    visitId: VISIT_ID,
    clinicId: CLINIC_ID,
    counts: { lesions: 2, assets: 3 },
    readiness: { ready: true, missing: [], status: "ready" },
    ...overrides,
  };
}

test("Stage 8G-8I service returns report package and writes safe audit metadata", async () => {
  const auditEvents = [];
  const service = createClinicalReportPackageService({
    clinicalReportPackageRepository: {
      async getReportPackage() {
        return readyPackage();
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });
  const result = await service.getReportPackage(VISIT_ID, doctorAuth, { correlationId: "corr-8g" });
  assert.equal(result.reportPackage.readiness.status, "ready");
  assert.equal(auditEvents[0].action, "clinical_report.package.read");
  assert.deepEqual(auditEvents[0].metadata, {
    ready: true,
    missingCount: 0,
    lesionCount: 2,
    assetCount: 3,
  });
});

test("Stage 8G-8I service denies roles without visit read scope", async () => {
  const service = createClinicalReportPackageService({
    clinicalReportPackageRepository: {
      async getReportPackage() {
        return readyPackage();
      },
    },
    auditRepository: { async recordEvent() {} },
  });
  await assert.rejects(
    () => service.getReportPackage(VISIT_ID, { userId: USER_ID, roles: ["operator"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Stage 8G-8I service treats out-of-scope packages as not found", async () => {
  const service = createClinicalReportPackageService({
    clinicalReportPackageRepository: {
      async getReportPackage() {
        return readyPackage({ clinicId: "10000000-0000-4000-8000-000000000099" });
      },
    },
    auditRepository: { async recordEvent() {} },
  });
  await assert.rejects(
    () => service.getReportPackage(VISIT_ID, doctorAuth),
    /Report package was not found/,
  );
});
