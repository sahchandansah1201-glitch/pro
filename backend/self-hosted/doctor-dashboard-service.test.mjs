import test from "node:test";
import assert from "node:assert/strict";

import { createDoctorDashboardService } from "./doctor-dashboard-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

function authContext(role = "doctor") {
  return {
    userId: USER_ID,
    roles: [role],
    clinicIds: [CLINIC_ID],
  };
}

test("Stage 5I service reads dashboard with doctor RBAC and audit", async () => {
  const auditEvents = [];
  const repositoryCalls = [];
  const service = createDoctorDashboardService({
    doctorDashboardRepository: {
      async getDashboard(params) {
        repositoryCalls.push(params);
        return {
          kpis: { activeVisits: 1 },
          upcoming: [{ id: "visit-1" }],
          awaitingConclusions: [],
          recentPatients: [],
          assetIssues: [],
          devices: [],
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await service.getDashboard(authContext("doctor"), { correlationId: "corr-5i" });
  assert.equal(result.dashboard.kpis.activeVisits, 1);
  assert.equal(repositoryCalls[0].doctorUserId, USER_ID);
  assert.deepEqual(repositoryCalls[0].clinicIds, [CLINIC_ID]);
  assert.equal(repositoryCalls[0].allClinics, false);
  assert.equal(auditEvents[0].action, "doctor.dashboard.read");
  assert.equal(auditEvents[0].entityType, "doctor_dashboard");
  assert.equal(auditEvents[0].correlationId, "corr-5i");
});

test("Stage 5I service rejects clinic_admin before reading the doctor dashboard", async () => {
  let repositoryCalls = 0;
  const service = createDoctorDashboardService({
    doctorDashboardRepository: {
      async getDashboard() { repositoryCalls += 1; },
    },
    auditRepository: { async recordEvent() {} },
  });

  await assert.rejects(
    () => service.getDashboard(authContext("clinic_admin"), { correlationId: "corr-admin" }),
    /access|role|resource/i,
  );
  assert.equal(repositoryCalls, 0);
});

test("Stage 5I service denies roles without visit read access", async () => {
  const service = createDoctorDashboardService({
    doctorDashboardRepository: { async getDashboard() { return {}; } },
    auditRepository: { async recordEvent() {} },
  });

  await assert.rejects(
    () => service.getDashboard(authContext("operator"), { correlationId: "corr-deny" }),
    /access|role|resource/i,
  );
});
