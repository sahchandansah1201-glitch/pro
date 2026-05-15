import assert from "node:assert/strict";
import { test } from "node:test";

import { createPatientPortalService } from "./patient-portal-service.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";

function createService(overrides = {}) {
  const auditEvents = [];
  const service = createPatientPortalService({
    patientPortalRepository: {
      async getOverview({ userId }) {
        return overrides.overview || {
          patient: { id: "p-1", clinic: { id: "c-1" } },
          reports: [],
          reminders: [],
          userId,
        };
      },
      async getReport({ reportId }) {
        return overrides.report === null
          ? null
          : overrides.report || {
              id: reportId,
              visitId: "v-1",
              patientSafeText: "Отчёт для пациента",
              clinic: { id: "c-1" },
            };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
      },
    },
  });
  return { service, auditEvents };
}

test("Stage 5N service allows patient role and audits overview/report reads", async () => {
  const { service, auditEvents } = createService();
  const authContext = { userId: USER_ID, roles: ["patient"] };

  const overview = await service.getOverview(authContext, { correlationId: "corr-1" });
  const report = await service.getReport(REPORT_ID, authContext, { correlationId: "corr-2" });

  assert.equal(overview.scope.userId, USER_ID);
  assert.equal(report.report.patientSafeText, "Отчёт для пациента");
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "patient_portal.overview.read",
    "patient_portal.report.read",
  ]);
});

test("Stage 5N service denies non-patient roles", async () => {
  const { service } = createService();
  await assert.rejects(
    () => service.getOverview({ userId: USER_ID, roles: ["doctor"] }),
    /access/,
  );
});

test("Stage 5N service validates report id and maps missing report to public 404", async () => {
  const { service } = createService({ report: null });
  const authContext = { userId: USER_ID, roles: ["patient"] };

  await assert.rejects(
    () => service.getReport("bad-id", authContext),
    (error) => error.publicCode === "invalid_uuid" && error.publicStatus === 400,
  );
  await assert.rejects(
    () => service.getReport(REPORT_ID, authContext),
    (error) => error.publicCode === "not_found" && error.publicStatus === 404,
  );
});
